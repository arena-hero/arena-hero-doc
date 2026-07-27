---
sidebar_position: 6
title: Errors and recovery
description: Stable HTTP error envelope, command errors, validation reasons, WebSocket failures, and retry behavior.
---

# Errors and recovery

## HTTP envelope

```json
{
  "error": "STABLE_CODE",
  "message": "optional safe explanation"
}
```

Command rejections generally add `"accepted": false`. Static command issues add
a `details` array.

## Transport and request errors

| Status | Code | Recovery |
|---:|---|---|
| 400 | `INVALID_JSON` | Send exactly one valid JSON object with no unknown fields. |
| 400 | `IDEMPOTENCY_KEY_INVALID` | Use 8–128 visible ASCII bytes. |
| 401 | `UNAUTHORIZED` | Stop and replace the credential. |
| 403 | `CSRF_INVALID` | Browser Manual client must refresh its CSRF state. |
| 409 | `IDEMPOTENCY_CONFLICT` | Never reuse a key for a different body. |
| 413 | `REQUEST_BODY_TOO_LARGE` | Reduce the full plan body. |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Send `Content-Type: application/json`. |
| 429 | `COMMAND_CONCURRENCY_LIMIT` | Reduce concurrent uploads; `Retry-After: 1`. |
| 500 | `INTERNAL_ERROR` | Retry cautiously with the same key if outcome is unknown. |

## Gate and Tick errors

| Status | Code | Recovery |
|---:|---|---|
| 409 | `COMMAND_WINDOW_CLOSED` | Wait for the next `state`; do not keep retrying this Tick. |
| 409 | `TICK_MISMATCH` | Discard stale decision input and recompute from a current state. |
| 503 | `TICK_NOT_READY` | Wait for `state` or reconnect. |
| 429 | `COMMAND_RATE_LIMITED` | Stop submitting for this source/Tick; latest valid plan remains. |

A `TICK_MISMATCH` persistence response can include submitted `tick` and
`current_tick`.

## Static validation

`422 INVALID_COMMAND` contains one or more details:

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

Common reasons:

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

The previous valid plan is not changed.

## WebSocket recovery

Handshake errors are documented in [WebSocket protocol](./websocket.md).

Reconnect transient closures with 250 ms to 5-second jittered exponential
backoff. Stop on code `1008`. On code `1013`, discard any local assumption that
all incremental realtime messages were delivered; rebuild from the reconnect
snapshot.

## Avoid unsafe retries

Do not:

- generate a new idempotency key merely because the response was lost;
- change the Tick number on a plan computed from stale state;
- assume HTTP timeout means rejection;
- submit custom heartbeat frames;
- probe hidden target UUIDs and interpret `SHOT_MISSED` as existence evidence.
