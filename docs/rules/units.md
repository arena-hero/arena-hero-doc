---
sidebar_position: 4
title: Units
description: Worker, Vanguard, and Ranger stats, actions, costs, and limits.
---

# Units

Every Unit keeps a stable UUID for as long as it lives, takes up one cell slot,
moves at most one cardinal cell per Tick, and performs at most one action.

## Comparison

| Unit | HP | Vision | Base price | Attack | Special role |
|---|---:|---:|---:|---:|---|
| Worker | 2 | 3 | 5 | - | Harvest and deposit |
| Vanguard | 4 | 4 | 10 | 1 sweep damage | Adjacent area pressure |
| Ranger | 2 | 5 | 12 | 1 shot damage | Eight-direction range 1-3 precision attack |

`MOVE`, `PICKUP_BEACON`, `DROP_BEACON`, `HEAL`, `SELF_DESTRUCT`, and `WAIT` are
available to every Unit. Everything else depends on the type.

These are base prices for population 0-19. The next Unit becomes more expensive
from population 20 onward; see [Production and dynamic prices](./core-and-economy.md#production-and-dynamic-prices).

## Worker

Allowed actions:

- `MOVE`
- `HARVEST`
- `DEPOSIT`
- `PICKUP_BEACON`
- `DROP_BEACON`
- `HEAL`
- `SELF_DESTRUCT`
- `WAIT`

`HARVEST` needs an empty-cargo Worker standing on a `RESOURCE` cell. Natural
points yield 1 resource, or 2 while the owner holds the Champion Beacon, and are
then consumed. Cargo dropped by a dead Worker is recovered first: a normal
Worker takes 1, while a Beacon Worker takes at most 2 without exceeding the
pile's actual remainder.

If several eligible empty Workers harvest the same point in one Tick, only the
Worker with the lowest UUID in raw-byte order succeeds. The point is consumed
once. Every other contender receives `HARVEST_FAILED` with
`RESOURCE_DEPLETED`; Beacon ownership does not change the tie-break.

Cargo capacity is really just however much the last successful harvest or
recovery brought in: normally 1, and at most 2 with the Beacon. Losing the
Beacon does not delete cargo a Worker is already carrying.

`DEPOSIT` needs the Worker to share a cell with its own Core, and that Core has to
be normal and receptive — one that is migrating or recovering from a migration
cannot take delivery. Core capacity is `max(10, population × 5)`. A deposit
moves only what fits and leaves any remainder on the Worker. A full Core
returns `CORE_RESOURCE_FULL`; every failed deposit leaves the cargo alone. If
the Worker dies for any reason, all cargo becomes a resource pile on its final
cell.

Workers cannot attack at all.

## Vanguard

Allowed actions:

- `MOVE`
- `SWEEP` with one cardinal `direction`
- `PICKUP_BEACON`
- `DROP_BEACON`
- `HEAL`
- `SELF_DESTRUCT`
- `WAIT`

`SWEEP` hits the adjacent cell in the direction you choose. Every enemy Unit
standing there takes 1 damage, and so does an enemy Core. Send several Vanguards
at the same cell and their damage adds up inside the shared combat snapshot.

A sweep needs no target UUID, and it will never hurt your own objects.

## Ranger

Allowed actions:

- `MOVE`
- `SHOOT` with `expected_cell` and an optional `target_id`
- `PICKUP_BEACON`
- `DROP_BEACON`
- `HEAL`
- `SELF_DESTRUCT`
- `WAIT`

A cell shot is legal only when all of the following hold:

1. `expected_cell` and Ranger share a horizontal, vertical, or exact 45-degree diagonal line;
2. the distance along that line is 1, 2, or 3 — `(3, 3)` is range 3, while `(2, 1)` is not aligned;
3. no cell in between holds an obstacle.

Movement resolves first. If the cell contains hostiles, the server hits the one
with the lowest HP, breaking ties by raw UUID order. If no hostile remains, the
shot misses normally. Units and Cores never block Ranger fire, regardless of
owner. There is no front-to-back ordering to exploit within a cell. For diagonal
fire, only the intermediate diagonal cells are checked; obstacles beside the
line do not block it.

For backward-compatible precision fire, include `target_id`; that mode hits only
that object if it is still hostile and at `expected_cell`. The POST endpoint
still accepts an unseen or even nonexistent UUID on purpose. At resolution, an
empty cell, a missing or moved precision target, bad range, and a blocked line
all collapse into the same private `SHOT_MISSED` event.

## Self-destruct

Every Unit can send:

```json
{"type": "SELF_DESTRUCT"}
```

It removes that Unit before movement, so the Core action later in the Tick uses
the smaller population when pricing a spawn. The Unit performs no other action, gives no refund,
deals no area damage, and awards no destruction participation. Worker cargo
drops on the Unit's cell. A carried Beacon also drops there and cannot be picked up again
until the next Tick. The owner receives `UNIT_SELF_DESTRUCTED`, and
`units_lost` increases by one.

## Healing

Every Unit can send:

```json
{"type": "HEAL"}
```

The Unit gives up its complete action for this Tick. After combat, it must still
be alive and share a cell with its own stationary Core. The action spends one
Core resource per missing HP and can restore several HP at once, stopping at
full HP or when resources run out. Unit heals resolve by raw Unit UUID before
the Core action. A fatal hit removes the Unit before healing. A full-HP or
currently unfunded heal is still a valid plan; if nothing changes before
resolution, it fails without spending resources.

A Unit killed by combat is already gone and spends nothing.

## Action schema examples

```json title="Worker harvest"
{"type": "HARVEST"}
```

```json title="Any Unit self-destruct"
{"type": "SELF_DESTRUCT"}
```

```json title="Any Unit heal"
{"type": "HEAL"}
```

```json title="Vanguard sweep right"
{"type": "SWEEP", "direction": "RIGHT"}
```

```json title="Ranger cell shot"
{
  "type": "SHOOT",
  "expected_cell": [120, 85]
}
```

An action may carry only the fields listed for its own `type`. One unrelated field
rejects the entire plan with `UNEXPECTED_ACTION_FIELDS`, even if its value is
`null`, an empty string, or the zero UUID.
