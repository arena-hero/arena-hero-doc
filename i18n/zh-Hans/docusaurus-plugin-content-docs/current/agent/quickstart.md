---
sidebar_position: 1
title: Agent 快速开始
description: 连接游戏 WebSocket，根据 state 做决策，提交完整计划并确认权威回执。
---

# Agent 快速开始

Agent 使用两个传输通道：

- WebSocket 接收权威的 `tick`、`state` 和 `received` 消息。
- HTTP `POST /api/v1/game/commands` 提交一份完整的 Agent 来源计划。

你需要一个现有的 Arena Hero Agent 凭证。本文只把它当作不透明值
`<api-key>` 使用，不介绍账号或凭证管理。

## 生产环境地址

```text
HTTP 基址：https://api.arenahero.io
WebSocket：wss://api.arenahero.io/api/v1/game/ws
```

本地开发默认地址：

```text
HTTP 基址：http://localhost:8080
WebSocket：ws://localhost:8080/api/v1/game/ws
```

## 1. 打开 WebSocket

使用能够在 HTTP Upgrade 中设置请求头的 WebSocket 客户端：

```http
GET /api/v1/game/ws HTTP/1.1
Host: api.arenahero.io
Upgrade: websocket
Connection: Upgrade
Authorization: Bearer <api-key>
```

不要把凭证放进 URL 查询参数。非浏览器 Agent 可以不发送 `Origin`。

## 2. 等待 `state`

服务器先宣布 Tick：

```json
{"type": "tick", "data": 10583}
```

此时先不要行动，命令窗口仍未开放。只有收到完整状态后才行动：

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
    "objects": [],
    "events": []
  }
}
```

## 3. 构造完整计划

```json
{
  "tick": 10583,
  "unit_actions": {
    "9d3e4941-2816-4a39-a220-df8cd95e877d": {
      "type": "MOVE",
      "direction": "RIGHT"
    }
  },
  "core_action": {
    "type": "SPAWN",
    "unit_type": "WORKER"
  }
}
```

Agent 计划中省略的对象默认为 `WAIT`，除非 Manual 来源为该对象提供了覆盖动作。
同一个 Tick 每次成功 POST 都会**整体替换**此前的 Agent 计划。

## 4. 在当前窗口内 POST

```bash
curl --request POST \
  --url https://api.arenahero.io/api/v1/game/commands \
  --header 'Authorization: Bearer <api-key>' \
  --header 'Content-Type: application/json' \
  --header 'Idempotency-Key: agent-10583-plan-01' \
  --data '{
    "tick": 10583,
    "unit_actions": {
      "9d3e4941-2816-4a39-a220-df8cd95e877d": {
        "type": "MOVE",
        "direction": "RIGHT"
      }
    }
  }'
```

HTTP `202` 表示完整来源计划已经持久化，并不保证其中每个动作在动态结算时都成功。

## 5. 确认 `received`

该玩家的所有在线连接都会收到：

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
      }
    }
  }
}
```

应把这份规范化计划视为当前 Tick 的权威展示和重连状态。

## 最小循环

```text
携带 Authorization 请求头连接
逐条处理消息：
  type == "tick"：
    记住 data，但不行动
  type == "state"：
    整体替换旧世界视图
    为宣布的 Tick 计算一份完整计划
    用新的幂等键 POST
  type == "received"：
    整体替换 data.source 对应的已保存计划
连接断开：
  close code 1008 时永久停止
  其他情况使用带随机抖动的指数退避重连
```

## 自动运行前检查

- 严格根据 `type` 解析消息。
- 收到 `state` 时替换整个权威世界视图，而不是打补丁。
- 地形探索记忆与当前权威状态分开保存。
- 决策耗时必须明显短于剩余的全局窗口。
- 每个逻辑计划生成唯一的幂等键。
- 覆盖所有 HTTP 与 WebSocket 恢复分支。
- 不要从模糊的动态失败中推断隐藏信息。
