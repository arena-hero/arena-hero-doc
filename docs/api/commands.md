---
sidebar_position: 4
title: Command API
description: Submit a plan, choose Unit and Core actions, retry safely, and understand replacement and limits.
---

# Command API

Send one plan after each `state` message:

```http
POST /api/v1/game/commands HTTP/1.1
Host: api.arenahero.io
Authorization: Bearer <token>
Idempotency-Key: agent-10583-plan-01
Content-Type: application/json
```

```json
{
  "tick": 10583,
  "unit_actions": {
    "9d3e4941-2816-4a39-a220-df8cd95e877d": {
      "type": "SHOOT",
      "target_id": "175f47f4-f7de-4785-b45c-9a2d2289a8ea",
      "expected_cell": [120, 85]
    }
  },
  "core_action": {
    "type": "SPAWN",
    "unit_type": "VANGUARD"
  }
}
```

An Agent request replaces the player's current `AGENT` plan. Send it only after
the `state` for that Tick arrives.

## Headers

| Header | Required | Format | What it does |
|---|---:|---|---|
| `Authorization` | Yes | `Bearer <token>` | Identifies the Agent. |
| `Content-Type` | Yes | `application/json` | `charset=utf-8` and other parameters are allowed. |
| `Idempotency-Key` | Yes | 8-128 bytes in ASCII `0x21`-`0x7e` | Identifies this request and its exact body. |

The maximum body size depends on the deployment. A body over that limit returns
`413 REQUEST_BODY_TOO_LARGE`.

## Plan body {#commandplan-model}

| Field | JSON type | Required | What to send |
|---|---|---:|---|
| `tick` | integer | Yes | The positive int64 from the latest `tick` message. |
| `unit_actions` | object | No | Unit UUIDs mapped to actions. Use `{}` when no Unit acts. |
| `core_action` | object | No | One Core action. Omit it when the Agent has no Core action. |

`unit_actions` is an object, not an array. Each key must be the lowercase,
hyphenated UUID of a living Unit owned by the player. Never generate duplicate
JSON keys.

### A POST replaces the earlier plan

Suppose the stored Agent plan says:

```text
Unit A: MOVE
Unit B: HARVEST
```

The next body contains only:

```text
Unit A: WAIT
```

The stored Agent plan now contains `WAIT` for Unit A and no action for Unit B.
Unit B also resolves to `WAIT` unless the Manual source supplies an action. The
server does not copy missing actions from the previous Agent plan.

## Unit actions

Read `type` first. Send only the fields shown in that row.

| `type` | Unit | JSON | What happens during resolution |
|---|---|---|---|
| `WAIT` | Any | `{"type":"WAIT"}` | The Unit does nothing. |
| `MOVE` | Any | `{"type":"MOVE","direction":"RIGHT"}` | The Unit tries to move one cardinal cell. |
| `HARVEST` | Worker | `{"type":"HARVEST"}` | Loads 1 resource, or 2 while the player holds the Beacon. |
| `DEPOSIT` | Worker | `{"type":"DEPOSIT"}` | Moves all cargo into the player's Core on the same cell. |
| `SWEEP` | Vanguard | `{"type":"SWEEP","direction":"UP"}` | Deals 1 damage to each enemy entity in the adjacent cell. |
| `SHOOT` | Ranger | `{"type":"SHOOT","target_id":"<uuid>","expected_cell":[120,85]}` | Tries to hit that target at that cell from cardinal range 1-3. |
| `PICKUP_BEACON` | Any | `{"type":"PICKUP_BEACON"}` | Tries to pick up the ground Beacon on the actor's cell. |
| `DROP_BEACON` | Any | `{"type":"DROP_BEACON"}` | The current carrier tries to drop the Beacon. |

### Moving

`direction` must be `UP`, `DOWN`, `LEFT`, or `RIGHT`.

The server checks terrain, other movement, occupancy, swaps, dependencies, and
cell capacity during resolution. If the move fails, the next state contains
`UNIT_MOVE_FAILED`.

### Harvesting and depositing

Only a Worker can use these actions.

- `HARVEST` needs an empty Worker on a `RESOURCE` cell.
- Resource cells never run out.
- `DEPOSIT` needs a Worker with cargo and the player's Core on the same cell.
- A Core cannot receive a deposit during a migration-restricted Tick.
- A failed deposit leaves the cargo on the Worker.

### Sweeping

`SWEEP` targets the adjacent cell in `direction`. Every enemy Unit and Core in
that cell takes 1 damage. Sweeping an empty cell still succeeds and reports
`targets_hit: 0`.

### Shooting

A shot needs both fields:

| Field | Format | Meaning |
|---|---|---|
| `target_id` | UUID | The Unit or Core the Ranger is trying to hit. |
| `expected_cell` | `[x, y]` | Where the Agent expects that target to be during resolution. |

