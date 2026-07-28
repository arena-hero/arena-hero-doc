---
sidebar_position: 3
title: State model
description: PlayerState fields, JSON examples, world objects, visibility, and update rules.
toc_min_heading_level: 2
toc_max_heading_level: 3
---

# State model

`state.data` is what this player can see right now. Each message replaces the
previous state.

<nav className="api-model-nav" aria-label="State model sections">
  <strong>Jump to</strong>
  <a href="#playerstate">PlayerState</a>
  <a href="#champion-beacon">Champion Beacon</a>
  <a href="#world-objects">World objects</a>
  <a href="#visibility">Visibility</a>
  <a href="#updating-state">Updating state</a>
</nav>

## Read a state

| Rule | Client behavior |
|---|---|
| A new message arrives | Replace the previous `PlayerState`. Do not merge arrays. |
| You read an object | Check `kind` first, then read the fields listed for that kind. |
| You need its owner | `controlled: true` means yours; `false` means a visible enemy. |
| A field is missing | Its value is unknown or does not apply. The server does not send `null`. |

```json title="Minimal state message"
{
  "type": "state",
  "data": {
    "status": "ACTIVE",
    "resources": 20,
    "population": 1,
    "population_tier": 0,
    "upkeep_next_tick": 0,
    "champion_beacon": {"position": [0, 0]},
    "objects": [
      {
        "kind": "CORE",
        "id": "2ea3c3dc-42b0-4b92-9754-7558bd4ff834",
        "controlled": true,
        "position": [12, 8],
        "hp": 5,
        "shield": 5,
        "state": "NORMAL"
      },
      {
        "kind": "UNIT",
        "id": "9d3e4941-2816-4a39-a220-df8cd95e877d",
        "controlled": true,
        "position": [11, 8],
        "hp": 2,
        "unit_type": "WORKER",
        "cargo": 0
      }
    ],
    "events": []
  }
}
```

For machine-readable definitions, use the [AsyncAPI schema](/asyncapi.yaml).

## PlayerState {#playerstate}

| Field | Format | Required | Meaning |
|---|---|---:|---|
| `status` | `"ACTIVE"` or `"RESPAWNING"` | Yes | Whether the player has an active Core or is waiting to respawn. |
| `respawn_at_tick` | positive int64 | Only when respawning | Tick of the next respawn attempt. |
| `resources` | integer ≥ 0 | Yes | Resources stored by the Core; Worker cargo is separate. |
| `population` | integer ≥ 0 | Yes | Living owned Units; the Core is not counted. |
| `population_tier` | integer ≥ 0 | Yes | `floor(population / 20)`. |
| `upkeep_next_tick` | integer ≥ 0 | Yes | `tier × (tier + 1) / 2` for the current population. |
| `champion_beacon` | object | Yes | Public position and, when visible, carrier state. |
| `objects` | array | Yes | Owned entities plus currently visible terrain and enemies. |
| `events` | array | Yes | Resolution results addressed to this player. |

`objects` and `events` are empty arrays when there are no entries. While
`RESPAWNING`, the resource and population fields remain present, but there may
be no owned Core until `CORE_RESPAWNED`.

## Champion Beacon {#champion-beacon}

The Beacon position is always public. The other fields depend on visibility.

### Outside vision

```json
{
  "position": [120, 85]
}
```

Only the position is known. The state does not tell you whether the Beacon is
on the ground or being carried.

### Visible on the ground

```json
{
  "position": [120, 85],
  "status": "GROUND"
}
```

`carrier_id` is absent.

### Visible and carried

```json
{
  "position": [120, 85],
  "status": "CARRIED",
  "carrier_id": "9d3e4941-2816-4a39-a220-df8cd95e877d"
}
```

`carrier_id` identifies the carrying Core or Unit. If the next state omits
`status` or `carrier_id`, discard the previous value.

## World objects {#world-objects}

Every entry in `objects` starts with `kind`.

| `kind` | Represents | Identity |
|---|---|---|
| `"CORE"` | One Core | `id` |
| `"UNIT"` | One Worker, Vanguard, or Ranger | `id` |
| `"OBSTACLE"` | All visible obstacle cells | Individual positions |
| `"RESOURCE"` | All visible resource cells | Individual positions |

