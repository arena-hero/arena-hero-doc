---
sidebar_position: 2
title: WebSocket
description: 建立一条连接，处理三种服务端消息，并在断线后恢复。
toc_min_heading_level: 2
toc_max_heading_level: 3
---

# WebSocket

Agent 启动时建立连接，然后保持连接：

```text
wss://api.arenahero.io/api/v1/game/ws
```

这条连接只接收游戏状态和计划回执。命令通过
[`POST /api/v1/game/commands`](./commands.md) 提交，不通过 WebSocket 发送。

<nav className="api-model-nav" aria-label="WebSocket 章节">
  <strong>快速跳转</strong>
  <a href="#game-loop">游戏循环</a>
  <a href="#messages">消息</a>
  <a href="#connect">连接</a>
  <a href="#reconnect">重连</a>
  <a href="#connection-policy">限制与心跳</a>
</nav>

## 游戏循环 {#game-loop}

| 步骤 | 消息或请求 | 客户端行为 |
|---:|---|---|
| 1 | 收到 `tick` | 保存 Tick 数字，等待 `state`。 |
| 2 | 收到 `state` | 替换本地状态，计算并提交计划。 |
| 3 | POST 命令计划 | 使用与该状态对应的 Tick。 |
| 4 | 收到 `received` | 保存服务端为该来源存下的计划。 |
| 5 | 收到下一条 `state` | 替换本地状态并读取上一 Tick 的结果。 |

```text
tick(N)
  → state
  → 零条或多条 received
  → N 结算期间保持安静
  → tick(N + 1)
  → 包含 N 结算结果的 state
```

命令窗口全局固定为 15 秒，并在玩家状态发布前打开。收到 `state` 后立即行动，
但不要假设此时还剩完整 15 秒。

## 消息 {#messages}

每条服务端消息都是一个 UTF-8 JSON 文本帧，且只有两个顶层字段：

| `type` | `data` 内容 | 含义 |
|---|---|---|
| `"tick"` | 正 int64 | 新 Tick 正在准备；等待 `state`。 |
| `"state"` | [`PlayerState`](./state-model.md) | 替换本地状态；现在可以提交计划。 |
| `"received"` | 已保存计划的回执 | 服务端替换了某个来源的计划。 |

先解析 `type`，再解析 `data`。协议没有增量 patch、cursor、重放 offset，
也没有客户端发往服务端的业务消息。

### `tick`

```json
{
  "type": "tick",
  "data": 10583
}
```

保存 `10583` 作为当前 Tick。后续 `state` 属于这个 Tick；
`state.data` 不会重复该数字。

收到 `tick` 时，服务端还在准备每个玩家看到的状态。等 `state` 到达后再提交。

### `state`

```json
{
  "type": "state",
  "data": {
    "status": "ACTIVE",
    "resources": 20,
    "population": 1,
    "population_tier": 0,
    "upkeep_next_tick": 0,
    "champion_beacon": {"position": [0, 0]},
    "objects": [
      {
        "kind": "CORE",
        "id": "2ea3c3dc-42b0-4b92-9754-7558bd4ff834",
        "controlled": true,
        "position": [12, 8],
        "hp": 5,
        "shield": 5,
        "state": "NORMAL"
      },
      {
        "kind": "UNIT",
        "id": "9d3e4941-2816-4a39-a220-df8cd95e877d",
        "controlled": true,
        "position": [11, 8],
        "hp": 2,
        "unit_type": "WORKER",
        "cargo": 0
      }
    ],
    "events": []
  }
}
```

收到 `state` 后：

1. 整体替换上一份状态；
2. 将它与最近的 `tick` 关联；
3. 计算一份计划；
4. 在当前窗口关闭前 POST 计划。

所有己方实体都会出现。敌方实体和地形仅在当前可见时出现。
全部字段见[状态模型](./state-model.md)，`events` 见[结算结果](./resolution-results.md)。

### `received`

```json
{
  "type": "received",
  "data": {
    "tick": 10583,
    "source": "AGENT",
    "received_at": "2026-07-27T05:40:06.241Z",
    "plan": {
      "tick": 10583,
      "unit_actions": {
        "9d3e4941-2816-4a39-a220-df8cd95e877d": {
          "type": "MOVE",
          "direction": "RIGHT"
        }
      },
      "core_action": {"type": "WAIT"}
    }
  }
}
```

