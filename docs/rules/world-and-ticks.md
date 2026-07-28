---
sidebar_position: 1
title: World and Ticks
description: How the shared world advances from one Tick to the next and recovers after a crash.
---

# World and Ticks

## One persistent world

- Every player shares one permanent world on a two-dimensional square grid.
- There are no seasons, no match resets, and no NPCs, monsters, or
  server-controlled fleets.
- An account owns at most one living Core at a time.
- Units, and each generation of a Core, get non-enumerable UUIDs. An object keeps
  its ID for as long as it lives, and no ID is ever reused after death.
- Enemy state never carries account IDs, email addresses, or usernames.

An account that activates while the world is mid-resolution does not get spliced
into a half-built snapshot. Instead the server records a persistent
`activation_tick`, and the player enters through deterministic respawn processing
at that Tick like everyone else.

## Deterministic infinite generation

Terrain comes in 32×32 chunks, generated from a permanent secret world seed and a
versioned HMAC-SHA256 contract. Clients never see the seed.

That buys you a few guarantees worth relying on:

- The same world, generator version, balance, and coordinates always produce the
  same terrain.
- Neighboring chunks share deterministic boundary passages.
- Every passable pocket connects to the chunk backbone, though one-cell
  chokepoints are allowed and can matter strategically.
- `[0, 0]` and its route to the backbone are always `EMPTY`, so the Champion
  Beacon is never walled off.
- If the generator contract does not match, the service refuses to start.
  Changing generation semantics therefore means a new world database.

## Tick lifecycle

Every logical Tick has a fixed command phase followed by a resolution phase whose
length varies.

```mermaid
sequenceDiagram
  participant C as Client
  participant A as API
  participant G as Command gate
  participant E as Engine
  participant D as PostgreSQL

  A-->>C: tick N
  Note over A,G: Commands still closed
  A->>A: Build each player's state
  A->>G: Open global 15-second window
  A-->>C: state for Tick N
  C->>A: POST plan
  A->>D: Persist source plan
  A-->>C: HTTP 202
  A-->>C: received
  G->>G: Lock all plans
  E->>E: Resolve deterministically
  E->>D: Atomic world + events + journal commit
  A-->>C: tick N+1
```

The window opens first, and only then does the server publish states one player
at a time. What reaches you is therefore whatever is **left** of that global 15
seconds; receiving `state` does not start a private timer of your own. The
protocol deliberately withholds `opened_at` and `deadline_at`.

Keep the two messages straight: `tick` only announces that a logical Tick exists,
with commands still closed. `state` is the one and only signal to act.

## Resolution order

This order is part of the protocol, not an implementation detail:

1. Lock the final valid Agent and Manual plans.
2. Charge upkeep and apply unpaid upkeep damage.
3. Resolve Unit movement, and Core migrations that reach their fourth Tick.
4. Validate new Core `START_MOVE` actions.
5. Resolve Champion Beacon pickup and drop actions.
6. Resolve Worker harvest and deposit actions.
7. Resolve Core spawn and shield repair.
8. Freeze one immutable combat snapshot and accumulate every legal attack.
9. Apply damage simultaneously, remove destroyed objects, and resolve any respawns
   that are due.
10. Atomically commit the world, events, statistics, journal, and new clock.
11. Announce the next Tick and prepare fresh private states.

The server never skips a Tick to catch up with wall-clock time; downtime simply
pauses the world. And two Ticks never resolve at the same time.

## Atomicity and replay

One Tick's result commits in a single PostgreSQL transaction, so there is no
window in which a client can observe a half-resolved world. The engine is also
forbidden from letting map iteration order, wall-clock time, process randomness,
or unordered query results decide an outcome.

Given the same world state and the same locked plans, the rules produce the same
result byte for byte.

## Crash recovery

| Failure point | Recovery |
|---|---|
| State preparation fails | Do not open the command window. |
| State publication fails | Abort the gate; reannounce the same Tick and reopen a full 15-second window after recovery. |
| Server crashes while OPEN | Keep persisted plans; on restart send the same `tick`, full `state`, latest receipts, and reopen a full window. |
| Server crashes after lock | Do not reopen; replay the persisted locked plans deterministically. |
| Server is offline | The world and all logical timers pause. |
