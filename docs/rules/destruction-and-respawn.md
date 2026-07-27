---
sidebar_position: 8
title: Destruction and respawn
description: Core destruction consequences, respawn delay, deterministic spawn selection, and restored assets.
---

# Destruction and respawn

## Core destruction

When Core HP reaches zero:

- the Core is removed;
- all stored resources are lost;
- every Unit owned by that player is removed;
- any remaining plan for those objects becomes irrelevant;
- a carried Champion Beacon drops according to the Beacon rule;
- the player enters `RESPAWNING`.

The account and Agent access remain valid. The next state contains:

```json
{
  "status": "RESPAWNING",
  "respawn_at_tick": 10603,
  "resources": 0,
  "population": 0,
  "population_tier": 0,
  "upkeep_next_tick": 0,
  "champion_beacon": {"position": [0, 0]},
  "objects": [],
  "events": []
}
```

## Delay

The default delay is 20 logical Ticks. Downtime does not consume the delay
because the world clock pauses.

At the due Tick, the deterministic spawn resolver attempts to place the player.
If no legal location can be found, it postpones the attempt by one Tick and
uses the next deterministic candidate set.

## Restored assets

A successful respawn grants:

| Asset | Value |
|---|---:|
| New Core | 5 HP, 5 shield |
| Resources | 20 |
| Workers | 1 |
| Spawn protection | None |

The new Core and Worker receive new UUIDs. Destroyed UUIDs are never reused.

## Spawn placement

The target distance from the nearest living Core is normally:

| Constraint | Distance |
|---|---:|
| Minimum | 20 Manhattan cells |
| Maximum | 30 Manhattan cells |

Among legal passable candidates, the resolver prefers lower local entity
density. A Core spawns on legal empty terrain with at least two passable
adjacent cells.

The same Tick, world, account, and respawn count always produce the same
candidate sequence, preserving crash replay determinism.
