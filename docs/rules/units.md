---
sidebar_position: 4
title: Units
description: Worker, Vanguard, and Ranger stats, actions, costs, and limits.
---

# Units

Every Unit has a stable UUID while alive, occupies one cell slot, moves at most
one cardinal cell per Tick, and performs at most one action.

## Comparison

| Unit | HP | Vision | Cost | Attack | Special role |
|---|---:|---:|---:|---:|---|
| Worker | 2 | 3 | 5 | - | Harvest and deposit |
| Vanguard | 4 | 4 | 10 | 1 sweep damage | Adjacent area pressure |
| Ranger | 2 | 5 | 12 | 1 shot damage | Range 1-3 precision attack |

All Units may `MOVE`, `PICKUP_BEACON`, `DROP_BEACON`, and `WAIT`. The other
actions depend on Unit type.

## Worker

Allowed actions:

- `MOVE`
- `HARVEST`
- `DEPOSIT`
- `PICKUP_BEACON`
- `DROP_BEACON`
- `WAIT`

`HARVEST` requires an empty-cargo Worker on a `RESOURCE` cell. It collects 1
resource normally or 2 while the owner holds the Champion Beacon. Resources do
not deplete, so multiple eligible Workers on the same resource cell each obtain
their full amount.

Cargo capacity is effectively the amount collected by the last successful
harvest: normally 1, or 2 with the Beacon bonus. Losing the Beacon does not
delete already carried bonus cargo.

`DEPOSIT` requires the Worker to share a cell with its own normal, receptive
Core. A moving or migration-recovery Core cannot accept delivery. Failure does
not delete cargo. Worker cargo disappears if the Worker dies.

Workers cannot attack.

## Vanguard

Allowed actions:

- `MOVE`
- `SWEEP` with one cardinal `direction`
- `PICKUP_BEACON`
- `DROP_BEACON`
- `WAIT`

`SWEEP` attacks the adjacent cell in the chosen direction. Every enemy Unit in
that cell takes 1 damage. An enemy Core in that cell also takes 1 damage.
Multiple Vanguards' damage accumulates in the common combat snapshot.

A sweep does not require a target UUID. It never damages allied objects.

## Ranger

Allowed actions:

- `MOVE`
- `SHOOT` with `target_id` and `expected_cell`
- `PICKUP_BEACON`
- `DROP_BEACON`
- `WAIT`

A shot is legal only when:

1. the target is an enemy Unit or Core;
2. it remains at `expected_cell`;
3. target and Ranger are on one horizontal or vertical line;
4. Manhattan distance is 1, 2, or 3;
5. no intermediate cell contains an obstacle, Unit, or Core.

The target cell can contain multiple colocated objects; `target_id` chooses one.
There is no front-to-back order among objects in that cell.

The POST endpoint deliberately accepts an unseen or nonexistent UUID so it
cannot be used to probe fog of war. At resolution, missing targets, friendly
targets, moved targets, invalid range, and blocked lines all become the same
private `SHOT_MISSED` event.

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

An action may contain only the fields listed for its `type`. An unrelated field
rejects the whole plan with `UNEXPECTED_ACTION_FIELDS`, even when its value is
`null`, an empty string, or the zero UUID.
