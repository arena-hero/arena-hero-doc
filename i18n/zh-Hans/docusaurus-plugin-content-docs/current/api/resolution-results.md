---
sidebar_position: 5
title: 结算结果
description: state 中嵌入的结算结果对象、常见结果类型、原因码、可见性与动态失败解释。
---

# 结算结果

动态动作结果嵌入下一份完整 `state`。本页描述的是游戏协议中的 `state.events` 字段。

## Schema

```ts
interface ResolutionEvent {
  event_id: string;
  tick: number;
  event_type: string;
  reason_code?: string;
  actor_id?: string;
  target_id?: string;
  position?: [number, number];
  values?: Record<string, unknown>;
}
```

不相关字段会被省略，`event_id` 是 UUID。玩家只能收到属于自己的结算结果。

## 常见成功结果

| 结果类型 | 含义 |
|---|---|
| `UNIT_MOVE_SUCCEEDED` | Unit 完成一格移动。 |
| `CORE_MOVE_STARTED` | 开始新的四 Tick 迁移。 |
| `CORE_MOVE_PROGRESS` | 已有迁移取得进度。 |
| `CORE_MOVE_SUCCEEDED` | 第四 Tick 的真实移动完成。 |
| `HARVEST_SUCCEEDED` | Worker 装载资源。 |
| `DEPOSIT_SUCCEEDED` | Worker 转移全部货物。 |
| `CORE_SPAWN_SUCCEEDED` | Core 生产一个 Unit。 |
| `CORE_REPAIR_SUCCEEDED` | Core 恢复一点护盾。 |
| `SWEEP_RESOLVED` | Vanguard 横扫完成结算。 |
| `SHOT_HIT` | Ranger 命中指定目标。 |
| `BEACON_PICKED_UP` | 对象成为 Beacon 携带者。 |
| `BEACON_DROPPED` | 携带者把 Beacon 放到地面。 |
| `CORE_RESPAWNED` | 玩家带新 Core 和 Worker 重新进入世界。 |

## 常见失败原因

| 场景 | 原因示例 |
|---|---|
| 移动 | `MOVE_BLOCKED_TERRAIN`、`MOVE_CONTESTED`、`MOVE_SWAP_BLOCKED`、`MOVE_DESTINATION_OCCUPIED`、`MOVE_DEPENDENCY_FAILED`、`CELL_UNIT_LIMIT` |
| Core 迁移 | `CORE_ALREADY_MOVING`、`CORE_NOT_MOVING`、`CORE_DESTINATION_TERRAIN_BLOCKED`、`CORE_DESTINATION_OCCUPIED` |
| Worker | `NOT_RESOURCE_CELL`、`CARGO_FULL`、`WORKER_EMPTY`、`CORE_MOVING`、`CORE_NOT_PRESENT` |
| Core 经济 | `INSUFFICIENT_RESOURCES`、`SHIELD_FULL`、`CELL_UNIT_LIMIT` |
| Beacon | `BEACON_NOT_PRESENT`、`ALREADY_CARRIED`、`NOT_BEACON_CARRIER`、`CORE_MOVING` |
| Ranger | 所有动态失败统一报告为 `SHOT_MISSED`。 |

原因码只描述玩家自己动作的结果，不能据此推断协议刻意隐藏的敌方状态。

## 示例

```json
{
  "event_id": "42b2cc96-2a75-41a6-bb35-405d57239d54",
  "tick": 10583,
  "event_type": "UNIT_MOVE_FAILED",
  "reason_code": "MOVE_CONTESTED",
  "actor_id": "9d3e4941-2816-4a39-a220-df8cd95e877d",
  "position": [120, 85]
}
```

HTTP `202` 与随后出现的动态失败并不矛盾：前者确认计划被接受，后者说明所有玩家计划
一起结算时真实发生了什么。
