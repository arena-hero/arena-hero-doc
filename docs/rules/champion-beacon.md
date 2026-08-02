---
sidebar_position: 7
title: Champion Beacon
description: How the Champion Beacon is seen, carried, dropped, and used for bonuses.
---

# Champion Beacon

There is exactly one Champion Beacon in the world, it cannot be destroyed, and it
starts at `[0, 0]`. Restarts do not move it or reset it.

## Visibility

Every `state` includes the Beacon's coordinate, for everybody, always. What you
only learn when its cell happens to be visible is whether it is `GROUND` or
`CARRIED`, plus an ownerless `carrier_id`.

The Beacon itself is unobtrusive:

- it takes up no cell-capacity slot;
- it blocks nothing — not movement, not vision, not Ranger fire;
- it can sit in a cell alongside occupying entities;
- it does not get picked up just because a browser route happens to cross it.

## Pickup and drop

Any Unit, or a normal Core that is not migrating, can spend its whole action on
`PICKUP_BEACON` while sharing a cell with the Beacon on the ground. Only whoever
is carrying it can `DROP_BEACON`.

If several objects reach for it in the same Tick, the raw bytes of their carrier
UUIDs decide, and the lowest wins. You cannot take it straight from a carrier
that is still alive.

Beacon actions resolve before Worker harvesting, which has a convenient
consequence:

- pick it up successfully and you get the harvest bonus in that same Tick;
- drop it successfully and you lose the bonus in that same Tick.

## Shield bonus

Holding the Beacon raises that player's Core shield cap from 5 to 10.

- Picking it up grants no shield and repairs nothing.
- You still have to spend `REPAIR_SHIELD`, 1 resource per 1 shield.
- The moment you lose the Beacon, any shield above 5 is clamped back down to 5.

## Worker bonus

An eligible empty Worker normally brings back 1 resource. While its owner holds
the Beacon, it collects and carries 2. Either result consumes exactly one
resource point.

Bonus cargo already on board stays at 2 even after the Beacon is gone, and can be
deposited in one go. When several eligible Workers harvest the same point, the
lowest UUID wins the point; the Beacon doubles only the winner's cargo and does
not grant an extra success or consume a second point.

## Movement and drop-on-death

The Beacon travels with its carrier whenever the carrier moves successfully. A
migrating Core keeps it at the Core's current logical position until the
fourth-Tick real move goes through.

Suppose the Beacon was being carried at the start of a Tick, and then it is
dropped, or the carrier dies, or the owner's Core is destroyed. In all three cases
the Beacon lands at the carrier's final actual position, and nobody can pick it up
again until the next Tick.

That cooldown is the point: it stops a single Tick from passing the Beacon down a
chain of carriers.

## Lifetime ranking

The public Beacon ranking adds one held Tick only if the player still owns the
carrier at the end of resolution. A voluntary drop or death drop before the end
of the Tick does not count. See the [Leaderboard API](../api/leaderboard.md).
