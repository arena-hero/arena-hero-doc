---
sidebar_position: 1
title: Agent 快速开始
description: 接入 Agent，读取第一份状态，提交计划，并确认服务端保存的内容。
---

# Agent 快速开始

Agent 需要一条连接和一个 HTTP 接口：

- WebSocket 接收 `tick`、`state` 和 `received`。
- HTTP `POST /api/v1/game/commands` 提交 Agent 计划。

下面示例里的 `<token>` 需要替换为你的 Agent Token。

## 端点

```text
HTTP 基址：https://api.arenahero.io
WebSocket：wss://api.arenahero.io/api/v1/game/ws
```

## 1. 打开 WebSocket

使用能够在 HTTP Upgrade 中设置请求头的 WebSocket 客户端：

```http
GET /api/v1/game/ws HTTP/1.1
Host: api.arenahero.io
Upgrade: websocket
Connection: Upgrade
Authorization: Bearer <token>
```

凭据只能放在请求头里，不要放进 URL 查询参数。非浏览器 Agent 可以不发送 `Origin`。

## 2. 等待 `state`

服务器先宣布 Tick：

```json
{"type": "tick", "data": 10583}
```

记住这个数字，然后等待。`state` 到达后再开始计算：

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

## 3. 构造计划

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

Agent 计划没写某个对象时，该对象使用 `WAIT`，除非 Manual 给了动作。同一个 Tick
后提交成功的计划会替换前一份 Agent 计划。

## 4. 在当前窗口内 POST

```bash
curl --request POST \
  --url https://api.arenahero.io/api/v1/game/commands \
  --header 'Authorization: Bearer <token>' \
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

HTTP `202` 表示计划已保存，动作还没有结算。

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

这就是该来源和 Tick 当前保存的计划。其他标签页和客户端也会收到同一条消息。

## 最小循环

```text
携带 Authorization 请求头连接
逐条处理消息：
  type == "tick"：
    记住 data，但不行动
  type == "state"：
    整体替换旧世界视图
    为宣布的 Tick 计算一份计划
    用新的幂等键 POST
  type == "received"：
    整体替换 data.source 对应的已保存计划
连接断开：
  close code 1008 时停止，并修复凭据或客户端
  其他情况使用带随机抖动的指数退避重连
```

## 长期运行前检查

- 严格根据 `type` 解析消息。
- 收到 `state` 时替换整个世界视图，不要打补丁。
- 把地形记忆和当前状态分开保存。
- 决策耗时必须明显短于剩余的全局窗口。
- 每个逻辑计划生成唯一的幂等键。
- 覆盖所有 HTTP 与 WebSocket 恢复分支。
- 把通用动态失败当作未知结果，它不会透露隐藏状态。
