---
sidebar_position: 2
title: Map and vision
description: How terrain, visibility, resources, and fog of war work.
---

# Map and vision

## Terrain

Every cell has exactly one terrain kind:

| Kind | Passable by Units | Passable by a moving Core | Blocks vision | Blocks Ranger fire |
|---|---:|---:|---:|---:|
| `EMPTY` | Yes | Yes | No | No |
| `RESOURCE` | Yes | No | No | No |
| `OBSTACLE` | No | No | Yes | Yes |

Cores and Units occupy cells but are not terrain. Resource cells are permanent and
infinite; harvesting one never drains it or changes what it is.

## Central resource gradient

The center of the world is `[0, 0]`. Richness falls off with Manhattan distance:

```text
d = abs(x) + abs(y)
richness(d) = 1 + 256 / (256 + d)
```

At the center, resource cells are twice as dense as the baseline. Density then
falls smoothly outward until it settles at the permanent base floor. Note that the
gradient only touches resource density — obstacle density stays constant
everywhere.

## Vision values

| Object | Manhattan radius |
|---|---:|
| Core | 5 |
| Worker | 3 |
| Vanguard | 4 |
| Ranger | 5 |

Your current private view is the union of what all your living objects can see.
Obstacles are traced with an integer supercover line: you can see the obstacle
cell itself, but nothing behind it. Where a line runs exactly through a corner
shared by two cells, both cells count, and an obstacle on either side blocks it.

Units, Cores, and resource cells do not block **vision** at all. Units and Cores do
block a Ranger's **shot** — that is a separate rule, and it is easy to conflate the
two.

## What the server sends

Each `state` carries:

- all of your own Cores and Units, even ones nothing of yours can currently see;
- enemy Cores and Units, but only while they are visible;
- visible terrain, grouped into one `OBSTACLE` object and one `RESOURCE` object;
- the Champion Beacon coordinate, which is public to everyone;
- Beacon status and carrier ID, but only while the Beacon's cell is visible.

Enemy objects come with `controlled: false` and no owner information. Worker cargo
is private, so it appears only on your own Workers.

## Exploration memory

The server sends you the current view and nothing else — it does not replay where
you have been. The web client caches that locally. An Agent that wants a map has
to save the terrain and objects it has seen itself, which is why a fresh device
starts out with only the current view.

:::warning Stale knowledge

Remembered terrain stays true, because terrain is permanent. A remembered Unit,
Core, or Beacon carrier may well have moved since you last saw it.

:::

## Champion Beacon information boundary

The coordinate is always there:

```json
{"position": [0, 0]}
```

When you can see it on the ground:

```json
{"position": [0, 0], "status": "GROUND"}
```

When you can see the carrier holding it:

```json
{
  "position": [0, 0],
  "status": "CARRIED",
  "carrier_id": "175f47f4-f7de-4785-b45c-9a2d2289a8ea"
}
```

`carrier_id` still tells you nothing about who owns the carrier.
