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

`MOVE`, `PICKUP_BEACON`, `DROP_BEACON`, and `WAIT` are available to every Unit.
Everything else depends on the type.

## Worker

Allowed actions:

- `MOVE`
- `HARVEST`
- `DEPOSIT`
- `PICKUP_BEACON`
- `DROP_BEACON`
- `WAIT`

`HARVEST` needs an empty-cargo Worker standing on a `RESOURCE` cell. It picks up
1 resource, or 2 while its owner holds the Champion Beacon. Resource cells never
deplete, so if several eligible Workers share one cell they all take a full
amount.

Cargo capacity is really just however much the last successful harvest brought
in: 1 normally, 2 with the Beacon bonus. Losing the Beacon does not delete bonus
cargo a Worker is already carrying.

`DEPOSIT` needs the Worker to share a cell with its own Core, and that Core has to
be normal and receptive — one that is migrating or recovering from a migration
cannot take delivery. A failed deposit leaves the cargo alone; only the Worker's
death destroys it.

Workers cannot attack at all.

## Vanguard

Allowed actions:

- `MOVE`
- `SWEEP` with one cardinal `direction`
- `PICKUP_BEACON`
- `DROP_BEACON`
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

## Action schema examples

```json title="Worker harvest"
{"type": "HARVEST"}
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
