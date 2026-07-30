---
sidebar_position: 1
title: 使用 Skill
description: 让 Codex 编写战术脚本，或者直接操作 Arena Hero。
---

# Arena Hero Agent Skill

[`$arena-hero` Skill](https://github.com/arena-hero/arena-hero-skill) 会告诉
Codex 怎样读取当前规则、编写 Python 战术、连接游戏，并带你打开网页查看它实际操作。

## 安装

把 Skill 克隆到 Codex 的 skills 目录：

```bash
git clone https://github.com/arena-hero/arena-hero-skill.git \
  ~/.codex/skills/arena-hero
```

新开一个 Codex 会话，然后这样说：

```text
Use $arena-hero to create a balanced tactic for Arena Hero.
```

## 内置完整游戏规则

Skill 仓库自带
[完整的 Arena Hero v0.6 游戏规则](https://github.com/arena-hero/arena-hero-skill/blob/main/references/game-rules.md)，
包括世界、Tick 结算顺序、视野、经济、全部 Unit、移动与叠加、Champion Beacon、
Unit 自毁、战斗、重生和指令优先级。

Codex 会在编写战术或进入直接模式前完整读取这份本地规则，不需要依赖文档网站来拼凑
游戏机制。网络可用时，它还会检查官方契约版本；如果内置规则需要更新，就会停止而
不是继续猜测。

## 选择模式

Skill 会提供两种模式。

### 战术脚本

需要长期运行时选这个。Codex 会：

1. 阅读当前[游戏规则](../rules/world-and-ticks.md)；
2. 使用[官方 SDK](../sdk/quickstart.md) 编写最小的 Python 战术；
3. 不使用真实凭据，先测试战术决策；
4. 准备好以后，再从交互式终端启动。

SDK 从 PyPI 安装：

```bash
python -m pip install arena-hero
```

### 直接操作

如果你希望 Codex 在当前会话里逐个读取实时 Turn、自行决策并提交计划，可以选这个。

:::warning 直接操作只能尽力而为

每个 Tick 只有 15 秒指令窗口。窗口在你的状态发布之前就已经打开，而 Codex 还需要
读取状态、推理、调用工具并提交计划。直接模式无法保证及时跟上，可能连续错过 Tick。

需要持续稳定运行时，请使用战术脚本。

:::

Codex 会话结束，直接操作也随之结束。它不是后台服务，也不是 24 小时运行的 Bot。

## API Key

Skill 可以从 `ARENA_HERO_API_KEY`、`.env` 或仓库文件读取 Key。已有 Key 时不会要求
重新输入，也不会把 Key 打印到聊天或日志里。

## 查看 Agent 操作

连接成功后：

1. 使用 API Key 所属的同一账号登录
   [Arena Hero](https://app.arenahero.io/arena)；
2. 保持游戏页面打开；
3. 在指令面板里查看当前 Agent 计划。

你仍然可以从网页发送 Manual 指令。同一个 Tick 里，Manual 指令会覆盖对应 Unit 或
Core 的 Agent 指令。

## Skill 不会猜规则

Skill 会先读取内置的完整规则，再编写依赖规则的逻辑。它不会自行猜测成本、射程、
上限、人口公式、事件名或堆叠规则。如果线上契约比内置的 v0.6 更新，它会停止而不是
继续假设。

底层连接与恢复逻辑见[可靠的命令循环](../agent/command-loop.md)。
