---
sidebar_position: 7
title: Champion Beacon
description: How the Champion Beacon is seen, carried, dropped, and used for bonuses.
---

# Champion Beacon

There is exactly one indestructible Champion Beacon. It begins at `[0, 0]` and
persists across restarts.

## Visibility

The Beacon coordinate is globally public in every `state`. Its `GROUND` or
`CARRIED` status and ownerless `carrier_id` are disclosed only when its cell is
currently visible.

The Beacon:

- occupies no cell-capacity slot;
- blocks neither movement, vision, nor Ranger fire;
- can share a cell with occupying entities;
- does not move merely because a browser route crosses it.

## Pickup and drop

Any Unit or a normal, non-moving Core may spend its full action on
`PICKUP_BEACON` when colocated with the ground Beacon. Only the current carrier
may use `DROP_BEACON`.

Several simultaneous pickups are ordered by carrier UUID raw bytes; the lowest
UUID wins. A living carrier cannot be robbed directly.

Beacon actions resolve before Worker harvesting, so:

- a successful pickup grants the harvest bonus immediately in that Tick;
- a successful drop removes the bonus immediately in that Tick.

## Shield bonus

While a player holds the Beacon, that player's Core shield cap increases from 5
to 10.

- Pickup grants no shield and performs no repair.
- `REPAIR_SHIELD` is still required, 1 resource for 1 shield.
- Losing the Beacon immediately clamps shield above 5 down to 5.

## Worker bonus

An eligible empty Worker normally collects 1 resource. While its owner holds the
Beacon, it collects and carries 2.

Already-carried bonus cargo remains 2 after the Beacon is lost and can be
deposited together. Infinite resource points allow every eligible colocated
Worker to collect its full amount.

## Movement and drop-on-death

The Beacon follows its carrier's successful movement. A migrating Core carries
it at the Core's current logical position until the fourth-Tick real move
succeeds.

If the Beacon was carried at the start of a Tick and is then dropped, the
carrier dies, or the owner's Core is destroyed, the Beacon lands at the
carrier's final actual position. It cannot be picked up again in the same Tick;
the earliest new pickup is the next Tick.

This rule prevents a single Tick from chaining ownership through multiple
carriers.
