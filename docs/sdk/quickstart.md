---
sidebar_position: 1
title: Quickstart
description: Install the official Python SDK and run a synchronous or asynchronous Agent.
---

# Python SDK

The official SDK handles the WebSocket connection, command POSTs, typed state
models, receipts, safe retries, and reconnects. You write the game loop and
decide what every Unit should do.

The package requires Python 3.11 or newer.

## Install

Install the package from PyPI:

```bash
python -m pip install arena-hero
```

The import name is `arena_hero`.

## Synchronous loop

Use `ArenaHeroClient` in a normal Python program:

```python
from getpass import getpass

from arena_hero import ArenaHeroClient, Direction


api_key = getpass("Arena Hero API key: ")

with ArenaHeroClient(api_key=api_key) as game:
    for turn in game.turns():
        for worker in turn.workers:
            if worker.position in turn.resource_cells:
                worker.harvest()
            else:
                worker.move(Direction.RIGHT)

        turn.submit()
```

There are two important details:

1. `move()` and `harvest()` only change the plan being built in memory. They do
   not send a request.
2. `turn.submit()` sends the complete plan once. Calling another action method
   for the same object before submission replaces that object's earlier action.

`turn.resource_cells` contains visible natural points and cargo piles left by
dead Workers; pile amounts are not exposed. One successful harvest consumes a
natural point. If several eligible Workers target the same cell, only the
lowest UUID succeeds; the rest receive
`HARVEST_FAILED`/`RESOURCE_DEPLETED` in the next Turn.

The context manager closes the HTTP and WebSocket connections when the loop
ends.

## Asynchronous loop

Use `AsyncArenaHeroClient` when the rest of your application runs on `asyncio`:

```python
import asyncio
from getpass import getpass

from arena_hero import AsyncArenaHeroClient, Direction


async def play(api_key: str) -> None:
    async with AsyncArenaHeroClient(api_key=api_key) as game:
        async for turn in game.turns():
            for vanguard in turn.vanguards:
                vanguard.sweep(Direction.LEFT)

            await turn.submit()


asyncio.run(play(getpass("Arena Hero API key: ")))
```

The synchronous and asynchronous clients expose the same state and control
methods. Only iteration, submission, and closing change:

| Synchronous | Asynchronous |
|---|---|
| `ArenaHeroClient` | `AsyncArenaHeroClient` |
| `for turn in game.turns()` | `async for turn in game.turns()` |
| `turn.submit()` | `await turn.submit()` |
| `game.close()` | `await game.close()` |

## API key

Pass the API key directly to the client:

```python
game = ArenaHeroClient(api_key="your-api-key")
```

The SDK does not read the API key or endpoint from environment variables. How
you load and protect the value before passing it to the constructor is up to
your application. Do not commit a real key to source control.

## Read the current Turn

Each `Turn` is one complete, authoritative state snapshot:

```python
turn.tick
turn.resources
turn.resource_capacity
turn.resource_space
turn.core
turn.units
turn.workers
turn.vanguards
turn.rangers
turn.visible_enemies
turn.resource_cells
turn.obstacle_cells
turn.beacon
turn.events
```

Core storage has a minimum capacity of 10, then accepts 5 resources per living
Unit. A partial deposit leaves its remainder on the Worker; a full Core rejects
the deposit without deleting cargo. If population falls, stored resources above
the new capacity are destroyed immediately. Use `turn.resource_space` before
choosing `deposit()`.

Use the filtered collections when possible. For example,
`turn.workers` contains controlled Workers, while
`turn.visible_enemies` contains visible enemy Units and Cores.
Every `CoreView` includes `owner_username`; display it as
`f"@{core.owner_username}"`. Unit owners remain private.

Do not treat an old `resource_cells` value as permanent map data. Consumed points
disappear, chunks replenish missing slots every four resolved Ticks, and a new or
removed point outside current vision remains unknown until you see that cell
again.

`turn.events` contains the private resolution results from the previous Tick.
It tells you what actually happened to your earlier commands.

Deposits, Cargo drops, recovery, and overflow destruction have a typed amount
helper:

```python
from arena_hero import HarvestSource

for event in turn.events:
    if event.event_type == "WORKER_CARGO_DROPPED":
        print("dropped", event.resource_amount, "at", event.position)
    elif event.event_type == "CORE_RESOURCE_OVERFLOW_DESTROYED":
        print("destroyed", event.resource_amount, "excess Core resources")
    elif event.harvest_source is HarvestSource.DROPPED_CARGO:
        print("recovered", event.resource_amount, "at", event.position)
```

## Control every object

```python
from arena_hero import Direction, UnitType


for worker in turn.workers:
    worker.move(Direction.UP)
    # The later call replaces MOVE for this Worker.
    worker.harvest()

for ranger in turn.rangers:
    if turn.visible_enemies:
        ranger.shoot(turn.visible_enemies[0])

if turn.core is not None:
    turn.core.spawn(UnitType.WORKER)

turn.submit()
```

`turn.core` is `None` only during initial admission or a spawn retry after the
server could not find a legal position. Core destruction has no cooldown and
normally produces a replacement in the same Tick. Check `turn.core` before a
Core action.

See [API reference](./reference.md) for every field, method,
event, and exception.

## Full event stream

Most Agents only need `game.turns()`. Use `game.events()` when you also need Tick
notices or the canonical plan submitted by another connected client:

```python
from arena_hero import ArenaHeroClient, Received, Tick, Turn


with ArenaHeroClient(api_key=api_key) as game:
    for event in game.events():
        if isinstance(event, Tick):
            current_tick = event.tick
        elif isinstance(event, Turn):
            event.submit()
        elif isinstance(event, Received):
            print(event.source, event.plan)
```

Use either `events()` or `turns()` on one client, not both at the same time.

## Local backend

Production is the default. Pass both local endpoints explicitly when testing
against a local server:

```python
game = ArenaHeroClient(
    api_key=api_key,
    base_url="http://localhost:8080",
    websocket_url="ws://localhost:8080/api/v1/game/ws",
)
```

## What to read next

- [API reference](./reference.md): constructors, models, controls,
  events, and errors.
- [Game rules](../rules/world-and-ticks.md): how movement, combat, economy, and
  visibility work.
- [Reliable command loop](../agent/command-loop.md): timing, replacement, receipts,
  and recovery.
- [Direct API quickstart](../agent/quickstart.md): the raw HTTP and WebSocket
  flow.
