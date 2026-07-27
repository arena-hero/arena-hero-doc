---
sidebar_position: 3
title: Source and version policy
description: Documentation authority, reviewed implementation commit, compatibility boundary, and update policy.
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

## Authority

This repository is the official reader-facing rule and game API specification.
The server code, database constraints, and automated tests enforce the actual
runtime contract.

If published prose and released implementation differ:

1. do not exploit the discrepancy as an implied rule;
2. capture the exact server version and observed behavior;
3. open an issue in the documentation or server repository;
4. update both repositories when the intended behavior is decided.

## Compatibility boundary

These are protocol-level behaviors and require an explicit contract-version
decision to change:

- 15-second global command window and `state` as action trigger;
- deterministic resolution phases and atomic commit;
- complete source-plan replacement and Manual precedence;
- strict action unions and idempotency;
- WebSocket message types and reconnect snapshot;
- fog-of-war privacy boundary;
- map generator contract;
- core balance rules that determine replayed outcomes.

Copy, layout, diagrams, examples, and explanatory ordering may improve without
changing the game contract.

## Versioning policy

Docusaurus multi-version snapshots are intentionally disabled while the public
API is v0.1. The site publishes one `Current` contract in two mirrored
languages. When the first stable compatibility release is declared, the
previous contract can be frozen as a Docusaurus version.

## Updating the contract

A gameplay or game API change is complete only when it includes:

- implementation and tests in the server repository;
- updated English and Simplified Chinese pages here;
- updated OpenAPI or AsyncAPI schema where applicable;
- verified bilingual production builds;
- a clear compatibility note when existing clients may break.
