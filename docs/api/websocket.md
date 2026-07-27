---
sidebar_position: 2
title: WebSocket protocol
description: Handshake requirements, message envelopes, timing, receipts, heartbeat, reconnect snapshots, and close codes.
---

# WebSocket protocol

```http
GET /api/v1/game/ws
Authorization: Bearer <api-key>
Upgrade: websocket
```

The server disables WebSocket compression and sends UTF-8 JSON text frames. It
accepts no client business messages; commands always use HTTP POST.

## Handshake

A non-browser Agent can omit `Origin`. When `Origin` is present, it must exactly
match a configured public frontend or API origin after canonicalization.
Credentials in URL query parameters are not supported.

Possible HTTP failures:

| Status | Error | Meaning |
|---:|---|---|
| 401 | `UNAUTHORIZED` | Credential missing or inactive. |
| 403 | `WEBSOCKET_ORIGIN_INVALID` | Browser origin is not allowed. |
| 409 | `PLAYER_NOT_READY` | Activation is persisted but the player has not entered an authoritative Tick yet. |
| 429 | `REALTIME_CONNECTION_LIMIT` | Per-player or global connection limit reached; `Retry-After: 1`. |

## Message envelope

Every server message is:

```ts
type ServerMessage =
  | {type: 'tick'; data: number}
  | {type: 'state'; data: PlayerState}
  | {type: 'received'; data: ReceivedPlan};
```

No event IDs or incremental cursor exist.

## `tick`

```json
{"type": "tick", "data": 10583}
```

This announces the real logical Tick. Commands remain closed while private
states are prepared. Never submit solely because `tick` arrived.

## `state`

```json
{
  "type": "state",
  "data": {
    "status": "ACTIVE",
    "resources": 42,
    "population": 67,
    "population_tier": 3,
    "upkeep_next_tick": 6,
    "champion_beacon": {"position": [0, 0]},
    "objects": [],
    "events": []
  }
}
```

`state` is a complete current view and the only command trigger. Replace the
previous authoritative state instead of applying a patch.

The fixed 15-second global window is already running when states are published.
Receiving or reconnecting to `state` does not reset it.

## `received`

```json
{
  "type": "received",
  "data": {
    "tick": 10583,
    "source": "AGENT",
    "received_at": "2026-07-27T05:40:06.241Z",
    "plan": {
      "tick": 10583,
      "unit_actions": {},
      "core_action": {"type": "WAIT"}
    }
  }
}
```

The plan is the canonical strictly parsed plan stored by the server. New
successful replacement broadcasts to all connections owned by that player.
Idempotent replay, rejection, and implicit default `WAIT` do not broadcast.

Keep the latest receipt separately for `AGENT` and `MANUAL`.

## Reconnect behavior

| Server phase | Snapshot |
|---|---|
| Preparing state | Current `tick`; `state` later when ready. |
| OPEN | `tick`, complete `state`, latest `AGENT` receipt, latest `MANUAL` receipt. |
| Resolving | No stale replay; wait for the next Tick. |
| Recovered OPEN after crash | Same Tick and restored receipts, with a newly opened full 15-second window. |

The stream provides current authoritative reconnect state, not history.

## Heartbeat and inbound policy

- Server protocol Ping interval: 20 seconds.
- Pong timeout: 60 seconds.
- Credential revalidation: approximately every 5 seconds.
- Inbound frame size limit: 1024 bytes.
- Client text/binary business frames: prohibited.
- Compression: disabled.

## Close codes

| Code | Meaning | Client behavior |
|---:|---|---|
| 1000 | Normal client closure | Reconnect only when desired. |
| 1001 | Server shutdown or heartbeat failure | Reconnect with backoff. |
| 1008 | Credential inactive or client policy violation | Stop retrying. |
| 1011 | Internal realtime/credential-check error | Reconnect with backoff. |
| 1013 | Slow-client authoritative queue overflow | Discard incremental assumptions and reconnect. |
