---
sidebar_position: 9
title: Destruction and respawn
description: What a player loses when the Core is destroyed and how respawning works.
---

# Destruction and respawn

## Core destruction

When Core HP hits zero, all of this happens at once:

- the Core is removed;
- every stored resource is lost;
- every Unit that player owns is removed;
- whatever plan those objects had stops mattering;
- a carried Champion Beacon drops according to the Beacon rule;
- the player enters `RESPAWNING`.

The account and its Agent access are untouched. Your next state looks like this:

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

The wait is 20 logical Ticks by default. Downtime does not count against it,
because the world clock is paused too.

When the due Tick arrives, the deterministic spawn resolver tries to place you. If
it cannot find a legal spot, it pushes the attempt back one Tick and works through
the next deterministic set of candidates.

## Restored assets

A successful respawn hands you:

| Asset | Value |
|---|---:|
| New Core | 5 HP, 5 shield |
| Resources | 5 |
| Workers | 1 |
| Spawn protection | None |

The new Core and Worker get fresh UUIDs. Destroyed UUIDs never come back.

## Spawn placement

The resolver aims for this distance from the nearest living Core:

| Constraint | Distance |
|---|---:|
| Minimum | 20 Manhattan cells |
| Maximum | 30 Manhattan cells |

Among the legal passable candidates it prefers somewhere with fewer entities
nearby. A Core always lands on legal empty terrain with at least two passable
neighbors.

Given the same Tick, world, account, and respawn count, the candidate sequence
comes out the same every time — which is what keeps crash replay deterministic.
