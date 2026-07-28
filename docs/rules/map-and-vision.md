---
sidebar_position: 2
title: Map and vision
description: How terrain, visibility, resources, and fog of war work.
---

# Map and vision

## Terrain

A cell has exactly one terrain kind:

| Kind | Passable by Units | Passable by a moving Core | Blocks vision | Blocks Ranger fire |
|---|---:|---:|---:|---:|
| `EMPTY` | Yes | Yes | No | No |
| `RESOURCE` | Yes | No | No | No |
| `OBSTACLE` | No | No | Yes | Yes |

Core and Unit objects occupy cells but are not terrain. Resources are permanent,
infinite resource points; harvesting never depletes or changes the cell.

## Central resource gradient

The center is `[0, 0]`. Manhattan distance and richness are:

```text
d = abs(x) + abs(y)
richness(d) = 1 + 256 / (256 + d)
```

The center has twice the base resource-cell density. Density decreases smoothly
toward the permanent base-density floor. The gradient changes only resource
density; obstacle density remains constant.

## Vision values

| Object | Manhattan radius |
|---|---:|
| Core | 5 |
| Worker | 3 |
| Vanguard | 4 |
| Ranger | 5 |

The current private view is the union of all living owned objects' vision.
Obstacles use an integer supercover line. The obstacle cell itself is visible,
but cells behind it are not. When a line passes exactly through a corner shared
by two cells, both cells count; an obstacle on either side blocks the line.

Units, Cores, and resource cells do not block **vision**. Units and Cores do
block a Ranger's **shot**, which is a separate rule.

## What the server sends

Each `state` contains:

- every owned Core and Unit, even if outside all current vision;
- enemy Core and Unit objects only when currently visible;
- visible terrain, grouped into one `OBSTACLE` object and one `RESOURCE` object;
- the globally public Champion Beacon coordinate;
- Beacon status and carrier ID only when the Beacon cell is currently visible.

Enemy objects have `controlled: false` and omit owner information. Worker cargo
is private and appears only on an owned Worker.

## Exploration memory

The server sends the current view, not the player's exploration history. The
web client keeps a local cache. An Agent that needs memory must save previously
seen terrain and objects itself. A new device starts with only the current view.

:::warning Stale knowledge

Remembered terrain stays valid because terrain is permanent. A remembered Unit,
Core, or Beacon carrier may already have moved.

:::

## Champion Beacon information boundary

The coordinate is always present:

```json
{"position": [0, 0]}
```

When visible on the ground:

```json
{"position": [0, 0], "status": "GROUND"}
```

When a visible carrier holds it:

```json
{
  "position": [0, 0],
  "status": "CARRIED",
  "carrier_id": "175f47f4-f7de-4785-b45c-9a2d2289a8ea"
}
```

`carrier_id` does not reveal an owner.
