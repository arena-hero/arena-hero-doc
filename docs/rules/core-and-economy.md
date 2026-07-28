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

Damage and upkeep shortfalls both eat shield before they touch HP. The Core is
where your resources live, and it is also what pays upkeep, receives deposits,
builds Units, repairs its own shield, and — slowly — migrates.

## Core actions

A source plan may name at most one Core action:

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

One Unit per Tick, maximum. Since a cell holds two occupying entities and the Core
already takes one of those slots, only one Unit can stand with the Core at a time
— try to spawn into a full cell and you get `CELL_UNIT_LIMIT`, with no resources
spent.

A Unit that has just been spawned:

- cannot act during the Tick it was created;
- is already in the combat snapshot, so it can be attacked;
- already blocks Ranger lines of fire;
- starts counting toward upkeep from the next Tick.

Worker deposits resolve before production, so resources delivered this Tick can
pay for a `SPAWN` or a `REPAIR_SHIELD` in the same Tick. What they cannot do is
retroactively cover the upkeep already charged at the start of it.

## Shield repair

`REPAIR_SHIELD` spends exactly 1 resource for exactly 1 shield, and it will not
push you past the current cap. When it fails you get a private
`CORE_REPAIR_FAILED` carrying either `SHIELD_FULL` or `INSUFFICIENT_RESOURCES`.

Holding the Champion Beacon lifts the cap to 10, but it gives you no free shield
to go with it. Lose the Beacon and anything above 5 is clamped straight back down
to 5.

## Four-Tick migration

Moving a Core one cardinal cell takes four logical Ticks.

```text
START_MOVE resolves  -> progress 1/4
next Tick            -> progress 2/4
next Tick            -> progress 3/4
next Tick            -> real movement attempt
```

You do not need to resend anything to keep it going, and `WAIT` will not pause it.
Changing direction means `CANCEL_MOVE` first, which resets progress to zero.

While it is migrating, a Core:

- cannot spawn, repair, or pick up and drop the Beacon;
- cannot accept Worker deposits;
- still pays upkeep and still takes damage;
- keeps its inventory;
- leaves any colocated Units behind.

A carried Beacon only follows the Core once the real move succeeds. And starting a
migration reserves nothing: other players are free to pass through the destination
or settle in it before your fourth Tick comes around.

That fourth-Tick move joins the same global movement dependency graph as Unit
movement. If it fails, the Core stays put and its progress clears.

## Population and upkeep

Population counts Units only — the Core itself is never counted:

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

Upkeep comes out automatically and costs you no action. If you cannot cover it,
your inventory drops to zero and every resource you were short deals 1 damage to
the Core, shield first. A Core destroyed during upkeep loses its fleet and its
locked plan right there — those objects take no part in the rest of the Tick.
