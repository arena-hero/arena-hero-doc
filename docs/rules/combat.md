---
sidebar_position: 8
title: Combat
description: How sweeps, shots, simultaneous damage, and destruction resolve.
---

# Combat

## One immutable snapshot

Combat runs last, after movement, Beacon actions, Worker actions, production, and
shield repair are all done. At that point the engine freezes a single immutable
snapshot and works from it:

1. Validate every locked attack against that one snapshot.
2. Accumulate damage from every legal attack.
3. Apply all of the accumulated damage simultaneously.
4. Only then remove dead Units and destroyed Cores.

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
  "target_id": "175f47f4-f7de-4785-b45c-9a2d2289a8ea",
  "expected_cell": [120, 85]
}
```

A Ranger attacks one specific object 1-3 cells away, along a horizontal or
vertical line. Anything in between — obstacle, Unit, or Core — blocks the shot.
The target cell itself may hold another colocated object without that creating any
front/back ordering.

The endpoint checks the schema and nothing more. Every dynamic failure is deferred
to resolution, where it becomes `SHOT_MISSED`:

- the target is gone;
- the target is friendly;
- the target moved off `expected_cell`;
- the target is diagonal or out of range;
- the line of fire is blocked.

The ambiguity is deliberate. It stops the command API from doubling as a
fog-of-war oracle.

## Core damage

Damage always eats shield first, then HP. If a Core is at zero HP once all combat
damage has been combined, its fleet goes away — but not before the snapshot
attacks made by its still-living Units have counted.

There is no last-hit authority to claim. When several players damage the same
doomed target in one Tick, they share the destruction rather than having it
awarded by input order.

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

Enemy objects still arrive without usernames or owner IDs. The owner of a
destroyed Core may get a private `CORE_DESTROYED` result naming the attackers who
took part, but ordinary visible state never exposes them.
