---
sidebar_position: 8
title: 摧毁与重生
description: Core 摧毁后果、重生延迟、确定性出生点与恢复资产。
---

# 摧毁与重生

## Core 摧毁

Core HP 归零时：

- Core 被移除；
- 库存资源清零；
- 玩家所有 Unit 被移除；
- 这些对象剩余计划失效；
- 携带的 Champion Beacon 按掉落规则落地；
- 玩家进入 `RESPAWNING`。

下一状态示例：

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

默认等待 20 个逻辑 Tick。停服期间世界时钟暂停，因此不会消耗重生时间。

到期 Tick 会确定性寻找出生点；若没有合法位置，顺延一个 Tick，并使用下一组确定性候选。

## 恢复资产

| 资产 | 值 |
|---|---:|
| 新 Core | 5 HP、5 护盾 |
| 资源 | 20 |
| Worker | 1 |
| 无敌保护 | 无 |

新 Core 和 Worker 使用新 UUID，已摧毁 UUID 永不复用。

## 出生位置

通常要求距最近存活 Core 的曼哈顿距离为 20–30，并优先选择局部实体密度低的合法空地。Core 出生格至少有两个可通行相邻格。

相同 Tick、世界、账号与重生次数产生相同候选序列，以保证崩溃重放确定性。
