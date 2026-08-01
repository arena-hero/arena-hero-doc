---
sidebar_position: 2
title: API reference
description: Complete reference for clients, Turns, Unit controls, models, events, and errors.
---

# Python SDK reference

- Package: [`arena-hero`](https://github.com/arena-hero/arena-hero-python)
- Import: `arena_hero`
- Python: 3.11 or newer

All public models are typed, immutable Pydantic models. State received from the
server is validated before it reaches your loop.

## Clients

### `ArenaHeroClient`

The synchronous client:

```python
ArenaHeroClient(
    *,
    api_key: str,
    base_url: str = "https://api.arenahero.io",
    websocket_url: str | None = None,
    request_timeout: float = 5.0,
    request_retries: int = 2,
    reconnect_min_delay: float = 0.25,
    reconnect_max_delay: float = 5.0,
    max_message_size: int = 2 * 1024 * 1024,
)
```

### `AsyncArenaHeroClient`

The asynchronous client accepts the same arguments:

```python
AsyncArenaHeroClient(
    *,
    api_key: str,
    base_url: str = "https://api.arenahero.io",
    websocket_url: str | None = None,
    request_timeout: float = 5.0,
    request_retries: int = 2,
    reconnect_min_delay: float = 0.25,
    reconnect_max_delay: float = 5.0,
    max_message_size: int = 2 * 1024 * 1024,
)
```

| Argument | Meaning |
|---|---|
| `api_key` | Required credential sent as `Authorization: Bearer …`. |
| `base_url` | HTTP API base. The command endpoint is derived from it. |
| `websocket_url` | WebSocket endpoint. When omitted, it is derived from `base_url`. |
| `request_timeout` | Timeout in seconds for one HTTP command attempt. |
| `request_retries` | Number of safe HTTP retries after the first attempt. |
| `reconnect_min_delay` | Initial WebSocket reconnect delay in seconds. |
| `reconnect_max_delay` | Maximum WebSocket reconnect delay in seconds. |
| `max_message_size` | Maximum accepted WebSocket message size in bytes. |

The SDK reads none of these values from environment variables.

### `turns()`

Synchronous: `ArenaHeroClient.turns() -> Iterator[Turn]`

Asynchronous: `AsyncArenaHeroClient.turns() -> AsyncIterator[AsyncTurn]`

Yields each actionable Tick once. Receipts are still processed internally and
stored in `latest_receipts`.

### `events()`

Synchronous: `ArenaHeroClient.events() -> Iterator[Tick | Turn | Received]`

Asynchronous:
`AsyncArenaHeroClient.events() -> AsyncIterator[Tick | AsyncTurn | Received]`

Yields the complete application-level WebSocket stream:

| Event | When it appears | What to do |
|---|---|---|
| `Tick` | A new Tick has been announced. | Record it; there is no state to act on yet. |
| `Turn` / `AsyncTurn` | The complete player state is ready. | Read it, queue actions, then submit. |
| `Received` | A plan from `AGENT` or `MANUAL` was stored. | Replace the earlier receipt for that source and Tick. |

Only one `events()` or `turns()` iterator may consume a client at a time.

### `latest_receipts`

```python
from arena_hero import CommandSource


agent_receipt = game.latest_receipts.get(CommandSource.AGENT)
manual_receipt = game.latest_receipts.get(CommandSource.MANUAL)
```

This read-only mapping contains the latest current-Tick `Received` value for
each source. It is cleared when a new Tick begins.

### `submit()`

Submit an already-built complete plan:

```python
accepted = game.submit(plan, idempotency_key="agent-10583-plan-1")
```

Asynchronous:

```python
accepted = await game.submit(plan, idempotency_key="agent-10583-plan-1")
```

The return type is `Accepted`. Omitting `idempotency_key` makes the SDK generate
one. If a network failure leaves the result uncertain, the SDK retries the
exact same request bytes with the same key.

A custom key must contain 8–128 visible ASCII bytes with no spaces.

### `close()`

Closes the active WebSocket and HTTP connection pool. Prefer `with` or
`async with`, which closes the client automatically.

## Turn

`Turn` and `AsyncTurn` expose the same state and control interface. Their only
difference is that `AsyncTurn.submit()` must be awaited.

### State

| Attribute | Type | Meaning |
|---|---|---|
| `tick` | `int` | Tick this state and plan belong to. |
| `state` | `PlayerState` | Complete authoritative player-state model. |
| `resources` | `int` | Resources currently stored in the Core. |
| `resource_capacity` | `int` | Current storage capacity: `max(10, state.population * 5)`. |
| `resource_space` | `int` | Non-negative space available for another deposit. |
| `core` | `Core | None` | Controlled Core, or `None` during initial admission or a failed-spawn retry. Destruction normally replaces the Core in the same Tick. |
| `units` | `tuple[Unit, ...]` | All controlled Units. |
| `workers` | `tuple[Worker, ...]` | Controlled Workers. |
| `vanguards` | `tuple[Vanguard, ...]` | Controlled Vanguards. |
| `rangers` | `tuple[Ranger, ...]` | Controlled Rangers. |
| `visible_enemies` | `tuple[UnitView | CoreView, ...]` | Enemy objects currently visible. |
| `terrain` | `tuple[TerrainView, ...]` | Visible obstacle and currently available resource batches. |
| `resource_cells` | `frozenset[Position]` | Resource points visible and available in this Turn only. |
| `obstacle_cells` | `frozenset[Position]` | Visible obstacle cells. |
| `beacon` | `ChampionBeacon` | Current visibility-limited Beacon view. |
| `events` | `tuple[ResolutionEvent, ...]` | Private results from the previous Tick. |
| `plan` | `CommandPlan` | Complete plan currently queued in memory. |

`Position` is `tuple[int, int]` in `(x, y)` order.

### Methods

| Method | Meaning |
|---|---|
| `unit(unit_id)` | Find one controlled Unit by UUID or UUID string. |
| `clear()` | Remove every queued Unit and Core action. |
| `submit(idempotency_key=None)` | Submit the complete queued plan. |

Calling an action on a Turn after a newer Tick arrives raises
`TurnClosedError`. Never reuse controller objects from an old Turn.

## Unit controls

All controlled Unit objects expose:

| Member | Type or signature |
|---|---|
| `view` | `UnitView` |
| `id` | `UUID` |
| `position` | `Position` |
| `hp` | `int` |
| `unit_type` | `UnitType` |
| `move(direction)` | Queue a one-cell move. |
| `pickup_beacon()` | Pick up the Beacon on the current cell. |
| `drop_beacon()` | Drop a carried Beacon. |
| `self_destruct()` | Remove this Unit before upkeep, with no refund or area damage. |
| `wait()` | Queue an explicit `WAIT`. |
| `clear_action()` | Remove this Unit from the queued plan. |

Every Unit may have at most one queued action. A later method call replaces its
earlier action.

### Worker

Extra state:

| Member | Type | Meaning |
|---|---|---|
| `cargo` | `int` | Resources currently carried. |

Extra controls:

| Method | Meaning |
|---|---|
| `harvest()` | Try to consume the resource point on the current cell. |
| `deposit()` | Deposit what fits while sharing a cell with the Core; any remainder stays on the Worker. |

One successful natural harvest consumes one point. A normal winner carries
1 resource; a winner whose player holds the Beacon carries 2 from that same
point. Cargo piles dropped by dead Workers are recovered first and never yield
more than their remaining amount. If several eligible Workers harvest one cell,
only the lowest UUID succeeds and the others receive `HARVEST_FAILED` with
`RESOURCE_DEPLETED`.

A full Core resolves a deposit as `DEPOSIT_FAILED` with `CORE_RESOURCE_FULL`.
When population falls, resources above the new capacity are destroyed
immediately and reported as `CORE_RESOURCE_OVERFLOW_DESTROYED`.

### Vanguard

| Method | Meaning |
|---|---|
| `sweep(direction)` | Attack the adjacent cell in one direction. |

### Ranger

```python
ranger.shoot(target)
ranger.shoot(target_id, expected_cell=(120, 85))
```

`target` may be a visible `Unit`, `Core`, `UnitView`, or `CoreView`. The SDK
copies its UUID and current position into the command. If you pass only a UUID
or UUID string, `expected_cell` is required.

The server still resolves the shot using the game rules. Building a valid
command does not guarantee a hit.

## Core controls

The `Core` controller exposes:

| Member | Type or signature |
|---|---|
| `view` | `CoreView` |
| `id` | `UUID` |
| `position` | `Position` |
| `hp` | `int` |
| `shield` | `int` |
| `owner_username` | `str` |
| `spawn(unit_type)` | Spawn `UnitType.WORKER`, `VANGUARD`, or `RANGER`. |
| `repair_shield()` | Spend resources to repair shield. |
| `start_move(direction)` | Start moving the Core. |
| `cancel_move()` | Cancel current Core movement. |
| `pickup_beacon()` | Pick up the Beacon on the current cell. |
| `drop_beacon()` | Drop a carried Beacon. |
| `wait()` | Queue an explicit `WAIT`. |
| `clear_action()` | Remove the queued Core action. |

The Core has one action slot. As with Units, a later call replaces its earlier
queued action.

## State models

### `PlayerState`

| Field | Type |
|---|---|
| `status` | `PlayerStatus` |
| `respawn_at_tick` | `int | None` |
| `resources` | `int` |
| `population` | `int` |
| `population_tier` | `int` |
| `upkeep_next_tick` | `int` |
| `champion_beacon` | `ChampionBeacon` |
| `objects` | `tuple[TerrainView | CoreView | UnitView, ...]` |
| `events` | `tuple[ResolutionEvent, ...]` |

See [State model](../api/state-model.md) for field semantics and visibility
rules.

### Object models

| Model | Main fields |
|---|---|
| `UnitView` | `kind`, `id`, `controlled`, `position`, `hp`, `unit_type`, `cargo` |
| `CoreView` | `kind`, `id`, `controlled`, `owner_username`, `position`, `hp`, `shield`, `state`, movement fields |
| `TerrainView` | `kind`, `positions`; `RESOURCE` positions are current visible availability |
| `ChampionBeacon` | `position`, `status`, `carrier_id` |

The controller classes (`Worker`, `Vanguard`, `Ranger`, `Core`) are convenient
views over controlled objects. Enemy objects remain immutable `UnitView` or
`CoreView` models. Every Core exposes its owner's public `owner_username`
without a leading `@`; Unit owners remain private.

### `ResolutionEvent`

| Field | Type |
|---|---|
| `event_id` | `UUID` |
| `tick` | `int` |
| `event_type` | `str` |
| `reason_code` | `str | None` |
| `actor_id` | `UUID | None` |
| `target_id` | `UUID | None` |
| `position` | `Position | None` |
| `values` | `dict[str, Any] | None` |
| `resource_amount` | `int | None` |
| `harvest_source` | `HarvestSource | None` |

Event names and reason codes stay as strings so newer server values do not
break an older SDK. See [Resolution results](../api/resolution-results.md) for
their meanings.

In particular, `HARVEST_FAILED` with `RESOURCE_DEPLETED` means a lower-UUID
eligible Worker consumed the contested point in that Tick. `resource_amount`
safely reads the positive amount from `CORE_RESOURCE_OVERFLOW_DESTROYED`,
`DEPOSIT_SUCCEEDED`, `WORKER_CARGO_DROPPED`, and `HARVEST_SUCCEEDED`.
`harvest_source is HarvestSource.DROPPED_CARGO` identifies a recovery;
`HarvestSource.RESOURCE_NODE` identifies an ordinary natural harvest. Unknown
or inapplicable values return `None`.

## Rule helpers

```python
from arena_hero import (
    CORE_RESOURCE_CAPACITY_PER_UNIT,
    CORE_RESOURCE_MINIMUM_CAPACITY,
    core_resource_capacity,
)
```

`CORE_RESOURCE_CAPACITY_PER_UNIT` is `5`.
`CORE_RESOURCE_MINIMUM_CAPACITY` is `10`.
`core_resource_capacity(population)` returns
`max(10, population * 5)` and rejects a negative population.

### `Tick`, `Received`, and `Accepted`

| Model | Fields |
|---|---|
| `Tick` | `tick` |
| `Received` | `tick`, `source`, `received_at`, `plan` |
| `Accepted` | `accepted`, `tick`, `source`, `received_at` |

`Accepted` is the HTTP `202` acknowledgement. `Received` is the canonical plan
broadcast over the WebSocket to every connected client for that player.

## Command models

Most code should queue actions through a `Turn`. Advanced callers can construct
the wire models directly:

```python
from uuid import UUID

from arena_hero import CommandPlan, Direction, MoveAction


plan = CommandPlan(
    tick=10583,
    unit_actions={
        UUID("9d3e4941-2816-4a39-a220-df8cd95e877d"): MoveAction(
            direction=Direction.UP
        )
    },
)

accepted = game.submit(plan)
```

Public action models:

| Unit action | Required data |
|---|---|
| `WaitAction` | none |
| `MoveAction` | `direction` |
| `HarvestAction` | none |
| `DepositAction` | none |
| `SweepAction` | `direction` |
| `ShootAction` | `target_id`, `expected_cell` |
| `PickupBeaconAction` | none |
| `DropBeaconAction` | none |
| `SelfDestructAction` | none |

| Core action | Required data |
|---|---|
| `WaitAction` | none |
| `SpawnAction` | `unit_type` |
| `RepairShieldAction` | none |
| `StartMoveAction` | `direction` |
| `CancelMoveAction` | none |
| `PickupBeaconAction` | none |
| `DropBeaconAction` | none |

`CommandPlan.unit_actions` maps Unit UUIDs to actions.
`CommandPlan.core_action` is one Core action or `None`.

## Enums

| Enum | Values |
|---|---|
| `Direction` | `UP`, `DOWN`, `LEFT`, `RIGHT` |
| `UnitType` | `WORKER`, `VANGUARD`, `RANGER` |
| `PlayerStatus` | `ACTIVE`, `RESPAWNING` |
| `CoreState` | `NORMAL`, `MOVING` |
| `CommandSource` | `AGENT`, `MANUAL` |
| `BeaconStatus` | `GROUND`, `CARRIED` |
| `HarvestSource` | `RESOURCE_NODE`, `DROPPED_CARGO` |

`Direction.delta` returns the corresponding `(dx, dy)` tuple.

## Errors

All SDK exceptions inherit from `ArenaHeroError`.

| Exception | Meaning |
|---|---|
| `ConfigurationError` | A constructor option or idempotency key is invalid, the client is closed, or two iterators were started. |
| `AuthenticationError` | The WebSocket handshake rejected the API key. |
| `PolicyViolationError` | The WebSocket closed with policy code `1008`. |
| `ProtocolError` | A server message does not match the public protocol. |
| `APIError` | The command API returned a structured rejection. |
| `TransportError` | A network operation still failed after safe retries. |
| `TurnClosedError` | Code tried to change a Turn after it stopped being current. |
| `InvalidActionError` | A local target or action cannot be represented safely. |

`APIError` exposes `status_code`, `error`, `message`, and `details`.

Gameplay failures are not Python exceptions. They arrive in the next
`Turn.events` as `ResolutionEvent` values.

## Connection behavior

The SDK:

- sends the API key only in the `Authorization` header;
- disables WebSocket message compression to match the server;
- handles protocol Ping/Pong;
- reconnects transient WebSocket failures with jittered exponential backoff;
- stops reconnecting after close code `1008`;
- treats every `state` as a complete replacement;
- safely retries uncertain command submissions with identical bytes and the
  same idempotency key.

The server's command window is global and may already be partly spent when a
Turn arrives. Build and submit the plan promptly. Read
[Reliable command loop](../agent/command-loop.md) for the full timing and recovery
rules.
