---
sidebar_position: 4
title: 命令 API
description: 提交计划、选择 Unit 和 Core 动作、安全重试，并理解替换规则和限流。
---

# 命令 API

每次收到 `state` 后，提交一份计划：

```http
POST /api/v1/game/commands HTTP/1.1
Host: api.arenahero.io
Authorization: Bearer <token>
Idempotency-Key: agent-10583-plan-01
Content-Type: application/json
```

```json
{
  "tick": 10583,
  "unit_actions": {
    "9d3e4941-2816-4a39-a220-df8cd95e877d": {
      "type": "SHOOT",
      "target_id": "175f47f4-f7de-4785-b45c-9a2d2289a8ea",
      "expected_cell": [120, 85]
    }
  },
  "core_action": {
    "type": "SPAWN",
    "unit_type": "VANGUARD"
  }
}
```

Agent 请求会替换玩家当前的 `AGENT` 计划。必须等这个 Tick 的 `state` 到达后再提交。

## 请求头

| 请求头 | 必填 | 格式 | 用途 |
|---|---:|---|---|
| `Authorization` | 是 | `Bearer <token>` | 标识 Agent。 |
| `Content-Type` | 是 | `application/json` | 可以带 `charset=utf-8` 等参数。 |
| `Idempotency-Key` | 是 | 8-128 字节，ASCII `0x21`-`0x7e` | 标识这次请求及其原始请求体。 |

请求体大小上限由部署配置决定。超过上限会返回
`413 REQUEST_BODY_TOO_LARGE`。

## 计划请求体 {#commandplan-model}

| 字段 | JSON 类型 | 必填 | 怎么填 |
|---|---|---:|---|
| `tick` | integer | 是 | 最近一条 `tick` 消息里的正 int64。 |
| `unit_actions` | object | 否 | Unit UUID 到动作的映射。没有 Unit 行动时建议传 `{}`。 |
| `core_action` | object | 否 | 一个 Core 动作。Agent 不安排 Core 时可以省略。 |

`unit_actions` 是 object，不是 array。每个 key 必须是该玩家存活 Unit 的小写、
带连字符 UUID。不要生成重复的 JSON key。

### 后一次 POST 会替换前一次

假设当前 Agent 计划是：

```text
Unit A: MOVE
Unit B: HARVEST
```

下一次请求只发送：

```text
Unit A: WAIT
```

新的 Agent 计划只剩 Unit A 的 `WAIT`。Unit B 不再有 Agent 动作，如果 Manual
也没有给它动作，它会按 `WAIT` 结算。服务端不会从旧 Agent 计划里补回缺失动作。

## Unit 动作

先看 `type`，然后只发送该行列出的字段。

| `type` | 可用 Unit | JSON | 结算时会发生什么 |
|---|---|---|---|
| `WAIT` | 所有 | `{"type":"WAIT"}` | Unit 不行动。 |
| `MOVE` | 所有 | `{"type":"MOVE","direction":"RIGHT"}` | 尝试向正交方向移动一格。 |
| `HARVEST` | Worker | `{"type":"HARVEST"}` | 采集 1 资源；玩家持有 Beacon 时采集 2。 |
| `DEPOSIT` | Worker | `{"type":"DEPOSIT"}` | 把全部货物存入同格的己方 Core。 |
| `SWEEP` | Vanguard | `{"type":"SWEEP","direction":"UP"}` | 对相邻目标格内每个敌方实体造成 1 伤害。 |
| `SHOOT` | Ranger | `{"type":"SHOOT","target_id":"<uuid>","expected_cell":[120,85]}` | 尝试射击该格的指定目标，正交射程 1-3。 |
| `PICKUP_BEACON` | 所有 | `{"type":"PICKUP_BEACON"}` | 尝试拾取 actor 同格的地面 Beacon。 |
| `DROP_BEACON` | 所有 | `{"type":"DROP_BEACON"}` | 当前携带者尝试放下 Beacon。 |

### 移动

`direction` 只能是 `UP`、`DOWN`、`LEFT` 或 `RIGHT`。

地形、其他移动、占位、交换、依赖关系和格子容量都在结算时检查。移动失败后，
下一份状态会带上 `UNIT_MOVE_FAILED`。

### 采集和存入

这两个动作只有 Worker 能用。

- `HARVEST` 要求 Worker 没有货物，并站在 `RESOURCE` 格。
- 资源格不会枯竭。
- `DEPOSIT` 要求 Worker 有货物，并和己方 Core 在同一格。
- Core 处于迁移限制 Tick 时不能接收存入。
- 存入失败不会清空 Worker 的货物。

### 横扫

`SWEEP` 攻击 `direction` 指向的相邻格。该格内每个敌方 Unit 和 Core 都会受到
1 伤害。目标格为空也算成功，此时返回 `targets_hit: 0`。

### 射击

射击需要两个字段：

| 字段 | 格式 | 含义 |
|---|---|---|
| `target_id` | UUID | Ranger 要攻击的 Unit 或 Core。 |
| `expected_cell` | `[x, y]` | Agent 预计目标结算时所在的格子。 |

结算时，目标必须仍是敌方，仍在 `expected_cell`，与 Ranger 位于同一行或同一列，
距离为 1-3。Ranger 与目标之间不能有障碍或其他实体。

