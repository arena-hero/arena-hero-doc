---
sidebar_position: 6
title: Errors and recovery
description: Read an error response, decide whether to retry, and fix command or WebSocket failures.
---

# Errors and recovery

Use the HTTP status and `error` code in your program. The optional `message`
field is for logs and people, not branching logic.

## Read the response

A request rejected before command handling usually looks like this:

```json
{
  "error": "UNAUTHORIZED"
}
```

Once the request reaches the command gate, a rejection includes
`"accepted": false`:

```json
{
  "accepted": false,
  "error": "TICK_MISMATCH",
  "tick": 10582,
  "current_tick": 10583
}
```

An invalid plan includes one or more reasons:

```json
{
  "accepted": false,
  "error": "INVALID_COMMAND",
  "details": [
    {
      "unit_id": "9d3e4941-2816-4a39-a220-df8cd95e877d",
      "reason": "RANGER_CANNOT_HARVEST"
    },
    {
      "reason": "INVALID_UNIT_TYPE"
    }
  ]
}
```

`accepted` is absent from transport, authentication, JSON, concurrency, and
internal errors. Its absence does not mean the command was accepted.

## HTTP errors

| Status | `error` | Extra fields | What went wrong |
|---:|---|---|---|
| 400 | `INVALID_JSON` | `message` | The body is empty or malformed, has multiple JSON values, has an unknown or wrongly typed field, contains a malformed UUID, or uses a noncanonical `unit_actions` UUID key. |
| 400 | `IDEMPOTENCY_KEY_INVALID` | none | The header is missing or is not 8-128 visible ASCII bytes (`0x21`-`0x7e`). |
| 401 | `UNAUTHORIZED` | none | The bearer credential is missing, invalid, or inactive. |
| 403 | `CSRF_INVALID` | none | A browser Manual request failed CSRF validation. Agent bearer requests do not use CSRF. |
| 409 | `COMMAND_WINDOW_CLOSED` | `accepted: false` | The Tick exists, but its command window is closed or the body arrived at or after the deadline. |
| 409 | `TICK_MISMATCH` | `accepted: false`; responses after persistence lookup also include `tick` and `current_tick` | The submitted Tick is not the current command Tick. |
| 409 | `IDEMPOTENCY_CONFLICT` | `accepted: false` | This player and source already used the key with different raw request bytes. |
| 413 | `REQUEST_BODY_TOO_LARGE` | `message` | The body is larger than this deployment allows. |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | none | The parsed media type is not `application/json`. Parameters such as `charset=utf-8` are allowed. |
| 422 | `INVALID_COMMAND` | `accepted: false`, nonempty `details` | The JSON shape is valid, but the plan refers to an invalid player, Unit, or action. |
| 429 | `COMMAND_CONCURRENCY_LIMIT` | `Retry-After: 1` header | More than four command bodies are being processed for the same player and credential kind. |
| 429 | `COMMAND_RATE_LIMITED` | `accepted: false`; `Retry-After: 1` header | This `(player, Tick, source)` has attempted more than 64 new admissions. |
| 500 | `INTERNAL_ERROR` | none | The server could not finish the request. |
| 503 | `TICK_NOT_READY` | `accepted: false` | The Tick is not initialized, the player's state is not ready, or Tick processing failed. |

The maximum request body size is deployment configuration, not part of the
protocol. Keep plans small and omit actions that would only say `WAIT`.

## Should you retry?

| Result | Retry the same key and body? | What to do next |
|---|---|---|
| Network timeout or reset after upload | Yes | Keep the same body until you know the original result. |
| `500 INTERNAL_ERROR` | Yes | Use a bounded backoff. |
| `429 COMMAND_CONCURRENCY_LIMIT` | Yes | Wait for `Retry-After`. |
| `503 TICK_NOT_READY` | Usually not yet | Wait for `state` or reconnect. Recompute if a newer state arrives. |
| `409 COMMAND_WINDOW_CLOSED` | Only to recover a possibly completed original request | Wait for the next state before making a new plan. |
| `409 TICK_MISMATCH` | Only to recover an original idempotent result | Recompute from the current state. |
| `409 IDEMPOTENCY_CONFLICT` | No | Use a new key only for a genuinely new request. |
| `422 INVALID_COMMAND` | No | Fix the plan. If the window is still open, submit it as a new request with a new key. |
| `429 COMMAND_RATE_LIMITED` | No new requests for that source and Tick | Keep the last valid plan and wait for the next state. |
| `400`, `401`, `403`, `413`, `415` | Not unchanged | Fix the request or credential first. |

