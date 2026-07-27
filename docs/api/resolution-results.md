---
sidebar_position: 5
title: Resolution results
description: The event objects embedded in state, common result types, reason codes, privacy, and dynamic-failure interpretation.
---

# Resolution results

Dynamic action results are embedded in the next complete `state`. This page
describes that game-protocol field.

## Schema

```ts
interface ResolutionEvent {
  event_id: string;
  tick: number;
  event_type: string;
  reason_code?: string;
  actor_id?: string;
  target_id?: string;
  position?: [number, number];
  values?: Record<string, unknown>;
}
```

Fields are omitted when irrelevant. `event_id` is a UUID. A player receives only
their own resolution results.

## Common successful results

| Event type | Meaning |
|---|---|
| `UNIT_MOVE_SUCCEEDED` | A Unit completed its one-cell move. |
| `CORE_MOVE_STARTED` | A new four-Tick migration began. |
| `CORE_MOVE_PROGRESS` | An existing migration advanced. |
| `CORE_MOVE_SUCCEEDED` | The fourth-Tick real move completed. |
| `HARVEST_SUCCEEDED` | Worker loaded resources. |
| `DEPOSIT_SUCCEEDED` | Worker transferred all cargo. |
| `CORE_SPAWN_SUCCEEDED` | Core created one Unit. |
| `CORE_REPAIR_SUCCEEDED` | Core restored one shield. |
| `SWEEP_RESOLVED` | Vanguard sweep resolved. |
| `SHOT_HIT` | Ranger hit the requested target. |
| `BEACON_PICKED_UP` | Object became the carrier. |
| `BEACON_DROPPED` | Carrier placed the Beacon on the ground. |
| `CORE_RESPAWNED` | Player re-entered with a new Core and Worker. |

## Common failure reasons

| Context | Reason examples |
|---|---|
| Movement | `MOVE_BLOCKED_TERRAIN`, `MOVE_CONTESTED`, `MOVE_SWAP_BLOCKED`, `MOVE_DESTINATION_OCCUPIED`, `MOVE_DEPENDENCY_FAILED`, `CELL_UNIT_LIMIT` |
| Core migration | `CORE_ALREADY_MOVING`, `CORE_NOT_MOVING`, `CORE_DESTINATION_TERRAIN_BLOCKED`, `CORE_DESTINATION_OCCUPIED` |
| Worker | `NOT_RESOURCE_CELL`, `CARGO_FULL`, `WORKER_EMPTY`, `CORE_MOVING`, `CORE_NOT_PRESENT` |
| Core economy | `INSUFFICIENT_RESOURCES`, `SHIELD_FULL`, `CELL_UNIT_LIMIT` |
| Beacon | `BEACON_NOT_PRESENT`, `ALREADY_CARRIED`, `NOT_BEACON_CARRIER`, `CORE_MOVING` |
| Ranger | Always reported as `SHOT_MISSED` for dynamic failure. |

Reason codes describe the owner's own action outcome. They must not be used to
infer hidden enemy state beyond what the protocol intentionally reveals.

## Example

```json
{
  "event_id": "42b2cc96-2a75-41a6-bb35-405d57239d54",
  "tick": 10583,
  "event_type": "UNIT_MOVE_FAILED",
  "reason_code": "MOVE_CONTESTED",
  "actor_id": "9d3e4941-2816-4a39-a220-df8cd95e877d",
  "position": [120, 85]
}
```

An HTTP `202` and later dynamic failure are compatible: the former confirms
that the plan was accepted; the latter reports what happened when all players'
plans resolved together.
