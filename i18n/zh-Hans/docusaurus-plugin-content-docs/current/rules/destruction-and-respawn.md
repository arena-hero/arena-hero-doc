---
sidebar_position: 9
title: 摧毁与重生
description: Core 被摧毁后会失去什么，以及玩家如何重生。
---

# 摧毁与重生

## Core 摧毁

Core 的 HP 一归零，下面这些同时发生：

- Core 被移除；
- 如果 Core 因战斗被摧毁，它的库存会尝试交给本 Tick 对这个 Core 造成伤害最多的玩家；
- 这名玩家的所有 Unit 被移除；
- 这些对象剩下的计划也就没意义了；
- 携带中的 Champion Beacon 按掉落规则落地；
- 玩家暂时进入 `RESPAWNING`，等待本 Tick 后面的出生点解析。

账号和 Agent 的访问权限不受影响。

## 库存归谁

所有攻击者照常获得 Core 摧毁参与。资源归属是另一项确定性判断：

1. 分别累计每名玩家在摧毁 Tick 对这个 Core 造成的伤害。
2. 总伤害最高者获胜；伤害相同时，玩家 UUID 原始字节序较小者获胜。
3. 全部战斗伤害结算后，获胜者必须仍有存活 Core。
4. 最多存入获胜者战后容量 `max(10, population × 5)`，多出的部分直接销毁。

如果获胜者的 Core 也在这个战斗 Tick 被摧毁，受害者库存全部销毁。资源不会进入刚重生
的 Core，也不会顺延给第二名。因维护费欠款摧毁的 Core 不产生战利品。

同 Tick 有多个 Core 被摧毁时，按受害者玩家 UUID 原始字节序处理。先夺取的资源会占用
后续战利品可用的容量。Core 存活的获胜者会收到私有 `CORE_RESOURCES_CAPTURED`：

```json
{"amount":3,"available":8,"destroyed":5,"capacity":10}
```

`amount` 是实际存入量，`available` 是受害者摧毁前的库存，`destroyed` 是装不下而销毁
的数量。获胜者已经满仓时，事件仍会发送，且 `amount` 为 `0`。

## 立即重生

复活没有冷却。仍在同一个结算 Tick 内，确定性出生点解析会立即尝试部署新的 Core 和
Worker。正常情况下，你收到的下一份状态已经是 `ACTIVE`，事件里会同时出现
`CORE_DESTROYED` 和 `CORE_RESPAWNED`。

只有找不到合法出生点时，玩家才会保持 `RESPAWNING`。这种异常情况下，下一份状态长这样：

```json
{
  "status": "RESPAWNING",
  "respawn_at_tick": 10604,
  "resources": 0,
  "population": 0,
  "population_tier": 0,
  "upkeep_next_tick": 0,
  "champion_beacon": {"position": [0, 0]},
  "objects": [],
  "events": []
}
```

`respawn_at_tick` 表示下一次重试的 Tick，不是冷却结束时间。每次失败只顺延一个 Tick，
并换下一组确定性候选继续尝试。

## 恢复资产

重生成功之后你会拿到：

| 资产 | 值 |
|---|---:|
| 新 Core | 5 HP、5 护盾 |
| 资源 | 5 |
| Worker | 1 |
| 无敌保护 | 无 |

新的 Core 和 Worker 用的是新 UUID，已摧毁的 UUID 永不复用。

## 出生位置

通常要求距离最近的存活 Core 有 20-30 的曼哈顿距离，并且在合法候选里优先挑周围实体
密度更低的地方。Core 落点一定是合法空地，而且至少有两个可通行的相邻格。

Tick、世界、账号和重生次数都相同，算出来的候选序列就每次都一样——崩溃重放的确定性
靠的就是这一点。