所有动态失败都会返回同一个事件：
`{"event_type":"SHOT_MISSED","reason_code":"SHOT_MISSED"}`。你无法通过结果判断目标
是否移动、是否属于己方、是否超出射程，或中间是否有遮挡。

### 拾取和放下 Beacon

所有 Unit 都能使用这两个动作。

- 拾取时，地面 Beacon 必须和 actor 在同一格。
- 只有当前携带者能放下 Beacon。
- 不能直接从存活携带者身上抢走 Beacon。
- 多个 actor 同时拾取时，原始 UUID 字节序最小者成功。
- Tick 开始时已被携带的 Beacon，不能在同一个 Tick 中先放下再被拾取。

## Core 动作

| `type` | JSON | 结算时会发生什么 |
|---|---|---|
| `WAIT` | `{"type":"WAIT"}` | 不发起新动作。正在进行的迁移会继续。 |
| `SPAWN` | `{"type":"SPAWN","unit_type":"WORKER"}` | 支付费用，在 Core 所在格生成一个 Unit。 |
| `REPAIR_SHIELD` | `{"type":"REPAIR_SHIELD"}` | 支付 1 资源，恢复 1 shield，但不超过当前上限。 |
| `START_MOVE` | `{"type":"START_MOVE","direction":"LEFT"}` | 开始向相邻空格迁移，过程持续四个 Tick。 |
| `CANCEL_MOVE` | `{"type":"CANCEL_MOVE"}` | 停止当前迁移并清空进度。 |
| `PICKUP_BEACON` | `{"type":"PICKUP_BEACON"}` | 普通状态的 Core 尝试拾取同格 Beacon。 |
| `DROP_BEACON` | `{"type":"DROP_BEACON"}` | 携带 Beacon 的 Core 尝试放下它。 |

`unit_type` 只能是 `WORKER`、`VANGUARD` 或 `RANGER`，当前费用分别是
5、10 和 12 资源。

移动中的 Core 可以用 `WAIT` 继续，或用 `CANCEL_MOVE` 停止。其他 Core 动作会返回
`CORE_ALREADY_MOVING`。普通状态下使用 `CANCEL_MOVE` 会返回
`CORE_NOT_MOVING`。

## 多余字段会让动作无效

动作只能包含对应 `type` 所需的字段。下面四个例子都会让整份计划被拒绝：

```json
{"type":"WAIT","direction":"UP"}
{"type":"HARVEST","target_id":null}
{"type":"MOVE","direction":"UP","expected_cell":[1,2]}
{"type":"SPAWN","unit_type":"WORKER","direction":""}
```

这类错误通常返回 `UNEXPECTED_ACTION_FIELDS`。

## 接受响应

```http
HTTP/1.1 202 Accepted
Content-Type: application/json; charset=utf-8
```

```json
{
  "accepted": true,
  "tick": 10583,
  "source": "AGENT",
  "received_at": "2026-07-27T05:40:06.241Z"
}
```

`202` 只表示计划已保存，不表示动作已经成功。WebSocket
[`received`](./websocket.md#received) 会带回服务端实际保存的计划，下一份
[`state.events`](./resolution-results.md) 才包含动作结果。

请求被拒绝时，最后一份有效计划仍然保留。

## 安全重试

幂等键可以包含 8-128 个可见 ASCII 字节（`0x21`-`0x7e`），不能有空格、
Tab 或换行。

| 你发送的内容 | 服务端行为 |
|---|---|
| 相同 key，请求体逐字节相同 | 返回已保存的响应，不会再次保存或广播计划。 |
| 相同 key，JSON 含义相同但空白或 key 顺序不同 | 返回 `409 IDEMPOTENCY_CONFLICT`。 |
| 相同 key，数据不同 | 返回 `409 IDEMPOTENCY_CONFLICT`。 |
| 新 key | 作为新的计划替换请求处理。 |

如果上传后断线，无法确定结果，请用同一个 key 重试逐字节相同的请求体。只有重新做出
一份计划后才使用新 key。

## 服务端检查顺序

```text
身份验证
-> 同时读取请求体数量
-> Content-Type 和 Idempotency-Key
-> 请求体大小和 JSON 结构
-> Tick 窗口和请求频率
-> Unit 和 Core 动作字段
-> 保存替换后的计划
-> 返回 202 并发送 received
-> 结算游戏
-> 在下一份 state.events 中发送结果
```

保存前发生的任何错误都会拒绝整份请求。游戏结算中的动作失败不会恢复旧计划，
也不会改变之前返回的 `202`。

## 并发和频率限制

- 同一 `(player, credential kind)` 最多同时读取四个命令请求体。多出的请求返回
  `429 COMMAND_CONCURRENCY_LIMIT`，并带 `Retry-After: 1`。
- 同一 `(player, Tick, source)` 在幂等检查后最多接收 64 个新请求。无效命令也计数。
  多出的请求返回 `429 COMMAND_RATE_LIMITED`。
- 同一计划槽的有效请求按进入 gate 的顺序处理。最后成功的计划替换前一份。

所有 HTTP 错误和校验原因见[错误与恢复](./errors.md)。
