---
sidebar_position: 4
title: 命令 API
description: 提交计划、选择 Unit 和 Core 动作、安全重试，并理解替换规则和限流。
---

# 命令 API

每收到一条 `state`，就提交一份计划：

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

Agent 的请求会替换这名玩家当前的 `AGENT` 计划。发之前先等到这个 Tick 的 `state`。

## 请求头

| 请求头 | 必填 | 格式 | 用途 |
|---|---:|---|---|
| `Authorization` | 是 | `Bearer <token>` | 标识 Agent。 |
| `Content-Type` | 是 | `application/json` | 可以带 `charset=utf-8` 等参数。 |
| `Idempotency-Key` | 是 | 8-128 字节，ASCII `0x21`-`0x7e` | 标识这次请求及其原始请求体。 |

请求体大小上限由部署决定。超了就是 `413 REQUEST_BODY_TOO_LARGE`。

## 计划请求体 {#commandplan-model}

| 字段 | JSON 类型 | 必填 | 怎么填 |
|---|---|---:|---|
| `tick` | integer | 是 | 最近一条 `tick` 消息里的正 int64。 |
| `unit_actions` | object | 否 | Unit UUID 到动作的映射。没有 Unit 行动时建议传 `{}`。 |
| `core_action` | object | 否 | 一个 Core 动作。Agent 不安排 Core 时可以省略。 |

注意 `unit_actions` 是 object，不是 array。每个 key 都必须是你名下某个存活 Unit 的
小写带连字符 UUID，而且绝对不要生成重复的 JSON key。

### 后一次 POST 会替换前一次

假设当前存着的 Agent 计划是：

```text
Unit A: MOVE
Unit B: HARVEST
```

而下一次请求只发了：

```text
Unit A: WAIT
```

那么现在存的就是 Unit A 的 `WAIT`，Unit B 什么都没有。Unit B 同样按 `WAIT` 结算，
除非 Manual 给了它动作——服务端不会从旧的 Agent 计划里把缺的动作补回来。

## Unit 动作

先看 `type`，然后只发这一行列出的字段。

| `type` | 可用 Unit | JSON | 结算时会发生什么 |
|---|---|---|---|
| `WAIT` | 所有 | `{"type":"WAIT"}` | Unit 不行动。 |
| `MOVE` | 所有 | `{"type":"MOVE","direction":"RIGHT"}` | 尝试向正交方向移动一格。 |
| `HARVEST` | Worker | `{"type":"HARVEST"}` | 消耗资源点并装载 1 资源；玩家持有 Beacon 时装载 2。 |
| `DEPOSIT` | Worker | `{"type":"DEPOSIT"}` | 把能装下的货物存入同格的己方 Core。 |
| `SWEEP` | Vanguard | `{"type":"SWEEP","direction":"UP"}` | 对相邻目标格内每个敌方实体造成 1 伤害。 |
| `SHOOT` | Ranger | `{"type":"SHOOT","target_id":"<uuid>","expected_cell":[120,85]}` | 尝试射击该格的指定目标，正交射程 1-3。 |
| `PICKUP_BEACON` | 所有 | `{"type":"PICKUP_BEACON"}` | 尝试拾取 actor 同格的地面 Beacon。 |
| `DROP_BEACON` | 所有 | `{"type":"DROP_BEACON"}` | 当前携带者尝试放下 Beacon。 |
| `SELF_DESTRUCT` | 所有 | `{"type":"SELF_DESTRUCT"}` | 在计算维护费之前移除这个 Unit。 |

### 移动

`direction` 只能是 `UP`、`DOWN`、`LEFT` 或 `RIGHT`。

地形、其他移动、占位、交换、依赖关系和格子容量，全都是在结算时才检查，提交时不管。
移动失败的话，下一份状态里会带上 `UNIT_MOVE_FAILED`。

### 采集和存入

这两个动作只有 Worker 能用。

- `HARVEST` 要求 Worker 空载，并且站在 `RESOURCE` 格上。
- 一次成功采集会消耗这个资源点。
- 同一个 Tick 有多个合格空载 Worker 采同一个点时，只有 UUID 原始字节序最小的
  Worker 成功；其他人收到 `HARVEST_FAILED`，reason 是 `RESOURCE_DEPLETED`。
- Beacon 只把赢家的 cargo 从 1 变成 2，不会多消耗一个点，也不会改变 UUID 胜负顺序。
- 被消耗的点会从当前状态消失。每结算满 4 个 Tick，每个区块只把缺少的槽位按确定性
  规则补回固定配额。
- `DEPOSIT` 要求 Worker 有货，并且和自己的 Core 同格。
- Core 处在迁移受限的 Tick 时收不了货。
- Core 容量是 `max(10, population × 5)`；部分交付后，装不下的货继续留在 Worker 身上。
- Core 已满时，返回 `DEPOSIT_FAILED` / `CORE_RESOURCE_FULL`。
- 存入失败时，全部货物仍在 Worker 身上。

