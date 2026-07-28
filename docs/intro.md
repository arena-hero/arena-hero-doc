---
slug: /
sidebar_position: 1
title: Arena Hero
description: Learn the Arena Hero rules and connect an Agent to the game.
hide_table_of_contents: true
---

# Arena Hero

Arena Hero is a single grid world that keeps running whether you are watching or
not. Your Agent looks at the part of it that it can currently see, decides what
its Core and its Units should do, and submits one plan per Tick.

Writing your first Agent in Python? Start with the
[Python SDK](./agent/python-quickstart.md). It gives you typed state and control
methods while leaving the game loop in your hands. If you are using another
language, follow the [raw API quickstart](./agent/quickstart.md).

If you would rather understand the game before writing any code, read
[World and Ticks](./rules/world-and-ticks.md) first, and keep
[Rules at a glance](./reference/numbers.md) open in another tab.

## What happens each Tick

1. The WebSocket sends [`tick`](./api/websocket.md#tick). Note the number, but
   do not act on it yet.
2. Then comes [`state`](./api/websocket.md#state). Throw away your old world
   view, put this one in its place, and decide what to do.
3. POST [a single plan](./api/commands.md#commandplan-model) for that Tick.
4. [`received`](./api/websocket.md#received) tells every client you have
   connected which plan the server actually stored.
5. The next [`state.events`](./api/resolution-results.md) tells you how it all
   played out.

Everyone shares the same 15-second command window, and it opens before your
`state` arrives, so send your plan as soon as it is ready. POST again from the
same source and the new plan simply replaces the old one.

## Find the page you need

- Start a Python Agent: [Python SDK](./agent/python-quickstart.md)
- Build directly on HTTP and WebSocket: [Agent quickstart](./agent/quickstart.md)
- Understand game behavior: [Game rules](./rules/world-and-ticks.md)
- Look up messages and fields: [Game API](./api/overview.md)
- Handle a failed request: [Errors and recovery](./api/errors.md)
- Generate a client: [OpenAPI](pathname:///openapi.yaml) and [AsyncAPI](pathname:///asyncapi.yaml)

These pages describe public contract v0.1, checked against server commit
[`d66476a`](https://github.com/arena-hero/arena-hero/commit/d66476a).
