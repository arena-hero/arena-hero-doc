---
sidebar_position: 2
title: Map and vision
description: How terrain, visibility, resources, and fog of war work.
---

# Map and vision

## Terrain and resource points

Every cell has permanent base terrain, and a passable cell may additionally hold
one currently available resource point:

| Visible `kind` | Passable by Units | Passable by a moving Core | Blocks vision | Blocks Ranger fire |
|---|---:|---:|---:|---:|
| `EMPTY` | Yes | Yes | No | No |
| `RESOURCE` | Yes | No | No | No |
| `OBSTACLE` | No | No | Yes | Yes |

Cores and Units occupy cells but are not terrain. Obstacles and chunk backbone
passages are permanent. A `RESOURCE` position is different: one successful
`HARVEST` consumes that point and exposes the passable ground underneath.

## Resource quotas

Chunks are 32×32 cells. For a cell `[x, y]`, its chunk coordinate uses floor
division:

```text
cx = floor(x / 32)
cy = floor(y / 32)
```

The four chunks surrounding the origin form ring 0. Define:

```text
axis(c) = c       if c >= 0
          -c - 1  if c < 0

ring = axis(cx) + axis(cy)
x = max(2, floor(16 * 8 / (8 + ring)))
```

`x` is the chunk's fixed number of available resource points immediately after a
replenishment. Ring 0 therefore has 16 points per chunk; the quota falls with
distance and never goes below 2.

## Consumption and replenishment

A successful harvest consumes exactly one point. A normal Worker receives
1 resource from it; a Worker whose player holds the Champion Beacon receives
2 from that same one point.

After every fourth resolved Tick—roughly once per minute—the server counts each
chunk's still-available points and creates only enough replacements to restore
its quota `x`.

- Unharvested points do not move.
- Missing slots do not accumulate, and a chunk never replenishes above `x`.
- Replacement positions are selected with deterministic randomness.
- A replacement must be on passable, non-obstacle ground, outside the chunk's
  backbone passages, and not occupied by a Core after resolution.
- A replacement may appear under a Unit or under the ground Champion Beacon.

The versioned world contract makes the selection replayable: the same world,
resolved Tick, chunk state, and missing slots produce the same replacement
positions.

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

Units, Cores, and resource points do not block **vision** at all. Units and Cores do
block a Ranger's **shot** — that is a separate rule, and it is easy to conflate the
two.

## What the server sends

Each `state` carries:

- all of your own Cores and Units, even ones nothing of yours can currently see;
- enemy Cores and Units, but only while they are visible;
- visible obstacles and currently available resource points, grouped into one
  `OBSTACLE` object and one `RESOURCE` object;
- the Champion Beacon coordinate, which is public to everyone;
- Beacon status and carrier ID, but only while the Beacon's cell is visible.

Enemy objects come with `controlled: false` and no owner information. Worker cargo
is private, so it appears only on your own Workers.

## Exploration memory

The server sends you the current view and nothing else—it does not replay where
you have been. The web client caches observations locally. An Agent that wants a
map has to save what it has seen itself, which is why a fresh device starts out
with only the current view.

:::warning Stale knowledge

Remembered obstacles remain correct because base terrain is permanent. Remembered
resource points are only last-seen observations: a point can be consumed while
fogged, and a replenished point is not revealed until its cell becomes visible.
A remembered Unit, Core, or Beacon carrier may also have moved.

:::

When a visible point is consumed, it is removed from the authoritative resource
layer immediately and the next complete `state` omits it unless replenishment
placed a point there again. There is no hidden resource quantity: a position is
either currently available and included, or unavailable and absent.

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
