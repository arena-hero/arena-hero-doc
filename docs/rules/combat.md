---
sidebar_position: 6
title: Combat
description: Combat snapshot timing, Vanguard sweeps, Ranger shots, simultaneous damage, destruction participation, and privacy.
---

# Combat

## One immutable snapshot

Combat starts after movement, Beacon actions, Worker actions, production, and
shield repair. The engine freezes one immutable combat snapshot.

1. Validate every locked attack against that same snapshot.
2. Accumulate damage from every legal attack.
3. Apply all accumulated damage simultaneously.
4. Remove dead Units and destroyed Cores only after damage is applied.

An object killed during combat still completes its own already-locked legal
attack. Mutual destruction is possible. Request arrival order, HTTP completion
order, database row order, and Manual/Agent source do not grant initiative.

There is no random damage, dodge, critical hit, armor, automatic retaliation,
stamina, level, or equipment in v0.1.

## Vanguard sweep

```json
{"type": "SWEEP", "direction": "UP"}
```

The adjacent cell is inspected in the combat snapshot:

- every enemy Unit in that cell takes 1 damage;
- an enemy Core in that cell takes 1 damage;
- friendly objects take no damage.

Several sweeps can hit the same target and their damage adds.

## Ranger shot

```json
{
  "type": "SHOOT",
  "target_id": "175f47f4-f7de-4785-b45c-9a2d2289a8ea",
  "expected_cell": [120, 85]
}
```

The Ranger attacks one exact object at distance 1–3 on a horizontal or vertical
line. Every intermediate obstacle, Unit, or Core blocks the shot. The target
cell itself can contain another colocated object without creating a front/back
ordering.

The endpoint performs only static schema checks. The engine later converts all
dynamic failures into `SHOT_MISSED`, including:

- target absent;
- target friendly;
- target moved away from `expected_cell`;
- diagonal or out-of-range target;
- blocked line of fire.

This deliberate ambiguity prevents the command API from becoming a fog-of-war
oracle.

## Core damage

All damage removes shield first, then HP. If a Core reaches zero HP after all
combat damage is combined, its fleet is removed after its living Units'
snapshot attacks have contributed.

No attacker receives exclusive last-hit authority. When several players damage
the same destroyed target in one Tick, the destruction is shared rather than
assigned by input order.

## Information returned to the player

Combat results arrive in the next `state.events`, for example:

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

Enemy objects still omit usernames and owner IDs. A destroyed Core's owner may
receive a private `CORE_DESTROYED` result identifying participating attacker
usernames, but ordinary visible state never exposes them.
