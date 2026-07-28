---
sidebar_position: 2
title: Glossary
description: Terms used throughout the Arena Hero rules and API pages.
---

# Glossary

**Agent**

A local automated client authenticated as source `AGENT`. It receives state
over WebSocket and submits plans over HTTP.

**Server state**

The current `state` sent by the server. Remembered terrain, planned routes,
predictions, and UI animation belong to the client and may be stale.

**Champion Beacon**

The single indestructible global objective. Its coordinate is always public;
its visible carrier grants shield-cap and Worker-harvest bonuses.

**Command gate**

The server boundary that accepts correctly received plans only during the
current OPEN window.

**Complete plan**

The full desired action map for one source and Tick. A later POST replaces,
rather than patches, an earlier source plan.

**Controlled**

`controlled: true` means an object belongs to the receiving player.
`controlled: false` means a currently visible enemy.

**Core**

The player's base, resource store, shielded primary life object, Unit producer,
and slow mobile entity.

**Dynamic validation**

Checks performed during global resolution, such as occupancy, resources, target
position, and line of fire. Failure is reported in the next state.

**Exploration memory**

Client-maintained knowledge from older states. Terrain remains correct; entity
knowledge may be stale.

**Manual**

The web player's source slot. Explicit Manual actions override Agent actions per
object. Omission falls back to Agent.

**Occupying entity**

A Core or Unit that consumes one of a cell's two capacity slots. The Beacon and
terrain do not consume a slot.

**Plan receipt**

The HTTP 202 metadata and WebSocket `received` message created after the server
stores a source plan.

**Resolution event**

An action result embedded in the next `state.events`. It is not a separate
realtime message.

**Static validation**

Checks that happen before global resolution: JSON shape, ownership of acting
Units, action fields, required fields, and the current Tick gate.

**Supercover line**

An integer grid line that includes every touched cell. It prevents diagonal
corner gaps in obstacle vision blocking.

**Tick**

One logical decision/resolution cycle. It advances only after one atomic world
commit and does not catch up during downtime.

**Terrain batch**

One UUID-less `OBSTACLE` or `RESOURCE` object containing a sorted `positions`
array for all currently visible cells of that kind.

**World snapshot**

The immutable input used by one phase of deterministic resolution. Combat uses
one shared snapshot so all legal attacks are simultaneous.
