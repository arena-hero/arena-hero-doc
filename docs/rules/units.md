---
sidebar_position: 4
title: Units
description: Worker, Vanguard, and Ranger stats, actions, costs, and limits.
---

# Units

Every Unit keeps a stable UUID for as long as it lives, takes up one cell slot,
moves at most one cardinal cell per Tick, and performs at most one action.

## Comparison

| Unit | HP | Vision | Cost | Attack | Special role |
|---|---:|---:|---:|---:|---|
| Worker | 2 | 3 | 5 | - | Harvest and deposit |
| Vanguard | 4 | 4 | 10 | 1 sweep damage | Adjacent area pressure |
| Ranger | 2 | 5 | 12 | 1 shot damage | Range 1-3 precision attack |

`MOVE`, `PICKUP_BEACON`, `DROP_BEACON`, `SELF_DESTRUCT`, and `WAIT` are
available to every Unit. Everything else depends on the type.

## Worker

Allowed actions:

- `MOVE`
- `HARVEST`
- `DEPOSIT`
- `PICKUP_BEACON`
- `DROP_BEACON`
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
- `SELF_DESTRUCT`
- `WAIT`

`SWEEP` hits the adjacent cell in the direction you choose. Every enemy Unit
standing there takes 1 damage, and so does an enemy Core. Send several Vanguards
at the same cell and their damage adds up inside the shared combat snapshot.

A sweep needs no target UUID, and it will never hurt your own objects.

## Ranger

Allowed actions:

- `MOVE`
- `SHOOT` with `target_id` and `expected_cell`
- `PICKUP_BEACON`
- `DROP_BEACON`
- `SELF_DESTRUCT`
- `WAIT`

A shot is legal only when all of the following hold:

1. the target is an enemy Unit or Core;
2. it is still at `expected_cell`;
3. target and Ranger sit on one horizontal or vertical line;
4. the Manhattan distance is 1, 2, or 3;
5. no cell in between holds an obstacle, Unit, or Core.

The target cell may hold several colocated objects, and `target_id` picks one of
them. There is no front-to-back ordering to exploit within a cell.

The POST endpoint accepts an unseen or even nonexistent UUID on purpose, so that
nobody can use it to probe fog of war. At resolution, a missing target, a friendly
target, a target that moved, bad range, and a blocked line all collapse into the
same private `SHOT_MISSED` event.

## Self-destruct

Every Unit can send:

```json
{"type": "SELF_DESTRUCT"}
```

It removes that Unit before upkeep is charged, so upkeep for the current Tick
uses the smaller population. The Unit performs no other action, gives no refund,
deals no area damage, and awards no destruction participation. Worker cargo
drops on the Unit's cell. A carried Beacon also drops there and cannot be picked up again
until the next Tick. The owner receives `UNIT_SELF_DESTRUCTED`, and
`units_lost` increases by one.

## Action schema examples

```json title="Worker harvest"
{"type": "HARVEST"}
```

```json title="Any Unit self-destruct"
{"type": "SELF_DESTRUCT"}
```

```json title="Vanguard sweep right"
{"type": "SWEEP", "direction": "RIGHT"}
```

```json title="Ranger shot"
{
  "type": "SHOOT",
  "target_id": "175f47f4-f7de-4785-b45c-9a2d2289a8ea",
  "expected_cell": [120, 85]
}
```

An action may carry only the fields listed for its own `type`. One unrelated field
rejects the entire plan with `UNEXPECTED_ACTION_FIELDS`, even if its value is
`null`, an empty string, or the zero UUID.
