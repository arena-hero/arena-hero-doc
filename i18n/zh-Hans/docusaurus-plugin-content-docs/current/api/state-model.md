---
sidebar_position: 3
title: 状态模型
description: PlayerState 字段、JSON 示例、世界对象、视野和状态更新规则。
toc_min_heading_level: 2
toc_max_heading_level: 3
---

# 状态模型

`state.data` 是这个玩家现在能看到的内容。每条新消息都会替换上一份状态。

<nav className="api-model-nav" aria-label="状态模型章节">
  <strong>快速跳转</strong>
  <a href="#playerstate">PlayerState</a>
  <a href="#champion-beacon">Champion Beacon</a>
  <a href="#world-objects">世界对象</a>
  <a href="#visibility">视野</a>
  <a href="#updating-state">更新状态</a>
</nav>

## 如何读取状态

| 规则 | 客户端行为 |
|---|---|
| 收到新消息 | 替换上一份 `PlayerState`，不要合并数组。 |
| 读取对象 | 先看 `kind`，再按该类型读取字段。 |
| 判断归属 | `controlled: true` 表示己方，`false` 表示当前可见的敌方。 |
| 某个字段缺失 | 它的值未知或不适用。服务端不会发送 `null`。 |

```json title="最小状态消息"
{
  "type": "state",
  "data": {
    "status": "ACTIVE",
    "resources": 20,
    "population": 1,
    "population_tier": 0,
    "upkeep_next_tick": 0,
    "champion_beacon": {"position": [0, 0]},
    "objects": [
      {
        "kind": "CORE",
        "id": "2ea3c3dc-42b0-4b92-9754-7558bd4ff834",
        "controlled": true,
        "position": [12, 8],
        "hp": 5,
        "shield": 5,
        "state": "NORMAL"
      },
      {
        "kind": "UNIT",
        "id": "9d3e4941-2816-4a39-a220-df8cd95e877d",
        "controlled": true,
        "position": [11, 8],
        "hp": 2,
        "unit_type": "WORKER",
        "cargo": 0
      }
    ],
    "events": []
  }
}
```

机器可读定义见 [AsyncAPI schema](/asyncapi.yaml)。

## PlayerState {#playerstate}

| 字段 | 格式 | 必需 | 含义 |
|---|---|---:|---|
| `status` | `"ACTIVE"` 或 `"RESPAWNING"` | 是 | 玩家拥有活动核心，或正在等待重生。 |
| `respawn_at_tick` | 正 int64 | 仅重生中 | 下一次尝试重生的 Tick。 |
| `resources` | 非负整数 | 是 | 核心储存的资源；工人货物单独计算。 |
| `population` | 非负整数 | 是 | 存活己方单位数，不计核心。 |
| `population_tier` | 非负整数 | 是 | `floor(population / 20)`。 |
| `upkeep_next_tick` | 非负整数 | 是 | 当前人口对应的 `tier × (tier + 1) / 2`。 |
| `champion_beacon` | object | 是 | 公开位置，以及可见时的携带状态。 |
| `objects` | array | 是 | 己方实体，以及当前可见地形和敌方实体。 |
| `events` | array | 是 | 当前玩家收到的结算结果。 |

没有内容时，`objects` 和 `events` 为 `[]`。`RESPAWNING` 期间资源和人口字段
仍然存在，但在 `CORE_RESPAWNED` 之前可以没有己方核心。

## Champion Beacon {#champion-beacon}

信标位置始终公开，其他字段取决于视野。

### 视野外

```json
{
  "position": [120, 85]
}
```

只知道位置。不能推断信标在地面还是被携带。

### 可见且在地面

```json
{
  "position": [120, 85],
  "status": "GROUND"
}
```

此时没有 `carrier_id`。

### 可见且被携带

```json
{
  "position": [120, 85],
  "status": "CARRIED",
  "carrier_id": "9d3e4941-2816-4a39-a220-df8cd95e877d"
}
```

`carrier_id` 指向携带信标的核心或单位。如果下一份状态省略 `status`
或 `carrier_id`，必须丢弃旧值。

## 世界对象 {#world-objects}

`objects` 中的每一项都以 `kind` 开头。

