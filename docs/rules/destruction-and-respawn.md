---
sidebar_position: 9
title: Destruction and respawn
description: What a player loses when the Core is destroyed and how respawning works.
---

# Destruction and respawn

## Core destruction

When Core HP hits zero, all of this happens at once:

- the Core is removed;
- if combat destroyed it, its inventory is offered to the player who dealt the
  most damage to that Core during this Tick;
- every Unit that player owns is removed;
- whatever plan those objects had stops mattering;
- a carried Champion Beacon drops according to the Beacon rule;
- the player temporarily enters `RESPAWNING` while the resolver prepares a new spawn.

The account and its Agent access are untouched.

## Who receives the inventory

Every attacker still receives normal Core-destruction participation. Resource
ownership is a separate deterministic decision:

1. Add each player's damage to this Core during its destruction Tick.
2. Highest damage wins; tied damage goes to the player with the lower raw UUID.
3. The winner must still have a living Core after all combat damage is applied.
4. Store only what fits under the winner's post-combat
   `max(10, population × 5)` capacity. Destroy the excess.

If the winner's Core also dies in this combat Tick, the victim's entire
inventory is destroyed. It does not enter the replacement Core and does not
pass to the runner-up. A Core destroyed by upkeep deficit never yields loot.

When several Cores die in one Tick, victims resolve by raw player UUID order.
Earlier captures therefore consume capacity before later ones. A surviving
winner receives private `CORE_RESOURCES_CAPTURED` values:

```json
{"amount":3,"available":8,"destroyed":5,"capacity":10}
```

`amount` is what entered storage, `available` is the victim's inventory before
destruction, and `destroyed` is what did not fit. The event is still sent with
`amount: 0` when the winner is already full.

## Immediate respawn

There is no respawn cooldown. Later in the same resolution Tick, the deterministic
spawn resolver immediately tries to place the replacement Core and Worker. Under
normal conditions, your next published state is already `ACTIVE`, and that state's
events contain both `CORE_DESTROYED` and `CORE_RESPAWNED`.

Only a failed placement leaves the player in `RESPAWNING`. In that exceptional
case, the next published state looks like this:

```json
{
  "status": "RESPAWNING",
  "respawn_at_tick": 10604,
  "resources": 0,
  "population": 0,
  "population_tier": 0,
  "upkeep_next_tick": 0,
  "champion_beacon": {"position": [0, 0]},
  "objects": [],
  "events": []
}
```

`respawn_at_tick` is the next retry Tick, not a cooldown deadline. Each failed
attempt advances it by one Tick and uses the next deterministic candidate set.

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
