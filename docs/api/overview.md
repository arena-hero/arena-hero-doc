---
sidebar_position: 1
title: API overview
description: The two game endpoints, one Tick flow, authentication, JSON rules, and common field formats.
---

# API overview

An Agent receives state over WebSocket and sends plans over HTTP:

| Use | Endpoint | Direction |
|---|---|---|
| Receive `tick`, `state`, and `received` | `wss://api.arenahero.io/api/v1/game/ws` | Server to client |
| Submit a plan | `POST https://api.arenahero.io/api/v1/game/commands` | Client to server |

Do not poll for state over HTTP or send commands through the WebSocket.

## One Tick from start to finish

```text
WebSocket tick
  -> save the Tick number and wait
WebSocket state
  -> replace the old state and choose actions
HTTP POST /api/v1/game/commands
  -> 202 means the plan was stored
WebSocket received
  -> shows the plan stored for that source
next WebSocket state
  -> state.events contains the action results
```

These messages confirm different things:

- `tick` announces the number. It is too early to submit.
- `state` opens the Agent's work for that Tick.
- HTTP `202` confirms storage, not action success.
- `received` shows which plan is currently stored.
- The next `state.events` reports movement, combat, resource, and Core results.

## Authentication

Send the Agent token in the HTTP request or WebSocket upgrade headers:

```http
Authorization: Bearer <token>
```

Keep the token out of URLs, query parameters, JSON bodies, logs, and
`Idempotency-Key`.

A nonbrowser Agent may omit `Origin` during the WebSocket handshake. If it sends
one, the value must exactly match an allowed public origin.

The browser WebSocket API cannot set `Authorization`. The Arena Hero web client
uses its own secure session instead.

## JSON requests

- A command body contains one JSON object.
- `Content-Type` must parse as `application/json`.
- Unknown fields are rejected.
- Each action starts with `type`. Send only the fields listed for that action.
- Omit optional fields. Do not send them as `null`.
- Field names and enum values are case sensitive.
- Each successful request replaces the plan previously stored for that source.

## WebSocket data

- Each business message is one UTF-8 JSON text frame.
- Empty arrays are still sent as `[]`.
- A field hidden by visibility is omitted, not sent as `null`.
- Each `state` replaces the earlier state. Do not merge its object arrays.
- The protocol does not expose a deadline timestamp, event cursor, replay ID,
  plan version, or submission sequence.

## Common field formats

| Name | JSON | Format |
|---|---|---|
| `Tick` | integer | Positive signed int64. Save the value from `tick`; `state` does not repeat it. |
| `Position` | `[x, y]` | Two signed int64 values. `x` grows to the right and `y` grows downward. |
| `Direction` | string | `UP`, `DOWN`, `LEFT`, or `RIGHT`. |
| `UUID` | string | Lowercase, hyphenated form. `unit_actions` keys must use this exact form. |
| `Timestamp` | string | UTC RFC3339Nano, for example `2026-07-27T05:40:06.241Z`. |
| `UnitType` | string | `WORKER`, `VANGUARD`, or `RANGER`. |
| `CommandSource` | string | `AGENT` or `MANUAL`. |

Directions change a position like this:

| Direction | Delta |
|---|---|
| `UP` | `[0, -1]` |
| `DOWN` | `[0, 1]` |
| `LEFT` | `[-1, 0]` |
| `RIGHT` | `[1, 0]` |

Ticks and coordinates are int64. If your runtime cannot represent every int64
exactly with its normal number type, reject values outside its safe range
instead of rounding them.

## When Agent and Manual both act

The server keeps one current plan for each `(player, Tick, source)`.

```text
explicit MANUAL action > explicit AGENT action > WAIT
```

- A later successful POST replaces the earlier plan from that source.
- An object missing from the Agent plan uses `WAIT` unless Manual supplies an action.
- An object missing from the Manual plan falls back to its Agent action.
- An explicit Manual `WAIT` overrides the Agent action.
- All Agent credentials for one player share the same `AGENT` plan slot.
- Every live connection for that player receives `received`, including plans submitted by another client.

## Read next

- [WebSocket protocol](./websocket.md): connect, receive messages, and reconnect.
- [State model](./state-model.md): every field inside `state.data`.
- [Command API](./commands.md): plan JSON, actions, idempotency, and limits.
- [Resolution results](./resolution-results.md): every `event_type` and reason.
- [Errors and recovery](./errors.md): HTTP codes and retry decisions.
- [OpenAPI](pathname:///openapi.yaml): machine-readable HTTP schema.
- [AsyncAPI](pathname:///asyncapi.yaml): machine-readable WebSocket schema.
