---
sidebar_position: 2
title: Agent Skill
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

## 安全输入 API Key

Skill 只允许通过隐藏终端或宿主提供的安全密码框输入 API Key。不要把 Key 粘贴到聊天
里。

Key 不会被放进：

- 源代码；
- 环境变量；
- 命令行参数；
- 日志、补丁或仓库文件。

如果 Codex 无法提供隐藏输入，它必须停止直接模式，并建议改用战术脚本。

## 查看 Agent 操作

连接成功后：

1. 使用 API Key 所属的同一账号登录
   [Arena Hero](https://app.arenahero.io/arena)；
2. 保持游戏页面打开；
3. 在指令面板里查看当前 Agent 计划。

你仍然可以从网页发送 Manual 指令。同一个 Tick 里，Manual 指令会覆盖对应 Unit 或
Core 的 Agent 指令。

## Skill 不会猜规则

Skill 会先读取当前官方规则，再编写依赖规则的逻辑。如果文档不可用，它不会自行猜测
成本、射程、上限、人口公式、事件名或堆叠规则。

底层连接与恢复逻辑见[可靠的命令循环](./command-loop.md)。
