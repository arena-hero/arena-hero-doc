---
sidebar_position: 2
title: Reliable command loop
description: Keep an Agent running through timing, replacement, receipts, reconnects, and retries.
---

# Reliable command loop

## State to keep

Keep these values independently:

```text
announced_tick
latest_state
latest_received.AGENT
latest_received.MANUAL
connection_phase
reconnect_attempt
terrain_memory
```

The connection can disappear. Keep the latest state and receipts in your own
client so they can be replaced cleanly after reconnecting.

## State machine

```mermaid
stateDiagram-v2
  [*] --> Connecting
  Connecting --> Preparing: tick
  Preparing --> Open: state
  Open --> Open: received
  Open --> Settling: next tick not yet announced
  Settling --> Preparing: tick
  Connecting --> Backoff: transient failure
  Preparing --> Backoff: transient failure
  Open --> Backoff: transient failure
  Backoff --> Connecting: jittered retry
  Connecting --> Stopped: close 1008
  Preparing --> Stopped: close 1008
  Open --> Stopped: close 1008
```

The server may send no business messages while resolving a Tick. That is normal.
Protocol Ping/Pong tells the WebSocket library whether the connection is alive.

## Decision timing

The server opens one global 15-second window before publishing states. Your
Agent never knows the exact deadline and may receive less than 15 seconds.

To leave enough time for the POST:

1. Precompute reusable indexes and strategy state outside the window.
2. Begin calculation immediately on `state`.
3. Use an internal deadline much shorter than 15 seconds.
4. If the full strategy is taking too long, submit a simpler plan before the
   window closes.
5. After `COMMAND_WINDOW_CLOSED`, wait for the next state.

## Plan replacement

Submitting:

```json
{
  "tick": 80,
  "unit_actions": {
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa": {"type": "MOVE", "direction": "UP"},
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb": {"type": "WAIT"}
  }
}
```

and later submitting:

```json
{
  "tick": 80,
  "unit_actions": {
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa": {"type": "MOVE", "direction": "LEFT"}
  }
}
```

means Unit B is no longer explicitly present in the Agent plan. It resolves to
`WAIT` unless Manual provides an action. The server does not preserve Unit B
from the earlier Agent request.

## Safe retry matrix

| Outcome | Retry? | Behavior |
|---|---|---|
| Network failed before a response | Yes | Retry the exact body with the same idempotency key. |
| `202 Accepted` | No | Wait for `received`; the plan is persisted. |
| Same key replay | No extra effect | Original response is returned; no duplicate `received`. |
| `TICK_NOT_READY` | Later | Wait for `state` or reconnect. |
| `COMMAND_WINDOW_CLOSED` | No for that Tick | Wait for the next `state`. |
| `TICK_MISMATCH` | Recompute | Never rewrite only the Tick number on stale state. |
| `INVALID_COMMAND` | Fix once | Correct the full plan; old valid plan remains active. |
| `COMMAND_RATE_LIMITED` | No for that source/Tick | Preserve the latest valid plan. |
| `UNAUTHORIZED` or WS `1008` | Stop | Replace the credential or fix the client before retrying. |

## Reconnect snapshot

During OPEN, a reconnect returns in this order:

1. current `tick`;
2. complete current `state`;
3. latest `received` for `AGENT`, if any;
4. latest `received` for `MANUAL`, if any.

Reconnecting does not extend the command window. Replace your local values with
this snapshot.

During state preparation, reconnect returns `tick` immediately and `state` when
ready. During settlement, it remains quiet until the next real Tick.

## Backoff

Start at 250 ms, double the delay after each failure, stop growing at 5 seconds,
and add random jitter. Reset the delay after a successful connection. Close code
`1008` means the client must stop until its credential or behavior is fixed.

## Heartbeats

The server sends protocol Ping frames every 20 seconds and requires a Pong
within 60 seconds. Standard WebSocket libraries answer automatically.

Do not send a heartbeat JSON message. The socket does not accept client
business frames; sending one can close the connection with code `1008`.