The server keeps completed idempotent responses for seven days. During that
time, the same key and byte-for-byte identical body returns the original status
and body, even after the command window closes. Replaying an earlier `202` does
not store the plan again and does not send another `received` message.

## Validation reasons

For a Unit action problem, `details[].unit_id` identifies the Unit. It is absent
for a whole-plan or Core action problem.

The list order is stable: Tick problem first, then Unit problems in UUID byte
order, then the Core problem.

| `reason` | Applies to | What to fix |
|---|---|---|
| `TICK_MUST_BE_POSITIVE` | Plan | `tick` is missing, zero, or negative. |
| `UNIT_NOT_OWNED` | Unit | The key is not a living Unit owned by this player. |
| `UNKNOWN_ACTION_TYPE` | Unit | `type` is not a Unit action. |
| `UNKNOWN_CORE_ACTION_TYPE` | Core | `type` is not a Core action. |
| `UNEXPECTED_ACTION_FIELDS` | Unit or Core | The action contains a field that its `type` does not allow, even if the value is `null`, empty, or zero. |
| `INVALID_DIRECTION` | `MOVE`, `SWEEP`, `START_MOVE` | `direction` is missing or is not `UP`, `DOWN`, `LEFT`, or `RIGHT`. |
| `INVALID_UNIT_TYPE` | `SPAWN` | `unit_type` is missing or is not `WORKER`, `VANGUARD`, or `RANGER`. |
| `TARGET_ID_REQUIRED` | `SHOOT` | `target_id` is the nil UUID. A malformed UUID returns `INVALID_JSON` instead. |
| `EXPECTED_CELL_REQUIRED` | `SHOOT` | `expected_cell` is missing. |
| `VANGUARD_CANNOT_HARVEST` | Unit | A Vanguard selected `HARVEST`. |
| `RANGER_CANNOT_HARVEST` | Unit | A Ranger selected `HARVEST`. |
| `VANGUARD_CANNOT_DEPOSIT` | Unit | A Vanguard selected `DEPOSIT`. |
| `RANGER_CANNOT_DEPOSIT` | Unit | A Ranger selected `DEPOSIT`. |
| `WORKER_CANNOT_SWEEP` | Unit | A Worker selected `SWEEP`. |
| `RANGER_CANNOT_SWEEP` | Unit | A Ranger selected `SWEEP`. |
| `WORKER_CANNOT_SHOOT` | Unit | A Worker selected `SHOOT`. |
| `VANGUARD_CANNOT_SHOOT` | Unit | A Vanguard selected `SHOOT`. |

`INVALID_COMMAND` leaves the last valid plan unchanged.

## Where the request stopped

The server checks a new request in this order:

1. bearer authentication and, for browser Manual calls, CSRF;
2. the per-player and credential-kind body concurrency limit;
3. `Content-Type` and `Idempotency-Key`;
4. body size and JSON decoding;
5. the Tick, command window, and rate limit;
6. the current player, Unit, and action fields;
7. idempotency storage and plan replacement.

The order explains similar-looking errors. A malformed UUID is `INVALID_JSON`.
A valid UUID belonging to another player reaches action validation and returns
`INVALID_COMMAND` with `UNIT_NOT_OWNED`.

## WebSocket failures

The WebSocket handshake can return:

- `401 UNAUTHORIZED`
- `403 WEBSOCKET_ORIGIN_INVALID`
- `409 PLAYER_NOT_READY`
- `429 REALTIME_CONNECTION_LIMIT` with `Retry-After: 1`

After the upgrade, use the close-code table in
[WebSocket protocol](./websocket.md#close-codes). Retry temporary failures with
randomized exponential backoff from 250 ms to 5 seconds. Stop retrying after
`1008` until you fix the credential or client behavior.

After reconnecting, replace your local state and saved receipts with the
snapshot sent by the server. Do not send custom heartbeat messages. Treat
`SHOT_MISSED` as an unknown miss, not as a way to test hidden targets.
