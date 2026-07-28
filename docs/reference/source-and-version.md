---
sidebar_position: 3
title: Source and version policy
description: The server version covered by these docs and which changes affect compatibility.
---

# Source and version policy

## Current release

| Item | Value |
|---|---|
| Public contract | v0.1 |
| Server repository | [`arena-hero/arena-hero`](https://github.com/arena-hero/arena-hero) |
| Reviewed server commit | `d66476a26f4713c5fe91cd40ae8a21098a576638` |
| Review date | 27 July 2026 |
| Documentation repository | [`arena-hero/arena-hero-doc`](https://github.com/arena-hero/arena-hero-doc) |
| Languages | English, Simplified Chinese |

## If the docs and server disagree

These pages describe the public rules and game API. The server code, database
constraints, and tests decide what actually happens at runtime.

If published prose and released implementation differ:

1. do not exploit the discrepancy as an implied rule;
2. capture the exact server version and observed behavior;
3. open an issue in the documentation or server repository;
4. update both repositories when the intended behavior is decided.

## Changes that affect compatibility

Changing any of these may break an existing client and needs an explicit
contract-version decision:

- 15-second global command window and `state` as action trigger;
- deterministic resolution phases and atomic commit;
- complete source-plan replacement and Manual precedence;
- action field rules and idempotency;
- WebSocket message types and reconnect snapshot;
- fog-of-war privacy boundary;
- map generator contract;
- core balance rules that determine replayed outcomes.

Copy, layout, diagrams, examples, and explanatory ordering may improve without
changing the game contract.

## Why there is no version picker yet

The public API is still v0.1, so this site publishes one current version in
English and Simplified Chinese. After the first stable compatibility release,
older contracts can be kept as Docusaurus versions.

## What a protocol change must update

A gameplay or game API change must include:

- implementation and tests in the server repository;
- updated English and Simplified Chinese pages here;
- updated OpenAPI or AsyncAPI schema where applicable;
- verified bilingual production builds;
- a clear compatibility note when existing clients may break.