```js title="Dispatch by kind"
for (const object of state.objects) {
  if (object.kind === 'CORE') handleCore(object);
  else if (object.kind === 'UNIT') handleUnit(object);
  else handleTerrain(object);
}
```

### Terrain

```json
{
  "kind": "OBSTACLE",
  "positions": [[4, 7], [4, 8], [5, 8]]
}
```

| Field | Format | Meaning |
|---|---|---|
| `kind` | `"OBSTACLE"` or `"RESOURCE"` | Terrain type. |
| `positions` | non-empty array of `[x, y]` | Visible cells, sorted by `x` and then `y`. |

All visible cells of one terrain kind are grouped into one entry. A missing
kind means no cell of that kind is currently visible. Terrain has no `id`,
`controlled`, HP, or resource quantity.

### Core

```json title="Normal Core"
{
  "kind": "CORE",
  "id": "2ea3c3dc-42b0-4b92-9754-7558bd4ff834",
  "controlled": true,
  "position": [12, 8],
  "hp": 5,
  "shield": 4,
  "state": "NORMAL"
}
```

```json title="Moving Core"
{
  "kind": "CORE",
  "id": "2ea3c3dc-42b0-4b92-9754-7558bd4ff834",
  "controlled": true,
  "position": [12, 8],
  "hp": 5,
  "shield": 4,
  "state": "MOVING",
  "move_direction": "RIGHT",
  "move_progress": 2,
  "move_required_ticks": 4,
  "destination": [13, 8]
}
```

| Field | Format | Required |
|---|---|---:|
| `kind` | `"CORE"` | Yes |
| `id` | UUID | Yes |
| `controlled` | boolean | Yes |
| `position` | `[x, y]` | Yes; remains the origin while moving |
| `hp` | integer ≥ 0 | Yes |
| `shield` | integer ≥ 0 | Yes |
| `state` | `"NORMAL"` or `"MOVING"` | Yes |
| `move_direction` | direction string | Moving only |
| `move_progress` | integer ≥ 1 | Moving only |
| `move_required_ticks` | integer ≥ 1 | Moving only; currently `4` |
| `destination` | `[x, y]` | Moving only |

For a normal Core, all movement fields are absent. A visible enemy Core exposes
the same movement fields.

### Unit

```json title="Owned Worker"
{
  "kind": "UNIT",
  "id": "9d3e4941-2816-4a39-a220-df8cd95e877d",
  "controlled": true,
  "position": [11, 8],
  "hp": 2,
  "unit_type": "WORKER",
  "cargo": 1
}
```

| Field | Format | Required |
|---|---|---:|
| `kind` | `"UNIT"` | Yes |
| `id` | UUID | Yes |
| `controlled` | boolean | Yes |
| `position` | `[x, y]` | Yes |
| `hp` | integer ≥ 0 | Yes |
| `unit_type` | `"WORKER"`, `"VANGUARD"`, or `"RANGER"` | Yes |
| `cargo` | integer ≥ 0 | Owned Worker only |

Enemy Worker cargo is hidden. Vanguard and Ranger never contain `cargo`,
including owned ones.

## Visibility {#visibility}

| Data | Included when | Hidden fields |
|---|---|---|
| Owned Core and Units | Always | None from their object format |
| Enemy Core and Units | Their cell is currently visible | Owner identity; enemy Worker cargo |
| Terrain | Its cell is currently visible | Resource quantity |
| Beacon position | Always | None |
| Beacon status and carrier | Beacon cell is currently visible | Both fields outside vision |

There is no last-seen timestamp. Keep remembered terrain separately from the
current server state.

## Updating state {#updating-state}

Rebuild entity maps from every new state:

```js
const entities = new Map();

for (const object of nextState.objects) {
  if (object.kind === 'CORE' || object.kind === 'UNIT') {
    entities.set(object.id, object);
  }
}
```

The server emits objects in deterministic order:

1. obstacle batch;
2. resource batch;
3. owned Core;
4. owned Units by UUID;
5. visible enemy Cores by UUID;
6. visible enemy Units by UUID.

Missing groups are skipped. Array index is never object identity.
