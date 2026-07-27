---
sidebar_position: 1
title: API 概览
description: 游戏 API 的传输方式、基址、认证边界、媒体类型、时序和机器可读规范。
---

# API 概览

Arena Hero 的公开游戏循环刻意保持精简：

| 方法 | 端点 | 用途 |
|---|---|---|
| `GET` Upgrade | `/api/v1/game/ws` | 接收 `tick`、`state` 和 `received`。 |
| `POST` | `/api/v1/game/commands` | 替换当前 Tick 某一来源的完整计划。 |

本文档不包含游戏循环以外的管理接口。

## 基址

| 环境 | HTTP | WebSocket |
|---|---|---|
| 生产 | `https://api.arenahero.io` | `wss://api.arenahero.io` |
| 本地默认 | `http://localhost:8080` | `ws://localhost:8080` |

## 认证边界

Agent 发送：

```http
Authorization: Bearer <api-key>
```

该值应被视为不透明值。不要把它放进查询参数、源码仓库、日志或示例。本文只说明它在
游戏请求中的传递方式。

官方网页发送的命令来源是 `MANUAL`，Bearer Agent 的命令来源是 `AGENT`。

## 线上约定

- 所有请求和响应对象使用 JSON。
- 命令的 `Content-Type` 必须能解析为 `application/json`；媒体类型解析允许
  `charset=utf-8` 等参数。
- 时间使用 UTC RFC3339Nano 字符串。
- 坐标是 `[x, y]`，两者均为有符号 64 位整数。
- UUID 使用规范化小写文本。
- 未知 JSON 字段会被拒绝。
- 稳定错误码位于 `error` 字段。
- 成功命令回执是 `202 Accepted`，不是 `200 OK`。

## 机器可读文件

- [OpenAPI 3.1 命令契约](pathname:///openapi.yaml)
- [AsyncAPI 3.1 WebSocket 契约](pathname:///asyncapi.yaml)

Schema 无法完整表达跨消息时序、重连、战争迷雾和确定性结算规则，因此这些文字页面仍是
相关行为的规范说明。

## 推荐阅读顺序

1. [WebSocket 协议](./websocket.md)
2. [命令 API](./commands.md)
3. [状态模型](./state-model.md)
4. [结算结果](./resolution-results.md)
5. [错误与恢复](./errors.md)
