---
sidebar_position: 5
title: 结算结果
description: 从 state.events 读取动作结果，并查询所有事件和原因码。
---

# 结算结果

HTTP `202` 只说明服务端把计划存下来了，动作还没结算。结果要到下一条
`state.data.events` 里才出现。

先看 `event_type`，再按对应事件读其他字段：

```json
{
  "event_id": "3f360e7e-d9bd-4f48-9a51-5cf751b04075",
  "tick": 10583,
  "event_type": "UNIT_MOVE_FAILED",
  "reason_code": "MOVE_BLOCKED_TERRAIN",
  "actor_id": "9d3e4941-2816-4a39-a220-df8cd95e877d",
  "position": [120, 85]
}
```

| 要查什么 | 去哪里 |
|---|---|
| 维护费、Core 伤害、修盾或生产 | [经济与 Core 事件](#economy-and-core-events) |
| 采集或交付 | [Worker 事件](#worker-events) |
| 横扫、射击和伤害 | [战斗事件](#combat-events) |
| Unit 移动或 Core 迁移 | [移动事件](#movement-events) |
| Beacon 动作或重生 | [Beacon 与重生事件](#beacon-and-respawn-events) |

## 字段规则

| 字段 | 出现规则和含义 |
|---|---|
| `event_id` | 一定会出现。重连后用这个 UUID 去重，避免同一事件处理两次。 |
| `tick` | 一定会出现。该结果实际结算的 Tick。 |
| `event_type` | 一定会出现。先读它，再看其他可选字段。 |
| `reason_code` | 只有该事件存在规定原因时才出现。成功事件不会发一个空字符串。 |
| `actor_id` | 产生这个结果的己方 Core 或 Unit，如果存在明确动作主体的话。 |
| `target_id` | 受影响的 Core 或 Unit，如果这个结果允许公开目标的话。 |
| `position` | 与该结果相关的格子；每一行会说明它具体指哪儿。 |
| `values` | 事件专用对象。每行列出的键是稳定的；没有值时整个对象省略。 |

用不上的可选字段直接不出现，而不是发成 `null`。

## 经济与 Core 事件 {#economy-and-core-events}

| `event_type` | `reason_code` | ID 与位置 | `values` | 含义 |
|---|---|---|---|---|
| `UPKEEP_PAID` | 无 | `actor_id`：Core；`position`：Core 格 | `{due: int, paid: int, deficit: int}` | 维护费已扣；deficit 为正时随后作为 Core 伤害应用。 |
| `CORE_DAMAGED` | `ATTACK` 或 `UPKEEP_DEFICIT` | `target_id`：Core；`position`：Core 格 | `{damage: int, shield_damage: int, hp_damage: int}` | Core 受到的总伤害，以及护盾和 HP 各分摊多少。 |
| `CORE_DESTROYED` | `ATTACK` 或 `UPKEEP_DEFICIT` | `target_id`：被摧毁的 Core；`position`：摧毁格 | 攻击且存在可命名参与者时为 `{destroyed_by: string[]}`，否则无 | Core 和剩余 Unit 被移除，玩家开始等待重生。 |
| `CORE_ACTION_FAILED` | `CORE_NOT_MOVING` 或 `CORE_ALREADY_MOVING` | `actor_id`：Core；`position`：Core 格 | 无 | 对正常 Core 执行了 `CANCEL_MOVE`，或在迁移期间执行了不兼容的动作。 |
| `CORE_REPAIR_FAILED` | `SHIELD_FULL` 或 `INSUFFICIENT_RESOURCES` | `actor_id`：Core；`position`：Core 格 | 无 | 这一点护盾没能修上。 |
| `CORE_REPAIR_SUCCEEDED` | 无 | `actor_id`：Core；`position`：Core 格 | `{shield: int, cost: int}` | 修完之后的护盾值和花掉的资源。 |
| `CORE_SPAWN_FAILED` | `CELL_UNIT_LIMIT` | `actor_id`：Core；`position`：Core 格 | `{limit: int}` | Core 所在格已经到达可占位实体上限。 |
| `CORE_SPAWN_FAILED` | `INSUFFICIENT_RESOURCES` | `actor_id`：Core；`position`：Core 格 | `{required: int}` | 资源不够所选 Unit 的价格。 |
| `CORE_SPAWN_FAILED` | `DETERMINISTIC_ID_COLLISION` | `actor_id`：Core；`position`：Core 格 | 无 | 确定性生成 ID 没通过防御性的冲突检查。 |
| `CORE_SPAWN_SUCCEEDED` | 无 | `actor_id`：Core；`target_id`：新 Unit；`position`：Core 格 | `{unit_type: UnitType, cost: int}` | 在 Core 格生产出一个 Unit。 |

`destroyed_by` 是按确定性顺序排的参与者用户名。只有攻击造成的摧毁、而且至少能点出
一个参与者时，它才会出现。

## Worker 事件 {#worker-events}

| `event_type` | `reason_code` | ID 与位置 | `values` | 含义 |
|---|---|---|---|---|
| `DEPOSIT_FAILED` | `WORKER_EMPTY` | `actor_id`：Worker；`position`：Worker 格 | 无 | Worker 身上没货。 |
| `DEPOSIT_FAILED` | `CORE_NOT_PRESENT` | `actor_id`：Worker；`position`：Worker 格 | 无 | 己方 Core 不存在，或者不在同一格。 |
| `DEPOSIT_FAILED` | `CORE_MOVING` | `actor_id`：Worker；`target_id`：Core；`position`：Worker 格 | 无 | 同格的 Core 本 Tick 受迁移限制。 |
| `DEPOSIT_SUCCEEDED` | 无 | `actor_id`：Worker；`target_id`：Core；`position`：同格坐标 | `{amount: int}` | Worker 身上的货全部转进 Core 的资源。 |
| `HARVEST_FAILED` | `NOT_RESOURCE_CELL` | `actor_id`：Worker；`position`：Worker 格 | 无 | 当前地形不是资源格。 |
| `HARVEST_FAILED` | `CARGO_FULL` | `actor_id`：Worker；`position`：Worker 格 | 无 | Worker 身上已经有资源了。 |
| `HARVEST_FAILED` | `RESOURCE_DEPLETED` | `actor_id`：Worker；`position`：已消耗的资源点 | 无 | 同 Tick 另一个 UUID 更低的合格空载 Worker 赢走了这个点。 |
| `HARVEST_SUCCEEDED` | 无 | `actor_id`：Worker；`position`：已消耗的资源点 | `{amount: int}` | 一个点被消耗，Worker 装载 1 资源；有 Beacon 时装载 2。 |
| `BEACON_HARVEST_BONUS` | 无 | `actor_id`：Worker；`position`：Worker 格 | `{amount: int}` | 因为持有 Beacon 而多采到的那部分。 |

每个资源坐标上的合格空载 Worker 按 UUID 原始字节排序，只有最低 UUID 成功并消耗该点。
其他竞争者都收到 `RESOURCE_DEPLETED`，即使它们的玩家持有 Beacon 也一样。资源补充
不会生成玩家事件；后续完整状态只会在新点可见时暴露它。

## 战斗事件 {#combat-events}

| `event_type` | `reason_code` | ID 与位置 | `values` | 含义 |
|---|---|---|---|---|
| `SWEEP_RESOLVED` | 无 | `actor_id`：Vanguard；`position`：被横扫的相邻格 | `{targets_hit: int}` | 横扫已结算；命中 `0` 也是正常结果。 |
| `SHOT_MISSED` | 固定为 `SHOT_MISSED` | `actor_id`：Ranger；`target_id`：请求里的 UUID；`position`：提交的 `expected_cell` | 无 | 射击动态失败，具体原因是故意藏起来的。 |
| `SHOT_HIT` | 无 | `actor_id`：Ranger；`target_id`：被命中的 Core 或 Unit；`position`：目标格 | `{damage: int}` | 合法射击贡献了伤害。 |
| `UNIT_DAMAGED` | `ATTACK` | `target_id`：受伤的 Unit；`position`：Unit 所在格 | `{damage: int, hp: int}` | 聚合后的伤害和受伤后的 HP，最低为 `0`；`hp: 0` 表示这个 Unit 已被摧毁。 |
| `DESTRUCTION_PARTICIPATION` | `UNIT` 或 `CORE` | `target_id`：被摧毁的对象；`position`：摧毁格 | 无 | 你至少对这个对象打出过 1 点伤害。 |

受害方不会再单独收到一条 `UNIT_DESTROYED`。判断击杀要靠
`UNIT_DAMAGED.values.hp === 0`，再结合新的完整状态里这个 Unit 已经不见了。

Ranger 的所有动态失败用的都是同一个 `SHOT_MISSED`——目标没了、目标移开了、目标是
友军、距离不对、射线被挡，全都一样。这个结果就是设计成什么都不透露的。

## 移动事件 {#movement-events}

| `event_type` | `reason_code` | ID 与位置 | `values` | 含义 |
|---|---|---|---|---|
| `UNIT_MOVE_SUCCEEDED` | 无 | `actor_id`：Unit；`position`：终点 | 无 | Unit 完成了一格移动。 |
| `UNIT_MOVE_FAILED` | 见下方 Unit 移动原因 | `actor_id`：Unit；`position`：没变的起点 | 无 | Unit 留在原地。 |
| `CORE_MOVE_STARTED` | 无 | `actor_id`：Core；`position`：起点 | `{destination: Position, progress: int, required: int}` | 迁移开始；当前值是 progress `1`、required `4`。 |
| `CORE_MOVE_PROGRESS` | 无 | `actor_id`：Core；`position`：起点 | `{progress: int, required: int}` | 迁移进度往前走了一步，但 Core 还没真的挪。 |
| `CORE_MOVE_SUCCEEDED` | 无 | `actor_id`：Core；`position`：终点 | 无 | 迁移的最后一个 Tick 把 Core 挪过去了。 |
| `CORE_MOVE_FAILED` | 见下方迁移结算原因 | `actor_id`：Core；`position`：没变的起点 | 无 | 最终位移失败，Core 恢复成 `NORMAL`。 |
| `CORE_MOVE_START_FAILED` | 见下方启动原因 | `actor_id`：Core；`position`：起点 | 无 | `START_MOVE` 在进入迁移状态前就失败了。 |
| `CORE_MOVE_CANCELLED` | 无 | `actor_id`：Core；`position`：起点 | 无 | 现有迁移被取消，Core 恢复成 `NORMAL`。 |

Unit 移动原因：

- `MOVE_OUT_OF_BOUNDS`：这一步会让有符号 int64 坐标溢出；
- `MOVE_BLOCKED_TERRAIN`：终点是障碍地形；
- `MOVE_CONTESTED`：不同所有者争同一个终点；
- `MOVE_SWAP_BLOCKED`：两个敌对实体想沿同一条边对换；
- `MOVE_DESTINATION_OCCUPIED`：敌方占据者没能成功离开；
- `MOVE_DEPENDENCY_FAILED`：依赖的那次离开失败了；
- `CELL_UNIT_LIMIT`：终点会超出实体上限。

`CORE_MOVE_FAILED` 可能是
`CORE_DESTINATION_TERRAIN_BLOCKED`、`MOVE_CONTESTED`、
`MOVE_SWAP_BLOCKED`、`MOVE_DESTINATION_OCCUPIED`、
`MOVE_DEPENDENCY_FAILED` 或 `CELL_UNIT_LIMIT`。

`CORE_MOVE_START_FAILED` 可能是
`CORE_DESTINATION_OUT_OF_BOUNDS`、
`CORE_DESTINATION_TERRAIN_BLOCKED`、
`CORE_DESTINATION_OCCUPIED` 或 `CELL_UNIT_LIMIT`。

## Beacon 与重生事件 {#beacon-and-respawn-events}

| `event_type` | `reason_code` | ID 与位置 | `values` | 含义 |
|---|---|---|---|---|
| `BEACON_PICKUP_FAILED` | `CORE_MOVING`、`ALREADY_CARRIED` 或 `BEACON_NOT_PRESENT` | `actor_id`：Core 或 Unit；`position`：动作主体所在格 | 无 | 没能把 Beacon 捡起来。 |
| `BEACON_PICKED_UP` | 无 | `actor_id`：新的携带者；`position`：拾取格 | 无 | 动作主体成了携带者。 |
| `BEACON_DROP_FAILED` | `CORE_MOVING` 或 `NOT_BEACON_CARRIER` | `actor_id`：Core 或 Unit；`position`：动作主体所在格 | 无 | 没能把 Beacon 放下。 |
| `BEACON_DROPPED` | 无 | `actor_id`：原携带者；`position`：放下的格子 | 无 | 主动放下成功。 |
| `BEACON_DROPPED_ON_DEATH` | 无 | `actor_id`：被摧毁的携带者；`position`：死亡格 | 无 | Beacon 自动落到地上。 |
| `RESPAWN_DELAYED` | `NO_LEGAL_SPAWN` | 无 ID、无位置 | 无 | 没找到合法的确定性出生候选格，下一个 Tick 再试。 |
| `CORE_RESPAWNED` | 无 | `target_id`：新的 Core；`position`：出生格 | `{resources: int, workers: int}` | 玩家带着初始资源和 Worker 恢复为 `ACTIVE`。 |

## 解析示例

```js
function applyEvent(event) {
  switch (event.event_type) {
    case 'UNIT_MOVE_FAILED':
      markUnitBlocked(event.actor_id, event.position, event.reason_code);
      break;
    case 'CORE_SPAWN_SUCCEEDED':
      registerSpawn(
        event.target_id,
        event.position,
        event.values.unit_type,
      );
      break;
    case 'SHOT_MISSED':
      // 协议不会告诉你未命中的具体原因。
      break;
  }
}
```

收到新状态后，直接用新的 `state.objects` 把旧对象换掉。事件的作用是解释新状态是怎么
来的，别把它们当补丁往旧状态上回放。
