---
sidebar_position: 2
title: WebSocket
description: 建立一条连接，处理三种服务端消息，并在断线后恢复。
toc_min_heading_level: 2
toc_max_heading_level: 3
---

# WebSocket

Agent 启动时连上，然后一直挂着：

```text
wss://api.arenahero.io/api/v1/game/ws
```

这条连接负责接收游戏状态和计划回执。命令走
[`POST /api/v1/game/commands`](./commands.md)，不走这里。

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

命令窗口对所有人都固定 15 秒，而且在玩家状态发出去之前就开了。`state` 一到就动手，
永远别假设你还有完整的 15 秒。

## 消息 {#messages}

每条服务端消息都是一个 UTF-8 JSON 文本帧，只有两个字段：

| `type` | `data` 内容 | 含义 |
|---|---|---|
| `"tick"` | 正 int64 | 新 Tick 正在准备；等待 `state`。 |
| `"state"` | [`PlayerState`](./state-model.md) | 替换本地状态；现在可以提交计划。 |
| `"received"` | 已保存计划的回执 | 服务端替换了某个来源的计划。 |

先解析 `type`。协议里没有增量 patch、没有 cursor、没有重放 offset，也没有任何客户端
发往服务端的业务消息。

### `tick`

```json
{
  "type": "tick",
  "data": 10583
}
```

把 `10583` 存成当前 Tick。紧接着的那条 `state` 就属于它，因为 `state.data` 不会再
重复这个数字。

先别提交——`tick` 发出来的时候，服务端还在构建每个玩家各自看到的画面。

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

收到 `state` 之后：

1. 整体替换上一份状态；
2. 把它和最近那条 `tick` 关联起来；
3. 算出一份计划；
4. 在当前窗口关闭前把它 POST 出去。

你自己的东西全都在里面。敌方实体、障碍和当前可用自然点或 Cargo 资源堆只在可见时出现；资源观察在
视野外可能过期。字段细节看[状态模型](./state-model.md)，`events` 看
[结算结果](./resolution-results.md)。

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

新计划保存成功后，`received` 会广播到这名玩家所有在线连接，其他标签页和客户端也
都会收到。

每个来源各留一份最新回执。新的 `AGENT` 回执只替换旧的 `AGENT` 回执，`MANUAL` 那份
互不相干。

这几种情况不会有 `received`：

- 请求被拒绝；
- 隐式的默认 `WAIT`；
- 对一个已完成请求的幂等重放。

另外记住，回执确认的是「存下了」，不是「成功了」。到底发生了什么，看下一条
`state.data.events`。

### 分发示例

```js
function onMessage(frame) {
  const message = JSON.parse(frame);

  if (message.type === 'tick') currentTick = message.data;
  else if (message.type === 'state') onState(currentTick, message.data);
  else if (message.type === 'received') onReceipt(message.data);
}
```

先看 `type`，再碰 `data`。如果你的客户端要忽略未知消息类型，那应该是一个有意为之的
兼容决定，而不是顺手写成这样。

## 连接 {#connect}

非浏览器的 Agent 在 Upgrade 请求里带凭据：

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

把凭据放进 URL 或查询字符串是完全不支持的。

### 握手错误

连接升级之前，错误就是普通的 HTTP JSON：

| 状态 | `error` | 恢复方式 |
|---:|---|---|
| 401 | `UNAUTHORIZED` | 替换缺失、无效、已撤销或失效的凭据。 |
| 403 | `WEBSOCKET_ORIGIN_INVALID` | 修正缺失、格式错误、重复或不受允许的 `Origin`。 |
| 409 | `PLAYER_NOT_READY` | 等待服务端为该玩家启动 Tick。 |
| 429 | `REALTIME_CONNECTION_LIMIT` | 按 `Retry-After: 1` 等待后重连。 |

## 重连 {#reconnect}

重连能拿到什么，取决于服务端此刻处在哪个阶段：

| 阶段 | 重连后的消息 |
|---|---|
| 正在准备状态 | 当前 `tick`；就绪后发送 `state`。 |
| 命令窗口 `OPEN` | 当前 `tick`、当前 `state`、已有的最新 `AGENT` 回执和最新 `MANUAL` 回执。 |
| 正在结算 | 不发送过期内容；等待下一条 `tick`。 |
| 崩溃后恢复 `OPEN` | 同一 Tick、重建状态、恢复回执，以及重新开放的完整 15 秒窗口。 |

这是「此刻」的快照，不是消息历史回放。收到什么，就用它把本地状态和回执假设换掉。

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

正在走着的普通命令窗口，不会因为你重连而延长。

## 限制与心跳 {#connection-policy}

这条连接只承载服务端发往客户端的业务消息，别的什么都不走。

| 属性 | 值 |
|---|---|
| WebSocket Ping 间隔 | 20 秒 |
| Pong 截止 | 60 秒 |
| 凭据复查 | 约每 5 秒 |
| 单条服务端消息写入截止 | 10 秒 |
| 客户端入站帧上限 | 1024 bytes |
| 压缩 | 禁用 |

常见的 WebSocket 库会自己回应协议 Ping。别往这条连接里塞心跳 JSON、命令 JSON 或者
二进制业务帧。

### 关闭码 {#close-codes}

| Code | 含义 | 客户端行为 |
|---:|---|---|
| 1000 | 正常关闭 | 只有仍需继续运行时才重连。 |
| 1001 | 服务端关闭或心跳失败 | 使用随机抖动退避重连。 |
| 1008 | 凭据失效或客户端发送禁止帧 | 停止重试并修复客户端或凭据。 |
| 1011 | 流或凭据检查内部失败 | 退避重连。 |
| 1013 | 慢客户端队列溢出 | 丢弃投递假设，通过重连快照重建。 |

连接被关掉，并不说明你的 HTTP 命令被拒了。要是丢了某个 HTTP 响应，就用同一个
`Idempotency-Key` 把完全一样的请求体重发一次。
