---
sidebar_position: 1
title: Use the Skill
description: Let Codex create a tactic script or play Arena Hero directly.
---

# Arena Hero Agent Skill

The [`$arena-hero` skill](https://github.com/arena-hero/arena-hero-skill)
teaches Codex how to read the current rules, build a Python tactic, connect to
the game, and help you watch it play.

## Install

Clone the skill into your Codex skills directory:

```bash
git clone https://github.com/arena-hero/arena-hero-skill.git \
  ~/.codex/skills/arena-hero
```

Start a new Codex session, then ask:

```text
Use $arena-hero to create a balanced tactic for Arena Hero.
```

## Complete rules are included

The Skill ships with the
[complete Arena Hero v0.12 gameplay contract](https://github.com/arena-hero/arena-hero-skill/blob/main/references/game-rules.md).
It covers the world, Tick order, vision, economy, every Unit, movement,
stacking, Unit self-destruction, the Champion Beacon, combat, respawning, and
command priority.

Codex reads this local reference before writing a tactic or entering direct
play, so it does not need the documentation site to reconstruct the rules. When
online, it also checks the official contract version and stops if the bundled
rules need to be updated.

## Choose a mode

The skill offers two modes.

### Tactic script

Choose this for continuous play. Codex:

1. reads the current [game rules](../rules/world-and-ticks.md);
2. creates a minimal Python tactic using the
   [official SDK](../sdk/quickstart.md);
3. tests its decisions without a live credential;
4. runs it from an interactive terminal when you are ready.

The SDK is installed from PyPI:

```bash
python -m pip install arena-hero
```

### Direct play

Choose this when you want Codex to inspect each live Turn and submit the plan
itself during the current agent session.

:::warning Direct play is best effort

Every Tick has only a 15-second command window. The window opens before your
state is published, and Codex still needs time to read the state, reason, call
tools, and submit the plan. Direct play cannot guarantee that it will respond in
time and may miss consecutive Ticks.

Use a tactic script when the Agent needs to run continuously.

:::

Direct play ends when the agent session ends. It is not a background service or
an always-on bot.

## API key

The Skill can read the key from `ARENA_HERO_API_KEY`, `.env`, or a repository
file. It uses an existing key without asking you to enter it again and does not
print the key in chat or logs.

## Watch the Agent

After the connection succeeds:

1. sign in to [Arena Hero](https://app.arenahero.io/arena) with the account that
   owns the API key;
2. leave the game page open;
3. watch the current Agent plan appear in the command panel.

You can still issue Manual actions from the page. A Manual action overrides the
Agent action for the same Unit or Core in that Tick.

## What the skill will not guess

The Skill reads its complete bundled rules before writing rule-dependent logic.
It will not invent costs, ranges, caps, population formulas, event names, or
stacking behavior. If the live contract is newer than the bundled v0.12 rules, it
stops instead of making assumptions.

For the underlying connection and recovery behavior, read
[Reliable command loop](../agent/command-loop.md).
