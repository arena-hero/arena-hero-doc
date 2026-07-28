---
sidebar_position: 3
title: Core and economy
description: How the Core stores resources, creates Units, repairs, moves, and pays upkeep.
---

# Core and economy

## Core attributes

| Attribute | Default |
|---|---:|
| Maximum HP | 5 |
| Maximum shield | 5 |
| Maximum shield while the owner holds the Beacon | 10 |
| Vision | 5 |
| Starting resources after respawn | 20 |

Damage and upkeep deficit always remove shield before HP. A Core stores the
player's resources, pays upkeep, accepts deposits, creates Units, repairs its
shield, and can migrate.

## Core actions

One source plan may specify at most one Core action:

| Action | Parameters | Purpose |
|---|---|---|
| `SPAWN` | `unit_type` | Create one Unit on the Core cell. |
| `REPAIR_SHIELD` | none | Spend 1 resource to restore 1 shield. |
| `START_MOVE` | `direction` | Begin a four-Tick migration. |
| `CANCEL_MOVE` | none | Cancel migration and clear progress. |
| `PICKUP_BEACON` | none | Pick up a ground Beacon on the same cell. |
| `DROP_BEACON` | none | Drop the Beacon carried by this Core. |
| `WAIT` | none | Explicitly take no action. |

## Production

| Unit | Cost | Spawn location |
|---|---:|---|
| Worker | 5 | Core cell |
| Vanguard | 10 | Core cell |
| Ranger | 12 | Core cell |

A Core can create at most one Unit per Tick. Every cell holds at most two
occupying entities, and the Core itself consumes one slot, so only one Unit can
share a Core cell. `CELL_UNIT_LIMIT` fails the spawn without spending resources.

A newly spawned Unit:

- cannot act in the creation Tick;
- enters the combat snapshot and can be attacked;
- blocks Ranger lines of fire;
- begins contributing to upkeep on the next Tick.

Worker deposits happen before production, so resources deposited during the
same Tick may fund `SPAWN` or `REPAIR_SHIELD`. They cannot retroactively pay the
upkeep already charged at the start of the Tick.

## Shield repair

`REPAIR_SHIELD` spends exactly 1 resource and restores exactly 1 shield. It
cannot exceed the current cap. A failed repair returns private
`CORE_REPAIR_FAILED` with `SHIELD_FULL` or `INSUFFICIENT_RESOURCES`.

Holding the Champion Beacon raises the cap to 10 but grants no free shield.
Losing the Beacon immediately clamps any shield above 5 down to 5.

## Four-Tick migration

A Core takes four logical Ticks to move one cardinal cell.

```text
START_MOVE resolves  -> progress 1/4
next Tick            -> progress 2/4
next Tick            -> progress 3/4
next Tick            -> real movement attempt
```

Migration does not require repeated commands. `WAIT` does not pause it. To
change direction, first use `CANCEL_MOVE`; cancellation resets progress.

While moving, a Core:

- cannot spawn, repair, pick up, or drop the Beacon;
- cannot accept Worker deposits;
- still pays upkeep and takes damage;
- keeps its inventory;
- does not carry colocated Units with it.

A carried Beacon follows the Core only when the real move succeeds. Starting a
migration does not reserve the destination. Other players can move through or
occupy it before the fourth Tick.

The fourth-Tick movement enters the same global movement dependency graph as
Unit movement. Failure leaves the Core in place and clears progress.

## Population and upkeep

Population counts Units, never the Core:

```text
N = Worker + Vanguard + Ranger
tier = floor(N / 20)
upkeep = tier × (tier + 1) / 2
```

| Population | Tier | Resources per Tick |
|---:|---:|---:|
| 0-19 | 0 | 0 |
| 20-39 | 1 | 1 |
| 40-59 | 2 | 3 |
| 60-79 | 3 | 6 |
| 80-99 | 4 | 10 |

Upkeep is automatic and consumes no action. If inventory is insufficient,
inventory becomes zero and each missing resource deals 1 Core damage, shield
first. A Core destroyed during upkeep loses its fleet and its locked plan
immediately; those objects do not act later in the Tick.