| `kind` | 表示 | 身份 |
|---|---|---|
| `"CORE"` | 一个核心 | `id` |
| `"UNIT"` | 一个 Worker、Vanguard 或 Ranger | `id` |
| `"OBSTACLE"` | 所有可见障碍格 | 单个坐标 |
| `"RESOURCE"` | 所有可见资源格 | 单个坐标 |

```js title="按 kind 分发"
for (const object of state.objects) {
  if (object.kind === 'CORE') handleCore(object);
  else if (object.kind === 'UNIT') handleUnit(object);
  else handleTerrain(object);
}
```

### 地形

```json
{
  "kind": "OBSTACLE",
  "positions": [[4, 7], [4, 8], [5, 8]]
}
```

| 字段 | 格式 | 含义 |
|---|---|---|
| `kind` | `"OBSTACLE"` 或 `"RESOURCE"` | 地形类型。 |
| `positions` | 非空 `[x, y]` 数组 | 可见格，先按 `x`、再按 `y` 排序。 |

同类可见地形格合并成一项。缺少某种 `kind` 表示当前没有该类可见格。
地形没有 `id`、`controlled`、生命值或资源数量。

### 核心

```json title="正常核心"
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

```json title="移动中的核心"
{
  "kind": "CORE",
  "id": "2ea3c3dc-42b0-4b92-9754-7558bd4ff834",
  "controlled": true,
  "position": [12, 8],
  "hp": 5,
  "shield": 4,
  "state": "MOVING",
  "move_direction": "RIGHT",
  "move_progress": 2,
  "move_required_ticks": 4,
  "destination": [13, 8]
}
```

| 字段 | 格式 | 必需 |
|---|---|---:|
| `kind` | `"CORE"` | 是 |
| `id` | UUID | 是 |
| `controlled` | boolean | 是 |
| `position` | `[x, y]` | 是；移动期间仍为起点 |
| `hp` | 非负整数 | 是 |
| `shield` | 非负整数 | 是 |
| `state` | `"NORMAL"` 或 `"MOVING"` | 是 |
| `move_direction` | 方向字符串 | 仅移动中 |
| `move_progress` | 正整数 | 仅移动中 |
| `move_required_ticks` | 正整数 | 仅移动中；当前为 `4` |
| `destination` | `[x, y]` | 仅移动中 |

正常核心不包含四个移动字段。可见敌方核心也会公开相同的移动字段。

### 单位

```json title="己方工人"
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

| 字段 | 格式 | 必需 |
|---|---|---:|
| `kind` | `"UNIT"` | 是 |
| `id` | UUID | 是 |
| `controlled` | boolean | 是 |
| `position` | `[x, y]` | 是 |
| `hp` | 非负整数 | 是 |
| `unit_type` | `"WORKER"`、`"VANGUARD"` 或 `"RANGER"` | 是 |
| `cargo` | 非负整数 | 仅己方工人 |

敌方工人的 `cargo` 不公开。Vanguard 和 Ranger 永远不包含 `cargo`，
包括己方单位。

## 视野 {#visibility}

| 数据 | 何时出现 | 隐藏字段 |
|---|---|---|
| 己方核心和单位 | 始终 | 对象格式中的字段全部可见 |
| 敌方核心和单位 | 所在格当前可见 | 所有者身份；敌方工人货物 |
| 地形 | 所在格当前可见 | 资源数量 |
| 信标位置 | 始终 | 无 |
| 信标状态和携带者 | 信标格当前可见 | 视野外时两个字段都隐藏 |

协议没有"上次看见"时间。把记住的地形和服务端当前状态分开保存。

## 更新状态 {#updating-state}

每次收到新状态，都重新建立实体映射：

```js
const entities = new Map();

for (const object of nextState.objects) {
  if (object.kind === 'CORE' || object.kind === 'UNIT') {
    entities.set(object.id, object);
  }
}
```

服务端按确定性顺序发送对象：

1. 障碍批次；
2. 资源批次；
3. 己方核心；
4. 按 UUID 排序的己方单位；
5. 按 UUID 排序的可见敌方核心；
6. 按 UUID 排序的可见敌方单位。

不存在的分组会跳过。数组下标永远不是对象身份。
