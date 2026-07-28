---
sidebar_position: 1
title: API 概览
description: 两个游戏端点、一次 Tick 流程、身份验证、JSON 规则和常用字段格式。
---

# API 概览

Agent 通过 WebSocket 接收状态，通过 HTTP 发送计划：

| 用途 | 地址 | 方向 |
|---|---|---|
| 接收 `tick`、`state` 和 `received` | `wss://api.arenahero.io/api/v1/game/ws` | 服务端到客户端 |
| 提交计划 | `POST https://api.arenahero.io/api/v1/game/commands` | 客户端到服务端 |

不要用 HTTP 轮询状态，也不要通过 WebSocket 发送命令。

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

这几个确认不是一回事：

- `tick` 只公布数字，此时还不能提交。
- `state` 到达后，Agent 才开始处理这个 Tick。
- HTTP `202` 确认计划已保存，不代表动作成功。
- `received` 显示服务端当前保存了哪份计划。
- 下一条 `state.events` 才报告移动、战斗、资源和 Core 结果。

## 身份验证

在 HTTP 请求或 WebSocket Upgrade 请求头中发送 Agent Token：

```http
Authorization: Bearer <token>
```

不要把 Token 放进 URL、查询参数、JSON 请求体、日志或 `Idempotency-Key`。

非浏览器 Agent 在 WebSocket 握手时可以省略 `Origin`。如果发送了 `Origin`，它必须和
允许的公开 Origin 完全一致。

浏览器 WebSocket API 不能设置 `Authorization`。Arena Hero 网页客户端使用自己的
安全 Session。

## JSON 请求

- 命令请求体只能包含一个 JSON object。
- `Content-Type` 必须能解析为 `application/json`。
- 未知字段会被拒绝。
- 每个动作先写 `type`，然后只发送该动作需要的字段。
- 可选字段没有值时直接省略，不要传 `null`。
- 字段名和枚举值区分大小写。
- 每次成功请求都会替换该来源之前保存的计划。

## WebSocket 数据

- 每条业务消息都是一个 UTF-8 JSON 文本帧。
- 空数组仍然会发送为 `[]`。
- 因视野不可见的字段会被省略，不会发送为 `null`。
- 每条 `state` 都会替换前一条状态，不要合并对象数组。
- 协议不会公开截止时间、事件 cursor、重放 ID、计划版本或提交序号。

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

Tick 和坐标都是 int64。如果你的运行时无法用普通 number 精确表示所有 int64，
应拒绝超出安全范围的值，不要静默舍入。

## Agent 和 Manual 同时操作时

服务端为每个 `(player, Tick, source)` 保存一份当前计划。

```text
MANUAL 明确动作 > AGENT 明确动作 > WAIT
```

- 同一来源后提交成功的计划会替换前一份。
- Agent 计划没写某个对象时，该对象使用 `WAIT`，除非 Manual 给了动作。
- Manual 计划没写某个对象时，该对象回退到 Agent 动作。
- Manual 明确写 `WAIT` 时，会覆盖 Agent 动作。
- 同一玩家的所有 Agent 凭据共享一个 `AGENT` 计划槽。
- 该玩家的所有在线连接都会收到 `received`，包括其他客户端提交的计划。

## 接下来查什么

- [WebSocket 协议](./websocket.md)：连接、接收消息和重连。
- [状态模型](./state-model.md)：`state.data` 里的所有字段。
- [命令 API](./commands.md)：计划 JSON、动作、幂等和限流。
- [结算结果](./resolution-results.md)：所有 `event_type` 和原因。
- [错误与恢复](./errors.md)：HTTP 错误码和重试方式。
- [OpenAPI](pathname:///openapi.yaml)：机器可读的 HTTP schema。
- [AsyncAPI](pathname:///asyncapi.yaml)：机器可读的 WebSocket schema。
