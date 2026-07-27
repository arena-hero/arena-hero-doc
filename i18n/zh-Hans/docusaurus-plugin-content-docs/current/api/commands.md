---
sidebar_position: 3
title: 命令 API
description: 完整命令请求和回执 Schema、严格动作联合、整体替换、幂等、验证与限制。
---

# 命令 API

```http
POST /api/v1/game/commands
Authorization: Bearer <api-key>
Idempotency-Key: <8..128 个可见 ASCII 字节>
Content-Type: application/json
```

生产环境允许的最大命令体积由服务器部署配置决定；客户端应保持计划紧凑。超大请求体返回
`REQUEST_BODY_TOO_LARGE`。

## 请求

```json
{
  "tick": 10583,
  "unit_actions": {
    "9d3e4941-2816-4a39-a220-df8cd95e877d": {
      "type": "SHOOT",
      "target_id": "175f47f4-f7de-4785-b45c-9a2d2289a8ea",
      "expected_cell": [120, 85]
    }
  },
  "core_action": {
    "type": "SPAWN",
    "unit_type": "VANGUARD"
  }
}
```

### 计划字段

| 字段 | 类型 | 必填 | 规则 |
|---|---|---:|---|
| `tick` | 正 int64 | 是 | 必须等于当前命令 Tick。 |
| `unit_actions` | 以规范化 Unit UUID 为键的对象 | 否 | 只能包含调用者拥有的 Unit；省略或空对象均表示没有显式 Unit 动作，推荐发送 `{}`。 |
| `core_action` | Core 动作或省略 | 否 | 省略表示该来源没有显式 Core 动作。 |

每次 POST 都会整体替换该来源此前的计划，不是增量补丁。

## Unit 动作联合

| 类型 | 允许的 Unit | 必填字段 |
|---|---|---|
| `WAIT` | 全部 | 无 |
| `MOVE` | 全部 | `direction` |
| `HARVEST` | Worker | 无 |
| `DEPOSIT` | Worker | 无 |
| `SWEEP` | Vanguard | `direction` |
| `SHOOT` | Ranger | `target_id`、`expected_cell` |
| `PICKUP_BEACON` | 全部 | 无 |
| `DROP_BEACON` | 全部 | 无 |

`direction` 只能是 `UP`、`DOWN`、`LEFT` 或 `RIGHT`。

## Core 动作联合

| 类型 | 必填字段 |
|---|---|
| `WAIT` | 无 |
| `SPAWN` | `unit_type`：`WORKER`、`VANGUARD` 或 `RANGER` |
| `REPAIR_SHIELD` | 无 |
| `START_MOVE` | `direction` |
| `CANCEL_MOVE` | 无 |
| `PICKUP_BEACON` | 无 |
| `DROP_BEACON` | 无 |

所选联合中未定义的字段一律禁止，即使值是 `null`、空文本或零值也不允许。

## 成功

```http
HTTP/1.1 202 Accepted
Content-Type: application/json
```

```json
{
  "accepted": true,
  "tick": 10583,
  "source": "AGENT",
  "received_at": "2026-07-27T05:40:06.241Z"
}
```

这确认完整来源计划已持久化，但不保证动态动作成功。完整规范化计划会通过 WebSocket
`received` 到达。

## 静态拒绝

```http
HTTP/1.1 422 Unprocessable Entity
```

```json
{
  "accepted": false,
  "error": "INVALID_COMMAND",
  "details": [
    {
      "unit_id": "9d3e4941-2816-4a39-a220-df8cd95e877d",
      "reason": "INVALID_DIRECTION"
    }
  ]
}
```

整个请求会被拒绝，此前的有效计划保持不变。

## 幂等

幂等键必须包含 8–128 个可见 ASCII 字节（`0x21`–`0x7e`），不能包含空白或换行。

| 重用方式 | 结果 |
|---|---|
| 相同键、字节完全相同的请求体 | 返回最初保存的响应。 |
| 相同键、不同请求体 | `409 IDEMPOTENCY_CONFLICT`。 |
| 新键 | 作为新的整体替换请求处理。 |

只有在一个逻辑请求结果未知时，才使用相同键重试该请求。

## 并发与限流

- 同一个 `(player, credential kind)` 最多并发读取四个命令体，超出返回
  `COMMAND_CONCURRENCY_LIMIT`。
- 同一个 `(player, tick, source)` 在幂等预检后最多处理 64 个新请求，超出返回
  `COMMAND_RATE_LIMITED`。
- 同一槽位的有效请求按进入命令门的顺序串行处理。
