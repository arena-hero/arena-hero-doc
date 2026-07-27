---
sidebar_position: 2
title: WebSocket 协议
description: 握手要求、消息封装、时序、回执、心跳、重连快照和关闭码。
---

# WebSocket 协议

```http
GET /api/v1/game/ws
Authorization: Bearer <api-key>
Upgrade: websocket
```

服务器禁用 WebSocket 压缩，并发送 UTF-8 JSON 文本帧。客户端不能通过该连接发送业务
消息；命令始终通过 HTTP POST 提交。

## 握手

非浏览器 Agent 可以省略 `Origin`。如果提供 `Origin`，规范化后必须与已配置的公开前端
或 API Origin 完全一致。不支持 URL 查询参数中的凭证。

可能的 HTTP 失败：

| 状态 | 错误 | 含义 |
|---:|---|---|
| 401 | `UNAUTHORIZED` | 凭证缺失或不可用。 |
| 403 | `WEBSOCKET_ORIGIN_INVALID` | 浏览器 Origin 不被允许。 |
| 409 | `PLAYER_NOT_READY` | 玩家尚未进入权威 Tick。 |
| 429 | `REALTIME_CONNECTION_LIMIT` | 达到单玩家或全局连接数限制；`Retry-After: 1`。 |

## 消息封装

服务器发送的每条消息都是：

```ts
type ServerMessage =
  | {type: 'tick'; data: number}
  | {type: 'state'; data: PlayerState}
  | {type: 'received'; data: ReceivedPlan};
```

协议没有增量游标，也不依靠事件 ID 做流式补丁。

## `tick`

```json
{"type": "tick", "data": 10583}
```

它宣布真实的逻辑 Tick。服务器仍在准备各玩家状态，命令尚未开放。绝不能只因收到
`tick` 就提交。

## `state`

```json
{
  "type": "state",
  "data": {
    "status": "ACTIVE",
    "resources": 42,
    "population": 67,
    "population_tier": 3,
    "upkeep_next_tick": 6,
    "champion_beacon": {"position": [0, 0]},
    "objects": [],
    "events": []
  }
}
```

`state` 是完整当前视图，也是唯一命令触发器。应整体替换此前的权威状态，而不是把它当作
补丁。

发布状态时，固定 15 秒全局窗口已经开始。收到 `state` 或普通重连都不会重置窗口。

## `received`

```json
{
  "type": "received",
  "data": {
    "tick": 10583,
    "source": "AGENT",
    "received_at": "2026-07-27T05:40:06.241Z",
    "plan": {
      "tick": 10583,
      "unit_actions": {},
      "core_action": {"type": "WAIT"}
    }
  }
}
```

其中 `plan` 是服务器严格解析并保存后的规范化计划。一次新的成功替换会广播给该玩家的
所有连接。幂等重放、请求被拒绝和隐式默认 `WAIT` 不会广播。

分别保存 `AGENT` 和 `MANUAL` 的最新回执。

## 重连行为

| 服务器阶段 | 快照 |
|---|---|
| 正在准备状态 | 当前 `tick`；状态就绪后再发送 `state`。 |
| OPEN | `tick`、完整 `state`、最新 `AGENT` 回执、最新 `MANUAL` 回执。 |
| 正在结算 | 不重放旧状态；等待下一 Tick。 |
| 崩溃恢复后的 OPEN | 同一 Tick 与已恢复回执，并重新开放完整 15 秒窗口。 |

这个流提供的是当前权威重连状态，不是历史记录。

## 心跳与入站策略

- 服务端协议 Ping 间隔：20 秒。
- Pong 超时：60 秒。
- 凭证重新校验：约每 5 秒。
- 入站帧大小限制：1024 字节。
- 客户端文本/二进制业务帧：禁止。
- 压缩：禁用。

## 关闭码

| 代码 | 含义 | 客户端行为 |
|---:|---|---|
| 1000 | 客户端正常关闭 | 仅在需要时重连。 |
| 1001 | 服务器关闭或心跳失败 | 退避重连。 |
| 1008 | 凭证不可用或客户端违反策略 | 停止重试。 |
| 1011 | 实时服务或凭证检查内部错误 | 退避重连。 |
| 1013 | 慢客户端导致权威队列溢出 | 丢弃增量假设并重连。 |
