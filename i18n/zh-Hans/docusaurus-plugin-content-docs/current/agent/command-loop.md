---
sidebar_position: 2
title: 可靠的命令循环
description: 面向生产使用的 Agent 状态机，覆盖计时、整体替换、回执、重连与安全重试。
---

# 可靠的命令循环

## 推荐的客户端状态

分别保存这些值：

```text
announced_tick
latest_state
latest_received.AGENT
latest_received.MANUAL
connection_phase
reconnect_attempt
terrain_memory
```

不要把一条 WebSocket 连接本身当作事实来源。它只是传输最新权威快照和回执状态的通道。

## 状态机

```mermaid
stateDiagram-v2
  [*] --> Connecting
  Connecting --> Preparing: tick
  Preparing --> Open: state
  Open --> Open: received
  Open --> Settling: 尚未宣布下一 Tick
  Settling --> Preparing: tick
  Connecting --> Backoff: 瞬时故障
  Preparing --> Backoff: 瞬时故障
  Open --> Backoff: 瞬时故障
  Backoff --> Connecting: 随机退避重试
  Connecting --> Stopped: close 1008
  Preparing --> Stopped: close 1008
  Open --> Stopped: close 1008
```

服务器在结算期间可能保持安静。无消息不等于连接故障，协议级 Ping/Pong 会维护连接活性。

## 决策时序

服务器在发布各玩家状态之前只开放一个全局 15 秒窗口。Agent 不知道准确截止时间，
实际可用时间可能短于 15 秒。

推荐做法：

1. 在窗口外预先计算可复用索引和策略状态。
2. 收到 `state` 后立即开始计算。
3. 使用明显短于 15 秒的内部截止时间。
4. 宁可提交安全的部分策略作为一份**完整计划**，也不要错过窗口。
5. 收到 `COMMAND_WINDOW_CLOSED` 后不要持续重试。

## 整体替换语义

先提交：

```json
{
  "tick": 80,
  "unit_actions": {
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa": {"type": "MOVE", "direction": "UP"},
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb": {"type": "WAIT"}
  }
}
```

随后提交：

```json
{
  "tick": 80,
  "unit_actions": {
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa": {"type": "MOVE", "direction": "LEFT"}
  }
}
```

意味着 Unit B 已不在 Agent 计划中显式出现。除非 Manual 来源提供动作，否则它结算为
`WAIT`。服务器不会从此前 Agent 请求中保留 Unit B。

## 安全重试矩阵

| 结果 | 是否重试 | 行为 |
|---|---|---|
| 收到响应前网络失败 | 是 | 使用相同幂等键和完全相同的请求体重试。 |
| `202 Accepted` | 否 | 等待 `received`；计划已持久化。 |
| 相同幂等键重放 | 无额外效果 | 返回原响应，不重复广播 `received`。 |
| `TICK_NOT_READY` | 稍后 | 等待 `state` 或重连。 |
| `COMMAND_WINDOW_CLOSED` | 该 Tick 不重试 | 等待下一个 `state`。 |
| `TICK_MISMATCH` | 重新计算 | 绝不能只改旧计划中的 Tick 数字。 |
| `INVALID_COMMAND` | 修正一次 | 修正整份计划；旧的有效计划仍保持生效。 |
| `COMMAND_RATE_LIMITED` | 该来源/该 Tick 不重试 | 保留最新有效计划。 |
| `UNAUTHORIZED` 或 WS `1008` | 停止 | 修复凭证或客户端后再运行。 |

## 重连快照

在 OPEN 阶段重连会按以下顺序收到：

1. 当前 `tick`；
2. 完整的当前 `state`；
3. 最新 `AGENT` 来源 `received`（如有）；
4. 最新 `MANUAL` 来源 `received`（如有）。

命令窗口不会因普通重连延长。使用快照整体替换本地值。

状态准备期间重连会先收到 `tick`，准备完成后再收到 `state`。结算期间不会重放旧数据，
而是等待下一个真实 Tick。

## 退避

从 250 ms 开始，每次失败后翻倍，最大 5 秒，并加入随机抖动。成功连接后重置为
250 ms。收到关闭码 `1008` 后不要重连。

## 心跳

服务器每 20 秒发送协议级 Ping，并要求 60 秒内收到 Pong。标准 WebSocket 库通常自动响应。

不要发送自定义心跳 JSON。服务器不接受客户端业务帧，违反策略时会以 `1008` 关闭连接。
