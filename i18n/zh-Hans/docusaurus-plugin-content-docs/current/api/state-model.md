---
sidebar_position: 3
title: 状态模型
description: PlayerState 字段、JSON 示例、世界对象、视野和状态更新规则。
toc_min_heading_level: 2
toc_max_heading_level: 3
---

# 状态模型

`state.data` 就是这名玩家此刻能看到的全部内容，每来一条新消息就顶掉上一份。

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

需要机器可读的定义，看 [AsyncAPI schema](/asyncapi.yaml)。

## PlayerState {#playerstate}

| 字段 | 格式 | 必需 | 含义 |
|---|---|---:|---|
| `status` | `"ACTIVE"` 或 `"RESPAWNING"` | 是 | 玩家有存活的 Core，还是正在等待重生。 |
| `respawn_at_tick` | 正 int64 | 仅重生中 | 下一次尝试重生的 Tick。 |
| `resources` | 非负整数 | 是 | Core 里存的资源；Worker 身上的 cargo 另算。 |
| `population` | 非负整数 | 是 | 存活的己方 Unit 数，不含 Core。 |
| `population_tier` | 非负整数 | 是 | `floor(population / 20)`。 |
| `upkeep_next_tick` | 非负整数 | 是 | 当前人口对应的 `tier × (tier + 1) / 2`。 |
| `champion_beacon` | object | 是 | 公开位置，以及可见时的携带状态。 |
| `objects` | array | 是 | 己方实体，加上当前可见的地形和敌方实体。 |
| `events` | array | 是 | 发给这名玩家的结算结果。 |

没有内容时，`objects` 和 `events` 是空数组 `[]`，而不是干脆不出现。`RESPAWNING`
期间资源和人口字段照样在，但在 `CORE_RESPAWNED` 到来之前，你可能一个 Core 都没有。

## Champion Beacon {#champion-beacon}

位置永远公开，其余的就看你能不能看见了。

### 视野外

```json
{
  "position": [120, 85]
}
```

你只知道它在哪儿，别的一概不知——躺在地上还是被人拿着，都看不出来。

### 可见且在地面

```json
{
  "position": [120, 85],
  "status": "GROUND"
}
```

这时候没有 `carrier_id`。

### 可见且被携带

```json
{
  "position": [120, 85],
  "status": "CARRIED",
  "carrier_id": "9d3e4941-2816-4a39-a220-df8cd95e877d"
}
```

`carrier_id` 指的是携带它的那个 Core 或 Unit。如果下一份状态里没有 `status` 或
`carrier_id`，把旧值丢掉，别留着接着用。

## 世界对象 {#world-objects}

`objects` 里每一项都以 `kind` 开头。

| `kind` | 表示 | 身份 |
|---|---|---|
| `"CORE"` | 一个 Core | `id` |
| `"UNIT"` | 一个 Worker、Vanguard 或 Ranger | `id` |
| `"OBSTACLE"` | 所有可见障碍格 | 单个坐标 |
| `"RESOURCE"` | 所有可见且当前可用的资源点 | 单个坐标 |

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
| `kind` | `"OBSTACLE"` 或 `"RESOURCE"` | 可见地图要素类型。 |
| `positions` | 非空 `[x, y]` 数组 | 可见格，先按 `x`、再按 `y` 排序。 |

同一种可见要素的所有位置都合并成一项。某个 `kind` 整个不出现，就说明当前没有一个
位置可见。这些批次没有 `id`、没有 `controlled`、没有 HP，也没有资源数量。

`OBSTACLE` 位置是永久地形。`RESOURCE` 位置表示当前可用，而不是永久地形记忆。它可能
是自然资源点，也可能是死亡 Worker 留下的 Cargo 资源堆。一次成功采集会消耗自然点；
资源堆如果只取走一部分，同一个位置仍会继续出现。之后的补充可能在区块内其他位置生成
新的自然资源点。

### Core

```json title="正常 Core"
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

```json title="迁移中的 Core"
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
| `position` | `[x, y]` | 是；迁移期间仍是起点 |
| `hp` | 非负整数 | 是 |
| `shield` | 非负整数 | 是 |
| `state` | `"NORMAL"` 或 `"MOVING"` | 是 |
| `move_direction` | 方向字符串 | 仅迁移中 |
| `move_progress` | 正整数 | 仅迁移中 |
| `move_required_ticks` | 正整数 | 仅迁移中；当前为 `4` |
| `destination` | `[x, y]` | 仅迁移中 |

正常状态的 Core 一个移动字段都没有。看得见的敌方 Core，暴露的字段和你自己的一样。

### Unit

```json title="己方 Worker"
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
| `cargo` | 非负整数 | 仅己方 Worker |

敌方 Worker 的 cargo 对你不可见。Vanguard 和 Ranger 则根本不带 `cargo` 字段，
自己的也不带。

## 视野 {#visibility}

| 数据 | 何时出现 | 隐藏字段 |
|---|---|---|
| 己方 Core 和 Unit | 始终 | 对象格式里的字段全都可见 |
| 敌方 Core 和 Unit | 所在格当前可见 | 所有者身份；敌方 Worker 的 cargo |
| 障碍与资源点 | 所在格当前可见 | 资源数量 |
| Beacon 位置 | 始终 | 无 |
| Beacon 状态和携带者 | Beacon 所在格当前可见 | 视野外时两个字段都没有 |

这里没有任何「上次看见」的时间戳。记住的障碍一直有效，但记住的资源点在重新看见
之前可能已经过期。两类探索记忆都要和服务端当前状态分开；不要把视野外的旧资源坐标
当成当前仍可用。

## 更新状态 {#updating-state}

每收到一份新状态，就把实体映射重建一次：

```js
const entities = new Map();

for (const object of nextState.objects) {
  if (object.kind === 'CORE' || object.kind === 'UNIT') {
    entities.set(object.id, object);
  }
}
```

服务端发对象的顺序是确定的：

1. 障碍批次；
2. 资源批次；
3. 己方 Core；
4. 按 UUID 排序的己方 Unit；
5. 按 UUID 排序的可见敌方 Core；
6. 按 UUID 排序的可见敌方 Unit。

空的分组会直接跳过——正因为如此，数组下标永远不能当成对象的身份。
