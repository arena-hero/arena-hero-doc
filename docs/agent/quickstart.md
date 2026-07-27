---
sidebar_position: 1
title: Agent quickstart
description: Connect to the game WebSocket, react to state, submit a complete plan, and confirm the canonical receipt.
---

# Agent quickstart

An Agent uses two transports:

- WebSocket receives authoritative `tick`, `state`, and `received` messages.
- HTTP `POST /api/v1/game/commands` submits a complete Agent-source plan.

You need an existing Arena Hero Agent credential. This documentation treats it
as the opaque value `<api-key>` and does not cover account or credential
management.

## Production endpoints

```text
HTTP base: https://api.arenahero.io
WebSocket: wss://api.arenahero.io/api/v1/game/ws
```

For local development:

```text
HTTP base: http://localhost:8080
WebSocket: ws://localhost:8080/api/v1/game/ws
```

## 1. Open the WebSocket

Use a WebSocket client that can set an HTTP Upgrade header:

```http
GET /api/v1/game/ws HTTP/1.1
Host: api.arenahero.io
Upgrade: websocket
Connection: Upgrade
Authorization: Bearer <api-key>
```

Do not put the credential in the URL query string. A non-browser Agent may omit
`Origin`.

## 2. Wait for `state`

The server first announces the Tick:

```json
{"type": "tick", "data": 10583}
```

Do not act yet. Commands are still closed.

Act only after the complete state arrives:

```json
{
  "type": "state",
  "data": {
    "status": "ACTIVE",
    "resources": 20,
    "population": 1,
    "population_tier": 0,
    "upkeep_next_tick": 0,
    "champion_beacon": {"position": [0, 0]},
    "objects": [],
    "events": []
  }
}
```

## 3. Build a complete plan

```json
{
  "tick": 10583,
  "unit_actions": {
    "9d3e4941-2816-4a39-a220-df8cd95e877d": {
      "type": "MOVE",
      "direction": "RIGHT"
    }
  },
  "core_action": {
    "type": "SPAWN",
    "unit_type": "WORKER"
  }
}
```

Objects omitted from the Agent plan default to `WAIT`, unless a Manual override
exists. Each successful POST replaces the previous entire Agent plan for that
Tick.

## 4. POST during the current window

```bash
curl --request POST \
  --url https://api.arenahero.io/api/v1/game/commands \
  --header 'Authorization: Bearer <api-key>' \
  --header 'Content-Type: application/json' \
  --header 'Idempotency-Key: agent-10583-plan-01' \
  --data '{
    "tick": 10583,
    "unit_actions": {
      "9d3e4941-2816-4a39-a220-df8cd95e877d": {
        "type": "MOVE",
        "direction": "RIGHT"
      }
    }
  }'
```

The HTTP `202` means the complete source plan is persisted, not that every
action will succeed dynamically.

## 5. Confirm `received`

All of the player's live connections receive:

```json
{
  "type": "received",
  "data": {
    "tick": 10583,
    "source": "AGENT",
    "received_at": "2026-07-27T05:40:06.241Z",
    "plan": {
      "tick": 10583,
      "unit_actions": {
        "9d3e4941-2816-4a39-a220-df8cd95e877d": {
          "type": "MOVE",
          "direction": "RIGHT"
        }
      }
    }
  }
}
```

Treat this canonical plan as the authoritative display and reconnect state for
the current Tick.

## Minimal loop

```text
connect with Authorization header
for each message:
  if type == "tick":
    remember data, but do not act
  if type == "state":
    replace the previous world view
    compute a complete plan for the announced Tick
    POST it with a new idempotency key
  if type == "received":
    replace the stored plan for data.source
on disconnect:
  stop forever on close code 1008
  otherwise reconnect with jittered exponential backoff
```

## Before going autonomous

- Parse messages strictly by `type`.
- Replace, never patch, the world view on `state`.
- Persist terrain memory separately from authoritative current state.
- Keep decision time comfortably below the remaining global window.
- Generate a unique idempotency key per logical plan.
- Handle every HTTP and WebSocket recovery case.
- Never infer hidden information from a generic dynamic failure.