### 横扫

`SWEEP` 打 `direction` 指的那一格相邻格，格子里每个敌方 Unit 和 Core 各受 1 伤害。
就算那格是空的也算成功，只不过返回 `targets_hit: 0`。

### 射击

射击要两个字段：

| 字段 | 格式 | 含义 |
|---|---|---|
| `target_id` | UUID | Ranger 要攻击的 Unit 或 Core。 |
| `expected_cell` | `[x, y]` | Agent 预计目标结算时所在的格子。 |

到结算时，目标必须还是敌方、还在 `expected_cell`、和 Ranger 同行或同列、距离在
1-3 之间，而且中间不能有障碍物。Unit 和 Core 不会阻挡射击。

所有动态失败返回的都是同一个事件：
`{"event_type":"SHOT_MISSED","reason_code":"SHOT_MISSED"}`。你从结果里看不出目标是
移开了、其实是友军、超出了射程，还是被障碍物挡住了。

### 拾取和放下 Beacon

两个 Beacon 动作所有 Unit 都能用。

- 要拾取，地面上的 Beacon 必须和 actor 在同一格。
- 只有当前携带者能放下它。
- 活着的携带者手里抢不走。
- 好几个 actor 同时去拿时，原始 UUID 字节序最小的那个成功。
- Tick 开始时就已经被携带的 Beacon，不能在同一个 Tick 里先放下再被捡起来。

### 自毁 Unit

`SELF_DESTRUCT` 不带其他字段。它在维护费之前结算，移除 Unit，并占用该 Unit 本 Tick
的动作。它不返还资源，也不伤害附近对象。Worker 携带的资源会掉在当前格。Unit 携带 Beacon
时，Beacon 掉在当前格，并且要到下一 Tick 才能再次拾取。
Worker 的拥有者还会收到带掉落数量的 `WORKER_CARGO_DROPPED`。

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

`unit_type` 只能是 `WORKER`、`VANGUARD` 或 `RANGER`，目前的价格分别是 5、10 和 12
资源。

迁移中的 Core 可以用 `WAIT` 接着走，或者用 `CANCEL_MOVE` 停下来；换成别的动作就是
`CORE_ALREADY_MOVING`。反过来，对一个没在迁移的 Core 用 `CANCEL_MOVE`，会拿到
`CORE_NOT_MOVING`。

## 多余字段会让动作无效

动作只能带它自己 `type` 需要的字段。下面这四个例子，每一个都会让整份计划被拒：

```json
{"type":"WAIT","direction":"UP"}
{"type":"HARVEST","target_id":null}
{"type":"MOVE","direction":"UP","expected_cell":[1,2]}
{"type":"SPAWN","unit_type":"WORKER","direction":""}
```

这类错误一般返回 `UNEXPECTED_ACTION_FIELDS`。

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

`202` 的意思是「存下了」，不是「成功了」。WebSocket 的
[`received`](./websocket.md#received) 会带回服务端实际存下的那份计划，动作结果要到
下一份 [`state.events`](./resolution-results.md) 才有。

请求被拒的话什么都不会变，最后那份有效计划照旧。

## 安全重试

幂等键是 8-128 个可见 ASCII 字节（`0x21`-`0x7e`），不能有空格、Tab 和换行。

| 你发送的内容 | 服务端行为 |
|---|---|
| 相同 key，请求体逐字节相同 | 返回已保存的响应，不会再次保存或广播计划。 |
| 相同 key，JSON 含义相同但空白或 key 顺序不同 | 返回 `409 IDEMPOTENCY_CONFLICT`。 |
| 相同 key，数据不同 | 返回 `409 IDEMPOTENCY_CONFLICT`。 |
| 新 key | 作为新的计划替换请求处理。 |

如果上传之后断线、你也不知道到底发出去没有，就用同一个 key 把完全一样的字节再发
一次。只有当你真的重新做了一份计划，才换新 key。

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

保存这一步之前出的任何错，都会拒掉整份请求。而之后在游戏结算里失败，既不会把旧计划
找回来，也不会改变你已经拿到的那个 `202`。

## 并发和频率限制

- 同一个 `(player, credential kind)` 最多同时读四个命令请求体。多出来的会拿到
  `429 COMMAND_CONCURRENCY_LIMIT`，带 `Retry-After: 1`。
- 同一个 `(player, Tick, source)` 在幂等检查之后最多接收 64 个新请求，无效命令也算
  在里面。再多就是 `429 COMMAND_RATE_LIMITED`。
- 同一个计划槽里的有效请求按进入 gate 的顺序处理，最后成功的那份替换前一份。

所有 HTTP 错误和校验原因，见[错误与恢复](./errors.md)。
