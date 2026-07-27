---
sidebar_position: 3
title: Command API
description: Complete command request and receipt schemas, strict action unions, replacement, idempotency, validation, and limits.
---

# Command API

```http
POST /api/v1/game/commands
Authorization: Bearer <api-key>
Idempotency-Key: <8..128 visible ASCII bytes>
Content-Type: application/json
```

The maximum configured production command body is part of server deployment;
clients should keep plans compact. Oversized bodies return
`REQUEST_BODY_TOO_LARGE`.

## Request

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

### Plan fields

| Field | Type | Required | Rule |
|---|---|---:|---|
| `tick` | positive int64 | Yes | Must equal the current command Tick. |
| `unit_actions` | object keyed by canonical Unit UUID | No | Only Units owned by the caller. Omitted or empty means no explicit Unit actions; `{}` is recommended. |
| `core_action` | Core action or omitted | No | Omitted means no explicit action from this source. |

Each POST is a full replacement of that source's previous plan.

## Unit action unions

| Type | Allowed Unit | Required fields |
|---|---|---|
| `WAIT` | all | none |
| `MOVE` | all | `direction` |
| `HARVEST` | Worker | none |
| `DEPOSIT` | Worker | none |
| `SWEEP` | Vanguard | `direction` |
| `SHOOT` | Ranger | `target_id`, `expected_cell` |
| `PICKUP_BEACON` | all | none |
| `DROP_BEACON` | all | none |

`direction` is `UP`, `DOWN`, `LEFT`, or `RIGHT`.

## Core action unions

| Type | Required fields |
|---|---|
| `WAIT` | none |
| `SPAWN` | `unit_type`: `WORKER`, `VANGUARD`, or `RANGER` |
| `REPAIR_SHIELD` | none |
| `START_MOVE` | `direction` |
| `CANCEL_MOVE` | none |
| `PICKUP_BEACON` | none |
| `DROP_BEACON` | none |

Fields not defined for the selected union are forbidden even when set to
`null`, empty text, or a zero value.

## Success

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

This confirms persistence of the full source plan. It does not guarantee
dynamic action success. The full canonical plan arrives over WebSocket
`received`.

## Static rejection

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

The whole request is rejected and the previous valid plan remains active.

## Idempotency

The key must contain 8–128 visible ASCII bytes (`0x21`–`0x7e`) and no whitespace
or line breaks.

| Reuse | Result |
|---|---|
| Same key, byte-identical body | Return the original stored response. |
| Same key, different body | `409 IDEMPOTENCY_CONFLICT`. |
| New key | Process as a new replacement request. |

Use the same key only to retry one logical request whose outcome is unknown.

## Concurrency and rate limits

- At most four command bodies may be read concurrently for one
  `(player, credential kind)`. Excess returns `COMMAND_CONCURRENCY_LIMIT`.
- One `(player, tick, source)` processes at most 64 new requests after
  idempotency precheck. Excess returns `COMMAND_RATE_LIMITED`.
- Valid same-slot requests serialize by gate-entry order.
