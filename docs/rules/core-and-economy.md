---
sidebar_position: 3
title: Core and economy
description: How the Core stores resources, creates Units, repairs, and moves.
---

# Core and economy

## Core attributes

| Attribute | Default |
|---|---:|
| Maximum HP | 5 |
| Maximum shield | 5 |
| Maximum shield while the owner holds the Beacon | 10 |
| Vision | 5 |
| Starting resources after respawn | 5 |

Combat damage eats shield before it touches HP. The Core is where your resources
live. It receives deposits, builds Units, restores HP and shield, and — slowly —
migrates.

## Resource storage

Population counts living Units, not the Core. Core storage has a minimum
capacity of 10; above two Units, it grows by five per Unit:

```text
resource_capacity = max(10, population × 5)
```

A new or respawned player starts with one Worker and 5 resources. If population
falls and the current inventory is now above capacity, those existing resources
above the new capacity are destroyed immediately. The private
`CORE_RESOURCE_OVERFLOW_DESTROYED` event reports the amount lost and the new
capacity.

A Worker deposits only what fits. Any remainder stays on the Worker. A completely
full Core returns `DEPOSIT_FAILED` with
`CORE_RESOURCE_FULL`, without changing its inventory or the Worker's cargo.

Destroying an enemy Core in combat can add its inventory to your Core. The
highest-damage player receives only what fits this same capacity; overflow is
destroyed. If that player's Core also dies in the Tick, all of the victim's
inventory is destroyed instead. See
[Destruction and respawn](./destruction-and-respawn.md#who-receives-the-inventory).

## Core actions

A source plan may name at most one Core action:

| Action | Parameters | Purpose |
|---|---|---|
| `SPAWN` | `unit_type` | Create one Unit on the Core cell. |
| `HEAL` | none | After combat, spend 1 resource per missing Core HP, up to full HP. |
| `REPAIR_SHIELD` | none | Spend 1 resource to restore 1 shield. |
| `START_MOVE` | `direction` | Begin a four-Tick migration. |
| `CANCEL_MOVE` | none | Cancel migration and clear progress. |
| `PICKUP_BEACON` | none | Pick up a ground Beacon on the same cell. |
| `DROP_BEACON` | none | Drop the Beacon carried by this Core. |
| `SELF_DESTRUCT` | none | After combat, destroy this Core, its inventory, and all owned Units. |
| `WAIT` | none | Explicitly take no action. |

## Core self-destruction

Any living Core may submit `{"type":"SELF_DESTRUCT"}` with no other fields.
It has no resource, Unit, movement-state, or cooldown restriction. A migrating
Core advances or completes its movement first and can still be attacked during
that Tick.

Combat has priority. If an enemy attack destroys the Core, normal destruction
participation and resource capture apply and the self-destruct does not run. If
the Core survives combat, it self-destructs before Unit healing, Core healing,
shield repair, or spawning:

- the Core inventory is destroyed, with no refund or transfer;
- every owned Unit is removed and counts toward `units_lost`;
- Worker cargo and a carried Champion Beacon drop at each carrier's actual
  post-movement position;
- no damage, destruction participation, or loot is awarded;
- the normal same-Tick respawn attempt runs, and `respawn_count` increases.

The private `CORE_DESTROYED` event uses `reason_code: SELF_DESTRUCT`, omits
`destroyed_by`, and is followed by `CORE_RESPAWNED` when placement succeeds.
The replacement Core may self-destruct again on the next Tick.

## Production and dynamic prices

The first 20 living Units use the base prices. After that, all three prices rise
by 30% for each complete five-Unit band:

```text
N = living Units when Core actions resolve
k = max(0, floor((N - 20) / 5) + 1)
price = round_half_up(base_price × (13 / 10)^k)
```

The server computes the fraction exactly and rounds only once at the end. A
half-unit rounds upward. `N` includes Workers, Vanguards, and Rangers, but never
the Core.

| Unit | Base price | N = 0-19 | N = 20-24 | N = 25-29 | N = 30-34 |
|---|---:|---:|---:|---:|---:|
| Worker | 5 | 5 | 7 | 8 | 11 |
| Vanguard | 10 | 10 | 13 | 17 | 22 |
| Ranger | 12 | 12 | 16 | 20 | 26 |

The 20th Unit is still sold at its base price; the 21st is the first inflated
purchase. The initial Worker and every respawn Worker are free.

One Unit per Tick, maximum. Since a cell holds two occupying entities and the Core
already takes one of those slots, only one Unit can stand with the Core at a time
— try to spawn into a full cell and you get `CELL_UNIT_LIMIT`, with no resources
spent.

A Unit that has just been spawned:

- cannot act during the Tick it was created;
- is created after combat, so it cannot be attacked during its birth Tick;
- immediately increases population and therefore the price of a later spawn.

Worker deposits resolve before the Core action, so resources actually accepted
this Tick can pay for that action when it is otherwise legal. Resources captured
from an enemy Core during combat can fund same-Tick Unit healing and then the
Core action.

Pricing uses the live population at the start of the Core-action phase. Unit
self-destruction and combat deaths have already happened, so they can lower the
price in the same Tick. The public state and official frontend show the price
implied by the latest complete snapshot; if same-Tick deaths lower it, the
server may charge less. `CORE_SPAWN_SUCCEEDED.values.cost` and
`CORE_SPAWN_FAILED.values.required` are authoritative for the settled price.

## HP recovery

`HEAL` is a complete action for either one Unit or the Core. Healing happens
after simultaneous combat damage. It spends 1 Core resource for each HP actually
restored and automatically continues until the object reaches its HP maximum or
the Core runs out of resources.

A Unit must still be alive on the same cell as its own stationary Core. Unit
heals resolve in raw Unit UUID order, before the Core action. Fatal damage cannot
be healed. It is valid to queue `HEAL` while HP is full or resources are
currently empty: the object may take nonfatal combat damage, or the Core may
capture resources, before healing resolves. If the condition is still unmet,
the action fails privately and spends nothing.

## Shield repair

`REPAIR_SHIELD` spends exactly 1 resource for exactly 1 shield, and it will not
push you past the current cap. When it fails you get a private
`CORE_REPAIR_FAILED` carrying either `SHIELD_FULL` or `INSUFFICIENT_RESOURCES`.

Holding the Champion Beacon lifts the cap to 10, but it gives you no free shield
to go with it. Lose the Beacon and anything above 5 is clamped straight back down
to 5.

## Four-Tick migration

Moving a Core one cardinal cell takes four logical Ticks.

```text
START_MOVE resolves  -> progress 1/4
next Tick            -> progress 2/4
next Tick            -> progress 3/4
next Tick            -> real movement attempt
```

You do not need to resend anything to keep it going, and `WAIT` will not pause it.
Changing direction means `CANCEL_MOVE` first, which resets progress to zero.

While it is migrating, a Core:

- cannot spawn, heal, repair, or pick up and drop the Beacon, but may
  `SELF_DESTRUCT`;
- cannot accept Worker deposits;
- still takes damage;
- keeps its inventory;
- leaves any colocated Units behind.

A carried Beacon only follows the Core once the real move succeeds. And starting a
migration reserves nothing: other players are free to pass through the destination
or settle in it before your fourth Tick comes around.

That fourth-Tick move joins the same global movement dependency graph as Unit
movement. If it fails, the Core stays put and its progress clears.

There is no per-Tick maintenance charge. Population affects Core storage and the
price of the next Unit, but it never automatically spends resources or damages
Units.
