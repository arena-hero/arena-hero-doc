---
sidebar_position: 6
title: 错误与恢复
description: 稳定 HTTP 错误封装、命令错误、验证原因、WebSocket 故障与重试行为。
---

# 错误与恢复

## HTTP 封装

```json
{
  "error": "STABLE_CODE",
  "message": "optional safe explanation"
}
```

命令拒绝通常还包含 `"accepted": false`，静态命令错误另有 `details` 数组。

## 传输与请求错误

| 状态 | 代码 | 恢复方式 |
|---:|---|---|
| 400 | `INVALID_JSON` | 只发送一个有效 JSON 对象，不含未知字段。 |
| 400 | `IDEMPOTENCY_KEY_INVALID` | 使用 8–128 个可见 ASCII 字节。 |
| 401 | `UNAUTHORIZED` | 停止并修复凭证。 |
| 409 | `IDEMPOTENCY_CONFLICT` | 绝不能让不同请求体复用同一键。 |
| 413 | `REQUEST_BODY_TOO_LARGE` | 缩小完整计划请求体。 |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | 发送 `Content-Type: application/json`。 |
| 429 | `COMMAND_CONCURRENCY_LIMIT` | 减少并发上传；`Retry-After: 1`。 |
| 500 | `INTERNAL_ERROR` | 如果结果未知，使用相同键谨慎重试。 |

## 命令门与 Tick 错误

| 状态 | 代码 | 恢复方式 |
|---:|---|---|
| 409 | `COMMAND_WINDOW_CLOSED` | 等待下一份 `state`，不要持续重试该 Tick。 |
| 409 | `TICK_MISMATCH` | 丢弃旧决策输入，依据当前状态重新计算。 |
| 503 | `TICK_NOT_READY` | 等待 `state` 或重连。 |
| 429 | `COMMAND_RATE_LIMITED` | 停止该来源/该 Tick 的提交；最新有效计划保持不变。 |

`TICK_MISMATCH` 持久化响应可以同时包含提交的 `tick` 与 `current_tick`。

## 静态验证

`422 INVALID_COMMAND` 包含一项或多项详情：

```json
{
  "accepted": false,
  "error": "INVALID_COMMAND",
  "details": [
    {"reason": "TICK_MUST_BE_POSITIVE"},
    {
      "unit_id": "9d3e4941-2816-4a39-a220-df8cd95e877d",
      "reason": "UNIT_NOT_OWNED"
    }
  ]
}
```

常见原因：

- `TICK_MUST_BE_POSITIVE`
- `UNIT_NOT_OWNED`
- `UNKNOWN_ACTION_TYPE`
- `UNKNOWN_CORE_ACTION_TYPE`
- `UNEXPECTED_ACTION_FIELDS`
- `INVALID_DIRECTION`
- `INVALID_UNIT_TYPE`
- `TARGET_ID_REQUIRED`
- `EXPECTED_CELL_REQUIRED`
- `<UNIT_TYPE>_CANNOT_<ACTION>`

此前的有效计划不会被修改。

## WebSocket 恢复

握手错误见 [WebSocket 协议](./websocket.md)。

瞬时关闭使用 250 ms 到 5 秒的带随机抖动指数退避重连。收到 `1008` 时停止。
收到 `1013` 时，丢弃“所有增量实时消息都已送达”的本地假设，并根据重连快照重建。

## 避免不安全重试

不要：

- 仅因响应丢失就生成新幂等键；
- 把依据旧状态计算的计划只改 Tick 数字；
- 假设 HTTP 超时就等于请求被拒绝；
- 提交自定义心跳帧；
- 探测隐藏目标 UUID，并把 `SHOT_MISSED` 当作目标存在性的证据。
