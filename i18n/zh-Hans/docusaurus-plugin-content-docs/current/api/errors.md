---
sidebar_position: 6
title: 错误与恢复
description: 读取错误响应，判断能否重试，并修复命令或 WebSocket 问题。
---

# 错误与恢复

程序应根据 HTTP 状态码和 `error` 分支。可选的 `message` 只用于日志和人工阅读。

## 先看响应长什么样

请求还没进入命令处理时，错误通常是：

```json
{
  "error": "UNAUTHORIZED"
}
```

请求已经到达命令 gate 后，拒绝响应会带上 `"accepted": false`：

```json
{
  "accepted": false,
  "error": "TICK_MISMATCH",
  "tick": 10582,
  "current_tick": 10583
}
```

计划内容无效时，还会给出一个或多个原因：

```json
{
  "accepted": false,
  "error": "INVALID_COMMAND",
  "details": [
    {
      "unit_id": "9d3e4941-2816-4a39-a220-df8cd95e877d",
      "reason": "RANGER_CANNOT_HARVEST"
    },
    {
      "reason": "INVALID_UNIT_TYPE"
    }
  ]
}
```

传输、身份验证、JSON、并发和服务端内部错误没有 `accepted` 字段。字段缺失不代表
命令已被接受。

## HTTP 错误

| 状态 | `error` | 额外字段 | 出了什么问题 |
|---:|---|---|---|
| 400 | `INVALID_JSON` | `message` | 请求体为空或格式错误，含多个 JSON 值、未知字段、错误字段类型、格式错误的 UUID，或 `unit_actions` 使用了非标准 UUID key。 |
| 400 | `IDEMPOTENCY_KEY_INVALID` | 无 | 请求头缺失，或不是 8-128 个可见 ASCII 字节（`0x21`-`0x7e`）。 |
| 401 | `UNAUTHORIZED` | 无 | Bearer 凭据缺失、无效或已停用。 |
| 403 | `CSRF_INVALID` | 无 | 浏览器 Manual 请求未通过 CSRF 校验。Agent Bearer 请求不使用 CSRF。 |
| 409 | `COMMAND_WINDOW_CLOSED` | `accepted: false` | Tick 存在，但命令窗口已关闭，或请求体在截止时间到达或之后才收完。 |
| 409 | `TICK_MISMATCH` | `accepted: false`；查到持久化记录后的响应还会带 `tick` 和 `current_tick` | 提交的 Tick 不是当前命令 Tick。 |
| 409 | `IDEMPOTENCY_CONFLICT` | `accepted: false` | 该玩家和来源已用同一 key 提交过不同的原始请求字节。 |
| 413 | `REQUEST_BODY_TOO_LARGE` | `message` | 请求体超过当前部署的上限。 |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | 无 | 解析后的媒体类型不是 `application/json`。允许 `charset=utf-8` 等参数。 |
| 422 | `INVALID_COMMAND` | `accepted: false`，非空 `details` | JSON 结构正确，但玩家、Unit 或动作不符合规则。 |
| 429 | `COMMAND_CONCURRENCY_LIMIT` | `Retry-After: 1` 请求头 | 同一玩家和凭据类型正在处理超过四个命令请求体。 |
| 429 | `COMMAND_RATE_LIMITED` | `accepted: false`；`Retry-After: 1` 请求头 | 该 `(player, Tick, source)` 已尝试超过 64 个新请求。 |
| 500 | `INTERNAL_ERROR` | 无 | 服务端没能完成请求。 |
| 503 | `TICK_NOT_READY` | `accepted: false` | Tick 尚未初始化、玩家状态未准备好，或 Tick 处理失败。 |

请求体上限属于部署配置，不属于协议。尽量保持计划精简，只会表达 `WAIT` 的动作可以省略。

## 该不该重试

| 结果 | 是否用相同 key 和请求体重试 | 下一步 |
|---|---|---|
| 上传后网络超时或连接重置 | 是 | 在确认原结果前保持请求体不变。 |
| `500 INTERNAL_ERROR` | 是 | 使用有上限的退避。 |
| `429 COMMAND_CONCURRENCY_LIMIT` | 是 | 等待 `Retry-After`。 |
| `503 TICK_NOT_READY` | 通常先不要 | 等待 `state` 或重连。收到更新状态后重新计算。 |
| `409 COMMAND_WINDOW_CLOSED` | 仅用于找回可能已完成的原请求 | 等下一份状态再制定新计划。 |
| `409 TICK_MISMATCH` | 仅用于找回原幂等结果 | 根据当前状态重新计算。 |
| `409 IDEMPOTENCY_CONFLICT` | 否 | 只有真正的新请求才使用新 key。 |
| `422 INVALID_COMMAND` | 否 | 修正计划。窗口仍开放时，用新 key 作为新请求提交。 |
| `429 COMMAND_RATE_LIMITED` | 该来源和 Tick 不再提交新请求 | 保留最后一份有效计划，等待下一份状态。 |
| `400`、`401`、`403`、`413`、`415` | 不能原样重试 | 先修正请求或凭据。 |

