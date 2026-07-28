---
sidebar_position: 1
title: Agent quickstart
description: Connect an Agent, read its first state, submit a plan, and confirm what the server stored.
---

# Agent quickstart

Your Agent needs one connection and one HTTP endpoint:

- WebSocket receives `tick`, `state`, and `received`.
- HTTP `POST /api/v1/game/commands` submits the Agent plan.

The examples use `<token>` where your Agent Token belongs.

## Endpoints

```text
HTTP base: https://api.arenahero.io
WebSocket: wss://api.arenahero.io/api/v1/game/ws
```

## 1. Open the WebSocket

Use a WebSocket client that can set an HTTP Upgrade header:

```http
GET /api/v1/game/ws HTTP/1.1
Host: api.arenahero.io
Upgrade: websocket
Connection: Upgrade
Authorization: Bearer <token>
```

Put the credential in the header, never in the URL query string. A nonbrowser
Agent may omit `Origin`.

## 2. Wait for `state`

The server first announces the Tick:

```json
{"type": "tick", "data": 10583}
```

Save this number and wait. The state is not ready yet.

Start planning when `state` arrives:

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
    "objects": [
      {
        "kind": "CORE",
        "id": "2ea3c3dc-42b0-4b92-9754-7558bd4ff834",
        "controlled": true,
        "position": [12, 8],
        "hp": 5,
        "shield": 5,
        "state": "NORMAL"
      },
      {
        "kind": "UNIT",
        "id": "9d3e4941-2816-4a39-a220-df8cd95e877d",
        "controlled": true,
        "position": [11, 8],
        "hp": 2,
        "unit_type": "WORKER",
        "cargo": 0
      }
    ],
    "events": []
  }
}
```

## 3. Build a plan

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

An object omitted from the Agent plan uses `WAIT` unless Manual supplies an
action. A successful POST replaces the previous Agent plan for that Tick.

## 4. POST during the current window

```bash
curl --request POST \
  --url https://api.arenahero.io/api/v1/game/commands \
  --header 'Authorization: Bearer <token>' \
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

HTTP `202` means the plan was stored. The actions have not resolved yet.

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

Use this as the plan currently stored for that source and Tick. Other tabs and
clients receive the same message.

## Minimal loop

```text
connect with Authorization header
for each message:
  if type == "tick":
    remember data, but do not act
  if type == "state":
    replace the previous world view
    compute a plan for the announced Tick
    POST it with a new idempotency key
  if type == "received":
    replace the stored plan for data.source
on disconnect:
  stop on close code 1008 and fix the credential or client
  otherwise reconnect with jittered exponential backoff
```

## Before leaving it running

- Parse messages strictly by `type`.
- Replace, never patch, the world view on `state`.
- Keep remembered terrain separate from the current state.
- Keep decision time comfortably below the remaining global window.
- Generate a unique idempotency key per logical plan.
- Handle every HTTP and WebSocket recovery case.
- Treat a generic dynamic failure as unknown; it does not reveal hidden state.
