---
sidebar_position: 8
title: Combat
description: How sweeps, shots, simultaneous damage, and destruction resolve.
---

# Combat

## One immutable snapshot

Combat runs after movement, Beacon actions, and Worker actions, but before HP
healing, shield repair, and production. The engine freezes a single immutable
snapshot and works from it:

1. Validate every locked attack against that one snapshot.
2. Accumulate damage from every legal attack.
3. Apply all of the accumulated damage simultaneously.
4. Only then remove dead Units and destroyed Cores.

After that removal, surviving Units may heal, then the surviving Core may heal,
repair shield, or spawn. This means fatal damage cannot be healed, a repaired
shield cannot absorb damage from the Tick that just ended, and a newly spawned
Unit cannot be attacked during its birth Tick.

Because validation and damage happen against a frozen picture, an object killed
during combat still lands the legal attack it had already locked in, and mutual
destruction is a normal outcome. Nothing grants initiative — not the order
requests arrived, not the order they completed, not database row order, not
whether the plan came from Manual or Agent.

v0.1 has no random damage, dodge, critical hits, armor, automatic retaliation,
stamina, levels, or equipment.

## Vanguard sweep

```json
{"type": "SWEEP", "direction": "UP"}
```

The engine looks at the adjacent cell as it appears in the combat snapshot:

- every enemy Unit in that cell takes 1 damage;
- an enemy Core in that cell takes 1 damage;
- friendly objects take none.

Point several sweeps at the same target and their damage adds.

## Ranger shot

```json
{
  "type": "SHOOT",
  "expected_cell": [120, 85]
}
```

A Ranger may fire at any cell 1-3 cells away along a horizontal, vertical, or
exact 45-degree diagonal line, even when the cell is currently empty. Movement
resolves first. The shot hits the lowest-HP hostile then present in the cell,
with raw UUID order breaking HP ties. Relative offset `(3, 3)` is range 3;
`(2, 1)` is not a valid line. Only an obstacle in an intermediate shot cell
blocks the shot. Units and Cores do not block Ranger fire, regardless of owner.
Obstacles beside a diagonal do not block it.

Older clients may still include `target_id`. That precision mode hits only the
named object if it remains hostile and at `expected_cell`; it does not retarget
another occupant.

The endpoint checks the schema and nothing more. Every dynamic failure is deferred
to resolution, where it becomes `SHOT_MISSED`:

- the cell is empty, or a precision target is gone, friendly, or moved;
- the target is not on one of the eight firing lines or is out of range;
- an obstacle blocks the line of fire.

The ambiguity is deliberate. A cell-shot miss omits `target_id`; a hit reports
the actual object selected by the server.

## Core damage

Damage always eats shield first, then HP. If a Core is at zero HP once all combat
damage has been combined, its fleet goes away — but not before the snapshot
attacks made by its still-living Units have counted.

There is no exclusive last-hit credit. When several players damage the same
doomed target in one Tick, all of them receive destruction participation.
Destroyed-Core resources are separate: the player who dealt the most damage to
that Core during the Tick receives what fits, with raw player UUID as the tie
break. See [Destruction and respawn](./destruction-and-respawn.md#who-receives-the-inventory).

The public damage ranking counts every legal hit, including shield damage and
simultaneous damage beyond the target's remaining shield and HP. The public Core
destruction participation ranking adds 1 to every player who damaged the Core
in its destruction Tick. See the [Leaderboard API](../api/leaderboard.md).

## Information returned to the player

Combat results show up in the next `state.events`, like this:

```json
{
  "event_id": "e1841781-2a89-44e4-a5ce-d4bbc46d33a1",
  "tick": 10583,
  "event_type": "SHOT_HIT",
  "actor_id": "9d3e4941-2816-4a39-a220-df8cd95e877d",
  "target_id": "175f47f4-f7de-4785-b45c-9a2d2289a8ea",
  "position": [120, 85]
}
```

Visible Cores include `owner_username`, but objects never expose internal owner
IDs and Units never expose their owner's username. The owner of a destroyed Core
may also get a private `CORE_DESTROYED` result naming every attacker who took
part.
