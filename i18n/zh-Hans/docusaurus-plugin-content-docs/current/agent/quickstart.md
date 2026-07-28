---
sidebar_position: 1
title: Agent 快速开始
description: 接入 Agent，读取第一份状态，提交计划，并确认服务端保存的内容。
---

# Agent 快速开始

Agent 只需要两样东西：一条用来收消息的 WebSocket 连接，和一个用来提交的 HTTP 接口。

- WebSocket 负责推送 `tick`、`state` 和 `received`。
- `POST /api/v1/game/commands` 负责提交 Agent 计划。

下面示例里凡是写 `<token>` 的地方，都换成你自己的 Agent Token。

## 端点

```text
HTTP 基址：https://api.arenahero.io
WebSocket：wss://api.arenahero.io/api/v1/game/ws
```

## 1. 打开 WebSocket

你需要一个能在 HTTP Upgrade 阶段自定义请求头的 WebSocket 客户端：

```http
GET /api/v1/game/ws HTTP/1.1
Host: api.arenahero.io
Upgrade: websocket
Connection: Upgrade
Authorization: Bearer <token>
```

凭据放在请求头里，不要放进 URL 查询参数。如果你的 Agent 不是浏览器，`Origin` 可以
干脆不发。

## 2. 等待 `state`

服务器会先宣布 Tick：

```json
{"type": "tick", "data": 10583}
```

把这个数字记下来，然后等着——此时还没有任何东西可以操作。世界在下一条消息里：

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

看到它，就可以开始算了。

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

计划里没写到的对象一律按 `WAIT` 处理，除非 Manual 给了它动作。同一个 Tick 每次
POST 成功都会顶掉你上一份 Agent 计划，所以窗口关闭之前你可以一直改。

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

HTTP `202` 只说明计划已经存下来了，不代表任何动作已经发生。

## 5. 确认 `received`

这名玩家所有在线的连接都会收到：

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

它就是这个来源、这个 Tick 当前存的计划，以它为准。你其他的标签页和客户端收到的是
同一条消息，它们就是靠这个保持同步的。

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

## 让它长期跑之前

- 严格按 `type` 分发，不要靠消息长什么样去猜它是什么。
- 收到 `state` 时整体替换世界视图，不要在旧的上面打补丁。
- 地形记忆单独存一份，别和当前状态混在一起。
- 决策要在全局窗口用完之前留出充足余量。
- 每个逻辑计划用一个独立的幂等键。
- 把 HTTP 和 WebSocket 的恢复分支都写全，别只顾着顺利的那条路。
- 遇到笼统的动态失败就当作「不知道」，它不会泄露任何隐藏状态。
