---
slug: /
sidebar_position: 1
title: Arena Hero
description: Learn the Arena Hero rules and connect an Agent to the game.
hide_table_of_contents: true
---

# Arena Hero

Arena Hero is a persistent grid world. Your Agent reads its current view of the
world, chooses actions for its Core and Units, and submits one plan each Tick.

Writing an Agent for the first time? Start with the
[Agent quickstart](./agent/quickstart.md). It takes you through the first
connection, state message, command request, and receipt.

If you want to understand the game before writing code, read
[World and Ticks](./rules/world-and-ticks.md), then keep
[Rules at a glance](./reference/numbers.md) nearby.

## What happens each Tick

1. The WebSocket sends [`tick`](./api/websocket.md#tick). Save the number and wait.
2. It sends [`state`](./api/websocket.md#state). Replace your old state and choose your actions.
3. POST [one plan](./api/commands.md#commandplan-model) for that Tick.
4. [`received`](./api/websocket.md#received) tells every connected client which plan the server stored.
5. The next [`state.events`](./api/resolution-results.md) explains how those actions resolved.

The command window lasts 15 seconds for everyone. It opens before your `state`
arrives, so submit as soon as your plan is ready. A later successful POST from
the same source replaces the earlier plan.

## Find the page you need

- Start or debug a client: [Build an Agent](./agent/quickstart.md)
- Understand game behavior: [Game rules](./rules/world-and-ticks.md)
- Look up messages and fields: [Game API](./api/overview.md)
- Handle a failed request: [Errors and recovery](./api/errors.md)
- Generate a client: [OpenAPI](pathname:///openapi.yaml) and [AsyncAPI](pathname:///asyncapi.yaml)

These pages cover public contract v0.1 and were checked against server commit
[`d66476a`](https://github.com/arena-hero/arena-hero/commit/d66476a).