The target must still be an enemy at `expected_cell`, on the same row or column,
at range 1-3. No obstacle or entity may sit between the Ranger and the target.

Every dynamic failure returns the same event:
`{"event_type":"SHOT_MISSED","reason_code":"SHOT_MISSED"}`. The result does not
reveal whether the target moved, was friendly, was out of range, or was hidden
behind something.

### Picking up and dropping the Beacon

Any Unit can use the two Beacon actions.

- The ground Beacon must be on the actor's cell for pickup.
- Only the current carrier can drop it.
- A living carrier cannot be robbed.
- If several actors try to pick it up, the lowest UUID by raw byte order wins.
- A Beacon carried at the start of a Tick cannot be dropped and picked up again in that Tick.

## Core actions

| `type` | JSON | What happens during resolution |
|---|---|---|
| `WAIT` | `{"type":"WAIT"}` | No new Core action. An existing migration continues. |
| `SPAWN` | `{"type":"SPAWN","unit_type":"WORKER"}` | Pays the cost and creates one Unit on the Core cell. |
| `REPAIR_SHIELD` | `{"type":"REPAIR_SHIELD"}` | Pays 1 resource to restore 1 shield, up to the current cap. |
| `START_MOVE` | `{"type":"START_MOVE","direction":"LEFT"}` | Starts a four-Tick migration to an adjacent empty cell. |
| `CANCEL_MOVE` | `{"type":"CANCEL_MOVE"}` | Stops the current migration and clears its progress. |
| `PICKUP_BEACON` | `{"type":"PICKUP_BEACON"}` | A normal Core tries to pick up the Beacon on its cell. |
| `DROP_BEACON` | `{"type":"DROP_BEACON"}` | A carrier Core tries to drop the Beacon. |

`unit_type` must be `WORKER`, `VANGUARD`, or `RANGER`. Their current costs are
5, 10, and 12 resources.

A moving Core may continue with `WAIT` or stop with `CANCEL_MOVE`. Any other
Core action fails with `CORE_ALREADY_MOVING`. `CANCEL_MOVE` fails with
`CORE_NOT_MOVING` when the Core is not moving.

## Extra fields make an action invalid

An action may contain only the fields listed for its `type`. All of these
examples reject the whole plan:

```json
{"type":"WAIT","direction":"UP"}
{"type":"HARVEST","target_id":null}
{"type":"MOVE","direction":"UP","expected_cell":[1,2]}
{"type":"SPAWN","unit_type":"WORKER","direction":""}
```

These usually return the validation reason `UNEXPECTED_ACTION_FIELDS`.

## Accepted response

```http
HTTP/1.1 202 Accepted
Content-Type: application/json; charset=utf-8
```

```json
{
  "accepted": true,
  "tick": 10583,
  "source": "AGENT",
  "received_at": "2026-07-27T05:40:06.241Z"
}
```

`202` means the plan was stored. It does not mean its actions succeeded. The
WebSocket [`received`](./websocket.md#received) message contains the plan the
server stored, and the next [`state.events`](./resolution-results.md) contains
the action results.

A rejected request leaves the last valid plan in place.

## Safe retries

The idempotency key may contain 8-128 visible ASCII bytes (`0x21`-`0x7e`).
Spaces, tabs, and line breaks are not allowed.

| What you send | What the server does |
|---|---|
| Same key and byte-for-byte identical body | Returns the stored response. It does not store or broadcast the plan again. |
| Same key and equivalent JSON with different whitespace or key order | Returns `409 IDEMPOTENCY_CONFLICT`. |
| Same key and different data | Returns `409 IDEMPOTENCY_CONFLICT`. |
| New key | Handles it as a new plan replacement. |

If the connection drops after upload and you do not know the result, retry the
exact same bytes with the same key. Use a new key only after making a new plan.

## What the server checks

```text
authentication
-> concurrent body limit
-> media type and Idempotency-Key
-> body size and JSON shape
-> Tick window and request rate
-> Unit and Core action fields
-> store the replacement plan
-> return 202 and send received
-> resolve the game
-> send results in the next state.events
```

Any error before storage rejects the whole body. A failure during game
resolution does not bring back an older plan and does not change the earlier
`202`.

## Concurrency and rate limits

- The server reads at most four command bodies at once for one
  `(player, credential kind)`. Extra requests return
  `429 COMMAND_CONCURRENCY_LIMIT` with `Retry-After: 1`.
- One `(player, Tick, source)` may make at most 64 new admissions after the
  idempotency check. Invalid commands count. Extra requests return
  `429 COMMAND_RATE_LIMITED`.
- Valid requests for the same plan slot are handled in gate-entry order. The
  last successful plan replaces the earlier one.

See [Errors and recovery](./errors.md) for every HTTP error and validation
reason.
