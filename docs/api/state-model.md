---
sidebar_position: 4
title: State model
description: Complete PlayerState, Champion Beacon, terrain, Core, Unit, visibility, ordering, and privacy schemas.
---

# State model

`state.data` is a complete `PlayerState`:

```ts
interface PlayerState {
  status: 'ACTIVE' | 'RESPAWNING';
  respawn_at_tick?: number;
  resources: number;
  population: number;
  population_tier: number;
  upkeep_next_tick: number;
  champion_beacon: ChampionBeacon;
  objects: WorldObject[];
  events: ResolutionEvent[];
}
```

## Top-level fields

| Field | Meaning |
|---|---|
| `status` | `ACTIVE` or waiting to respawn. |
| `respawn_at_tick` | Present only while `RESPAWNING`. |
| `resources` | Current Core inventory. |
| `population` | Living owned Units; excludes the Core. |
| `population_tier` | `floor(population / 20)`. |
| `upkeep_next_tick` | Projected next automatic upkeep. |
| `champion_beacon` | Globally public position plus visibility-gated status. |
| `objects` | All owned entities plus currently visible terrain and enemies. |
| `events` | Private resolution results from the previous Tick. |

## Champion Beacon

```ts
interface ChampionBeacon {
  position: [number, number];
  status?: 'GROUND' | 'CARRIED';
  carrier_id?: string;
}
```

`position` is always present. `status` and `carrier_id` appear only when the
Beacon cell is currently visible. `carrier_id` appears only with `CARRIED`.

## Terrain batches

Visible cells of one terrain kind are grouped:

```json
{
  "kind": "OBSTACLE",
  "positions": [[4, 7], [4, 8], [5, 8]]
}
```

```json
{
  "kind": "RESOURCE",
  "positions": [[2, 1], [9, -3]]
}
```

Terrain batches have no UUID, ownership, HP, or resource amount. If no cell of
a kind is visible, that batch may be absent.

## Core object

```json
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

A moving Core also exposes:

```json
{
  "state": "MOVING",
  "move_direction": "RIGHT",
  "move_progress": 2,
  "move_required_ticks": 4,
  "destination": [13, 8]
}
```

These migration fields are visible to enemies who can currently see the Core.

## Unit object

```json
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

`unit_type` is `WORKER`, `VANGUARD`, or `RANGER`. `cargo` is emitted only for
an owned Worker. Enemy owner identity is never emitted.

## Ownership and visibility

- `controlled: true`: owned by the requesting player.
- `controlled: false`: visible enemy.
- All owned entities are present regardless of current vision.
- Enemy entities are present only when currently visible.
- There is no last-seen timestamp; persist memory outside the authoritative
  state if needed.

## Deterministic ordering

Terrain positions and entity objects are sorted deterministically. Clients
should not rely on object-array position as identity; use `id` for Core and Unit
objects and `kind` for terrain batches.
