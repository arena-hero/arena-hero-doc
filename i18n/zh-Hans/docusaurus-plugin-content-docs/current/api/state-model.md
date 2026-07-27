---
sidebar_position: 4
title: 状态模型
description: 完整 PlayerState、Champion Beacon、地形、Core、Unit、可见性、排序与隐私 Schema。
---

# 状态模型

`state.data` 是一份完整的 `PlayerState`：

```ts
interface PlayerState {
  status: 'ACTIVE' | 'RESPAWNING';
  respawn_at_tick?: number;
  resources: number;
  population: number;
  population_tier: number;
  upkeep_next_tick: number;
  champion_beacon: ChampionBeacon;
  objects: WorldObject[];
  events: ResolutionEvent[];
}
```

## 顶层字段

| 字段 | 含义 |
|---|---|
| `status` | `ACTIVE` 或等待重生。 |
| `respawn_at_tick` | 仅在 `RESPAWNING` 时出现。 |
| `resources` | 当前 Core 库存资源。 |
| `population` | 当前存活的己方 Unit 数量，不包含 Core。 |
| `population_tier` | `floor(population / 20)`。 |
| `upkeep_next_tick` | 下一次自动维护费的预计值。 |
| `champion_beacon` | 全局公开坐标，以及受视野限制的状态。 |
| `objects` | 所有己方实体，加上当前可见的地形和敌方实体。 |
| `events` | 上一 Tick 的即时结算结果。 |

## Champion Beacon

```ts
interface ChampionBeacon {
  position: [number, number];
  status?: 'GROUND' | 'CARRIED';
  carrier_id?: string;
}
```

`position` 始终存在。只有 Beacon 所在格当前可见时才出现 `status` 和 `carrier_id`；
`carrier_id` 仅在 `CARRIED` 时出现。

## 地形批次

同一种可见地形会被合并：

```json
{
  "kind": "OBSTACLE",
  "positions": [[4, 7], [4, 8], [5, 8]]
}
```

```json
{
  "kind": "RESOURCE",
  "positions": [[2, 1], [9, -3]]
}
```

地形批次没有 UUID、所有权、HP 或资源余量。当前看不到某类地形时，对应批次可以不存在。

## Core 对象

```json
{
  "kind": "CORE",
  "id": "2ea3c3dc-42b0-4b92-9754-7558bd4ff834",
  "controlled": true,
  "position": [12, 8],
  "hp": 5,
  "shield": 4,
  "state": "NORMAL"
}
```

正在迁移的 Core 还会公开：

```json
{
  "state": "MOVING",
  "move_direction": "RIGHT",
  "move_progress": 2,
  "move_required_ticks": 4,
  "destination": [13, 8]
}
```

当前能够看见该 Core 的敌方也能看到这些迁移字段。

## Unit 对象

```json
{
  "kind": "UNIT",
  "id": "9d3e4941-2816-4a39-a220-df8cd95e877d",
  "controlled": true,
  "position": [11, 8],
  "hp": 2,
  "unit_type": "WORKER",
  "cargo": 1
}
```

`unit_type` 为 `WORKER`、`VANGUARD` 或 `RANGER`。`cargo` 只对己方 Worker
发送。协议不会发送敌方所有者身份。

## 所有权与可见性

- `controlled: true`：对象属于接收状态的玩家。
- `controlled: false`：当前可见的敌方对象。
- 所有己方实体始终出现，不受当前视野限制。
- 敌方实体仅在当前可见时出现。
- 没有“最后发现时间”；如有需要，客户端应在权威状态之外保存探索记忆。

## 确定性排序

地形坐标和实体对象都会按确定性顺序排列。客户端不应把对象数组下标当作身份；
Core 和 Unit 使用 `id`，地形批次使用 `kind`。
