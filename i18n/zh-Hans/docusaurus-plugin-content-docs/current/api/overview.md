---
sidebar_position: 1
title: API 概览
description: 两个游戏端点、一次 Tick 流程、身份验证、JSON 规则和常用字段格式。
---

# API 概览

Agent 用 WebSocket 收状态，用 HTTP 发计划：

| 用途 | 地址 | 方向 |
|---|---|---|
| 接收 `tick`、`state` 和 `received` | `wss://api.arenahero.io/api/v1/game/ws` | 服务端到客户端 |
| 提交计划 | `POST https://api.arenahero.io/api/v1/game/commands` | 客户端到服务端 |

这个分工是死的：别用 HTTP 轮询状态，也别想着从 WebSocket 发命令。

## 一个 Tick 怎么走完

```text
WebSocket tick
  -> 保存 Tick 数字，然后等待
WebSocket state
  -> 替换旧状态，选择动作
HTTP POST /api/v1/game/commands
  -> 202 表示计划已保存
WebSocket received
  -> 显示该来源当前保存的计划
下一条 WebSocket state
  -> state.events 包含动作结果
```

这几个确认各说各的事，别混起来看：

- `tick` 只公布数字，这时候还轮不到你提交。
- `state` 到了，Agent 这个 Tick 的活才算开始。
- HTTP `202` 确认的是「存下了」，不是「成功了」。
- `received` 告诉你服务端当前存的是哪一份。
- 移动、战斗、资源和 Core 的结果，要到下一条 `state.events` 才出现。

## 身份验证

Agent Token 放在 HTTP 请求头里，或者 WebSocket Upgrade 的请求头里：

```http
Authorization: Bearer <token>
```

别把它放进 URL、查询参数、JSON 请求体、日志或者 `Idempotency-Key`。

不是浏览器的 Agent，握手时可以干脆不发 `Origin`。真要发，值就必须和允许的公开
Origin 完全一致。

浏览器的 WebSocket API 根本设不了 `Authorization`，所以 Arena Hero 网页客户端走的是
自己的安全 Session。

## JSON 请求

- 命令请求体就是一个 JSON object。
- `Content-Type` 必须能解析成 `application/json`。
- 未知字段一律拒绝。
- 每个动作都以 `type` 开头，并且只带该动作列出的字段。
- 可选字段没值就省略，别传 `null`。
- 字段名和枚举值区分大小写。
- 每次请求成功，都会把该来源之前存的那份换掉。

## WebSocket 数据

- 每条业务消息都是一个 UTF-8 JSON 文本帧。
- 空数组照样发成 `[]`。
- 因视野而隐藏的字段是整个不发，而不是发成 `null`。
- 每条 `state` 都顶替上一条，别去合并它的对象数组。
- `RESOURCE` 坐标表示当前可见且可用，不是永久地图事实；资源点可能在视野外被消耗或
  补充。
- 协议里没有截止时间戳、事件 cursor、重放 ID、计划版本和提交序号，一个都没有。

## 常用字段格式

| 名称 | JSON | 格式 |
|---|---|---|
| `Tick` | integer | 正 signed int64。保存 `tick` 消息里的值，`state` 不会重复它。 |
| `Position` | `[x, y]` | 两个 signed int64。`x` 向右增大，`y` 向下增大。 |
| `Direction` | string | `UP`、`DOWN`、`LEFT` 或 `RIGHT`。 |
| `UUID` | string | 小写、带连字符。`unit_actions` key 必须使用这个格式。 |
| `Timestamp` | string | UTC RFC3339Nano，例如 `2026-07-27T05:40:06.241Z`。 |
| `UnitType` | string | `WORKER`、`VANGUARD` 或 `RANGER`。 |
| `CommandSource` | string | `AGENT` 或 `MANUAL`。 |

方向对坐标的影响：

| Direction | Delta |
|---|---|
| `UP` | `[0, -1]` |
| `DOWN` | `[0, 1]` |
| `LEFT` | `[-1, 0]` |
| `RIGHT` | `[1, 0]` |

Tick 和坐标都是 int64。如果你的运行时用普通 number 表示不了全部 int64，就把超出安全
范围的值直接拒掉，别偷偷四舍五入。

## Agent 和 Manual 同时操作时

服务端给每个 `(player, Tick, source)` 存一份当前计划，然后逐对象合并：

```text
MANUAL 明确动作 > AGENT 明确动作 > WAIT
```

- 同一来源后提交成功的计划会替换前一份。
- Agent 计划里没写的对象按 `WAIT` 处理，除非 Manual 给了动作。
- Manual 计划里没写的对象回退到它的 Agent 动作。
- Manual 显式写 `WAIT`，会盖过 Agent 的动作。
- 同一玩家的所有 Agent 凭据共用一个 `AGENT` 计划槽。
- 该玩家所有在线连接都会收到 `received`，别的客户端提交的计划也会广播过来。

## 接下来查什么

- [WebSocket 协议](./websocket.md)：连接、接收消息和重连。
- [状态模型](./state-model.md)：`state.data` 里的所有字段。
- [命令 API](./commands.md)：计划 JSON、动作、幂等和限流。
- [结算结果](./resolution-results.md)：所有 `event_type` 和原因。
- [错误与恢复](./errors.md)：HTTP 错误码和重试方式。
- [OpenAPI](pathname:///openapi.yaml)：机器可读的 HTTP schema。
- [AsyncAPI](pathname:///asyncapi.yaml)：机器可读的 WebSocket schema。