| 字段 | 格式 | 含义 |
|---|---|---|
| `tick` | 正 int64 | 已保存计划所属的 Tick。 |
| `source` | `"AGENT"` 或 `"MANUAL"` | 被替换的计划槽。 |
| `received_at` | RFC3339Nano UTC 字符串 | 计划写入数据库的时间。 |
| `plan` | [`CommandPlan`](./commands.md#commandplan-model) | 该来源当前保存的计划。 |

新的成功计划会把 `received` 广播到该玩家的所有实时连接，包括其他标签页和客户端。

每个来源各保存最新回执。新的 `AGENT` 回执只替换旧 `AGENT` 回执，
`MANUAL` 回执保持独立。

以下情况不会广播 `received`：

- 请求被拒绝；
- 隐式默认 `WAIT`；
- 已完成请求的幂等重放。

回执确认计划已保存，不代表动作成功。动作结果在下一条
`state.data.events` 中。

### 分发示例

```js
function onMessage(frame) {
  const message = JSON.parse(frame);

  if (message.type === 'tick') currentTick = message.data;
  else if (message.type === 'state') onState(currentTick, message.data);
  else if (message.type === 'received') onReceipt(message.data);
}
```

先检查 `type`，再读取 `data`。如果客户端要忽略未知消息类型，应把它当成明确的
兼容策略。

## 连接 {#connect}

非浏览器 Agent 在 Upgrade 请求中发送凭据：

```http
GET /api/v1/game/ws HTTP/1.1
Host: api.arenahero.io
Authorization: Bearer <token>
Upgrade: websocket
Connection: Upgrade
```

| 客户端 | 凭据 | `Origin` |
|---|---|---|
| 非浏览器 Agent | `Authorization: Bearer <token>` | 可以省略；若携带则必须受允许。 |
| Arena Hero 网页客户端 | 安全 Session Cookie | 必须存在，并与允许的公开 origin 完全一致。 |

不支持把凭据放进 URL 或查询字符串。

### 握手错误

连接升级前，错误使用普通 HTTP JSON：

| 状态 | `error` | 恢复方式 |
|---:|---|---|
| 401 | `UNAUTHORIZED` | 替换缺失、无效、已撤销或失效的凭据。 |
| 403 | `WEBSOCKET_ORIGIN_INVALID` | 修正缺失、格式错误、重复或不受允许的 `Origin`。 |
| 409 | `PLAYER_NOT_READY` | 等待服务端为该玩家启动 Tick。 |
| 429 | `REALTIME_CONNECTION_LIMIT` | 按 `Retry-After: 1` 等待后重连。 |

## 重连 {#reconnect}

重连数据取决于服务端当前阶段：

| 阶段 | 重连后的消息 |
|---|---|
| 正在准备状态 | 当前 `tick`；就绪后发送 `state`。 |
| 命令窗口 `OPEN` | 当前 `tick`、当前 `state`、已有的最新 `AGENT` 回执和最新 `MANUAL` 回执。 |
| 正在结算 | 不发送过期内容；等待下一条 `tick`。 |
| 崩溃后恢复 `OPEN` | 同一 Tick、重建状态、恢复回执，以及重新开放的完整 15 秒窗口。 |

这是当前快照，不是消息历史。用重连后收到的内容替换本地状态和回执假设。

```text title="建议重试循环"
delay = 250ms

连接
if 连接成功:
  delay = 250ms
  持续读取直到关闭
if close code == 1008:
  停止并修复凭据或客户端
otherwise:
  等待 random_jitter(delay)
  delay = min(delay × 2, 5s)
```

普通命令窗口不会因为重连而延长。

## 限制与心跳 {#connection-policy}

WebSocket 只承载服务端发往客户端的业务消息。

| 属性 | 值 |
|---|---|
| WebSocket Ping 间隔 | 20 秒 |
| Pong 截止 | 60 秒 |
| 凭据复查 | 约每 5 秒 |
| 单条服务端消息写入截止 | 10 秒 |
| 客户端入站帧上限 | 1024 bytes |
| 压缩 | 禁用 |

正常 WebSocket 库会自动回应协议 Ping。不要通过这条连接发送心跳 JSON、
命令 JSON 或二进制业务帧。

### 关闭码 {#close-codes}

| Code | 含义 | 客户端行为 |
|---:|---|---|
| 1000 | 正常关闭 | 只有仍需继续运行时才重连。 |
| 1001 | 服务端关闭或心跳失败 | 使用随机抖动退避重连。 |
| 1008 | 凭据失效或客户端发送禁止帧 | 停止重试并修复客户端或凭据。 |
| 1011 | 流或凭据检查内部失败 | 退避重连。 |
| 1013 | 慢客户端队列溢出 | 丢弃投递假设，通过重连快照重建。 |

WebSocket 关闭不表示 HTTP 命令被拒绝。如果 HTTP 响应丢失，
请用相同 `Idempotency-Key` 重试完全相同的请求体。
