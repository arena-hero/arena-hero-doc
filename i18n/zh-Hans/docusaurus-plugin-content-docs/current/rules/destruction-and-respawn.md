---
sidebar_position: 9
title: 摧毁与重生
description: Core 被摧毁后会失去什么，以及玩家如何重生。
---

# 摧毁与重生

## Core 摧毁

Core 的 HP 一归零，下面这些同时发生：

- Core 被移除；
- 库存资源全部清零；
- 这名玩家的所有 Unit 被移除；
- 这些对象剩下的计划也就没意义了；
- 携带中的 Champion Beacon 按掉落规则落地；
- 玩家进入 `RESPAWNING`。

账号和 Agent 的访问权限不受影响。你的下一份状态长这样：

```json
{
  "status": "RESPAWNING",
  "respawn_at_tick": 10603,
  "resources": 0,
  "population": 0,
  "population_tier": 0,
  "upkeep_next_tick": 0,
  "champion_beacon": {"position": [0, 0]},
  "objects": [],
  "events": []
}
```

## 延迟

默认要等 20 个逻辑 Tick。停服不算在里面，因为世界时钟同样是停的。

到期的那个 Tick，确定性出生点解析会尝试把你放下去；要是找不到合法位置，就顺延一个
Tick，换下一组确定性候选再试。

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