服务端保留已完成的幂等响应七天。在这段时间内，即使命令窗口已经关闭，相同 key 和
逐字节相同的请求体仍会返回原状态码和响应体。重放之前的 `202` 不会再次保存计划，
也不会再次发送 `received`。

## 校验原因

Unit 动作出错时，`details[].unit_id` 会指出对应 Unit。整份计划或 Core 动作出错时，
该字段不会出现。

原因顺序固定：Tick 问题在前，然后按 UUID 字节序列出 Unit 问题，最后是 Core 问题。

| `reason` | 适用于 | 怎么修 |
|---|---|---|
| `TICK_MUST_BE_POSITIVE` | 计划 | `tick` 缺失、为零或为负数。 |
| `UNIT_NOT_OWNED` | Unit | Key 不是该玩家拥有的存活 Unit。 |
| `UNKNOWN_ACTION_TYPE` | Unit | `type` 不是 Unit 动作。 |
| `UNKNOWN_CORE_ACTION_TYPE` | Core | `type` 不是 Core 动作。 |
| `UNEXPECTED_ACTION_FIELDS` | Unit 或 Core | 动作带了该 `type` 不允许的字段，即使值是 `null`、空值或零。 |
| `INVALID_DIRECTION` | `MOVE`、`SWEEP`、`START_MOVE` | `direction` 缺失，或不是 `UP`、`DOWN`、`LEFT`、`RIGHT`。 |
| `INVALID_UNIT_TYPE` | `SPAWN` | `unit_type` 缺失，或不是 `WORKER`、`VANGUARD`、`RANGER`。 |
| `TARGET_ID_REQUIRED` | `SHOOT` | `target_id` 是零 UUID。格式错误的 UUID 会返回 `INVALID_JSON`。 |
| `EXPECTED_CELL_REQUIRED` | `SHOOT` | `expected_cell` 缺失。 |
| `VANGUARD_CANNOT_HARVEST` | Unit | Vanguard 选择了 `HARVEST`。 |
| `RANGER_CANNOT_HARVEST` | Unit | Ranger 选择了 `HARVEST`。 |
| `VANGUARD_CANNOT_DEPOSIT` | Unit | Vanguard 选择了 `DEPOSIT`。 |
| `RANGER_CANNOT_DEPOSIT` | Unit | Ranger 选择了 `DEPOSIT`。 |
| `WORKER_CANNOT_SWEEP` | Unit | Worker 选择了 `SWEEP`。 |
| `RANGER_CANNOT_SWEEP` | Unit | Ranger 选择了 `SWEEP`。 |
| `WORKER_CANNOT_SHOOT` | Unit | Worker 选择了 `SHOOT`。 |
| `VANGUARD_CANNOT_SHOOT` | Unit | Vanguard 选择了 `SHOOT`。 |

`INVALID_COMMAND` 不会改动最后一份有效计划。

## 请求在哪一步停下

服务端按以下顺序检查新请求：

1. Bearer 身份验证，以及浏览器 Manual 请求的 CSRF；
2. 每个玩家和凭据类型的请求体并发限制；
3. `Content-Type` 和 `Idempotency-Key`；
4. 请求体大小和 JSON 解码；
5. Tick、命令窗口和频率限制；
6. 当前玩家、Unit 和动作字段；
7. 幂等存储和计划替换。

这个顺序解释了看起来相似的错误。格式错误的 UUID 返回 `INVALID_JSON`。属于其他玩家的
合法 UUID 会进入动作校验，返回 `INVALID_COMMAND` 和 `UNIT_NOT_OWNED`。

## WebSocket 错误

WebSocket 握手可能返回：

- `401 UNAUTHORIZED`
- `403 WEBSOCKET_ORIGIN_INVALID`
- `409 PLAYER_NOT_READY`
- `429 REALTIME_CONNECTION_LIMIT`，并带 `Retry-After: 1`

升级成功后的关闭码见 [WebSocket 协议](./websocket.md#close-codes)。临时故障使用带随机
抖动的指数退避，从 250 ms 增长到 5 秒。收到 `1008` 后停止重试，先修复凭据或客户端行为。

重连后，用服务端发来的快照替换本地状态和已保存回执。不要发送自定义心跳消息，也不要
把 `SHOT_MISSED` 当成探测隐藏目标的手段。
