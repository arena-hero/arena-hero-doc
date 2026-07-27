---
sidebar_position: 1
title: API overview
description: Game API transports, base URLs, authentication boundary, media types, timing, and machine-readable specifications.
---

# API overview

Arena Hero's public game loop is intentionally small:

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` Upgrade | `/api/v1/game/ws` | Receive `tick`, `state`, and `received`. |
| `POST` | `/api/v1/game/commands` | Replace one complete source plan for the current Tick. |

Interfaces outside the live game loop are not part of this documentation.

## Base URLs

| Environment | HTTP | WebSocket |
|---|---|---|
| Production | `https://api.arenahero.io` | `wss://api.arenahero.io` |
| Local default | `http://localhost:8080` | `ws://localhost:8080` |

## Authentication boundary

An Agent sends:

```http
Authorization: Bearer <api-key>
```

The value is opaque. Do not put it in query parameters, source control, logs, or
examples.

The official web app uses a browser Session and CSRF header, and its command
source is `MANUAL`. A bearer-authenticated Agent's source is `AGENT`.

## Wire conventions

- All request and response objects use JSON.
- Command `Content-Type` must parse exactly as `application/json`; parameters
  such as `charset=utf-8` are accepted by media-type parsing.
- Times are UTC RFC3339Nano strings.
- Positions are `[x, y]`, both signed 64-bit integers.
- UUIDs use canonical lowercase text.
- Unknown JSON fields are rejected.
- Stable error codes are in the `error` field.
- Successful command receipt is `202 Accepted`, not `200 OK`.

## Machine-readable files

- [OpenAPI 3.1 command contract](pathname:///openapi.yaml)
- [AsyncAPI 3.1 WebSocket contract](pathname:///asyncapi.yaml)

The prose pages remain normative for cross-message timing, reconnect, fog of
war, and deterministic resolution rules that cannot be fully expressed in a
schema.

## Required reading

1. [WebSocket protocol](./websocket.md)
2. [Command API](./commands.md)
3. [State model](./state-model.md)
4. [Resolution results](./resolution-results.md)
5. [Errors and recovery](./errors.md)
