---
sidebar_position: 5
title: 结算结果
description: 从 state.events 读取动作结果，并查询所有事件和原因码。
---

# 结算结果

HTTP `202` 只表示服务端保存了计划，动作还没有结算。结果会出现在下一条
`state.data.events` 中。

先看 `event_type`，再按对应事件读取其他字段：

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
| 维护费、Core 伤害、修复或生产 | [经济和 Core 事件](#经济和核心事件) |
| 采集或存入 | [Worker 事件](#工人事件) |
| 横扫、射击和伤害 | [战斗事件](#战斗事件) |
| Unit 移动或 Core 迁移 | [移动事件](#移动事件) |
| Beacon 动作或重生 | [Beacon 和重生事件](#信标和重生事件) |

## 字段规则

| 字段 | 出现规则和含义 |
|---|---|
| `event_id` | 一定会出现。重连后如果重复处理同一事件，可用这个 UUID 去重。 |
| `tick` | 一定会出现。该结果实际结算的 Tick。 |
| `event_type` | 一定会出现。先读取它，再看其他可选字段。 |
| `reason_code` | 只有事件存在规定原因时才出现。成功事件不会发送空字符串。 |
| `actor_id` | 产生该结果的己方核心或单位（如果存在明确动作主体）。 |
| `target_id` | 受影响的核心或单位（如果该结果允许公开目标）。 |
| `position` | 与结果相关的格子；每个目录条目会说明其精确含义。 |
| `values` | 事件专用对象。每个事件行中列出的键是稳定格式；没有值时整个对象省略。 |

没有值的可选字段会直接省略，不会发送 `null`。

## 经济和核心事件

| `event_type` | `reason_code` | ID 与位置 | `values` | 含义 |
|---|---|---|---|---|
| `UPKEEP_PAID` | 无 | `actor_id`：核心；`position`：核心格 | `{due: int, paid: int, deficit: int}` | 已扣除维护费；正数 deficit 随后会作为核心伤害。 |
| `CORE_DAMAGED` | `ATTACK` 或 `UPKEEP_DEFICIT` | `target_id`：核心；`position`：核心格 | `{damage: int, shield_damage: int, hp_damage: int}` | 核心总伤害，以及护盾和 HP 的分摊。 |
| `CORE_DESTROYED` | `ATTACK` 或 `UPKEEP_DEFICIT` | `target_id`：被摧毁核心；`position`：摧毁格 | 攻击且存在可命名参与者时为 `{destroyed_by: string[]}`，否则无 | 核心及剩余单位被移除，玩家进入等待重生状态。 |
| `CORE_ACTION_FAILED` | `CORE_NOT_MOVING` 或 `CORE_ALREADY_MOVING` | `actor_id`：核心；`position`：核心格 | 无 | 对正常核心执行取消迁移，或迁移期间执行不兼容动作。 |
| `CORE_REPAIR_FAILED` | `SHIELD_FULL` 或 `INSUFFICIENT_RESOURCES` | `actor_id`：核心；`position`：核心格 | 无 | 无法恢复一点护盾。 |
| `CORE_REPAIR_SUCCEEDED` | 无 | `actor_id`：核心；`position`：核心格 | `{shield: int, cost: int}` | 修复后的护盾和消耗的资源。 |
| `CORE_SPAWN_FAILED` | `CELL_UNIT_LIMIT` | `actor_id`：核心；`position`：核心格 | `{limit: int}` | 核心格已达到可占格实体上限。 |
| `CORE_SPAWN_FAILED` | `INSUFFICIENT_RESOURCES` | `actor_id`：核心；`position`：核心格 | `{required: int}` | 资源低于所选单位的费用。 |
| `CORE_SPAWN_FAILED` | `DETERMINISTIC_ID_COLLISION` | `actor_id`：核心；`position`：核心格 | 无 | 确定性生成 ID 的防御性冲突检查失败。 |
| `CORE_SPAWN_SUCCEEDED` | 无 | `actor_id`：核心；`target_id`：新单位；`position`：核心格 | `{unit_type: UnitType, cost: int}` | 在核心格生成一个单位。 |

`destroyed_by` 是按确定性顺序排列的参与者用户名数组。只有攻击造成摧毁，
且至少能确定一个参与者用户名时才会出现。

## 工人事件

| `event_type` | `reason_code` | ID 与位置 | `values` | 含义 |
|---|---|---|---|---|
| `DEPOSIT_FAILED` | `WORKER_EMPTY` | `actor_id`：工人；`position`：工人格 | 无 | 工人没有货物。 |
| `DEPOSIT_FAILED` | `CORE_NOT_PRESENT` | `actor_id`：工人；`position`：工人格 | 无 | 己方核心不存在或不在同一格。 |
| `DEPOSIT_FAILED` | `CORE_MOVING` | `actor_id`：工人；`target_id`：核心；`position`：工人格 | 无 | 同格核心在本 Tick 受迁移限制。 |
| `DEPOSIT_SUCCEEDED` | 无 | `actor_id`：工人；`target_id`：核心；`position`：共同所在格 | `{amount: int}` | 工人的全部货物转入核心资源。 |
| `HARVEST_FAILED` | `NOT_RESOURCE_CELL` | `actor_id`：工人；`position`：工人格 | 无 | 当前地形不是资源格。 |
| `HARVEST_FAILED` | `CARGO_FULL` | `actor_id`：工人；`position`：工人格 | 无 | 工人已经携带资源。 |
| `HARVEST_SUCCEEDED` | 无 | `actor_id`：工人；`position`：工人格 | `{amount: int}` | 资源已装入工人货物。 |
| `BEACON_HARVEST_BONUS` | 无 | `actor_id`：工人；`position`：工人格 | `{amount: int}` | 因携带信标而获得的采集奖励部分。 |

## 战斗事件

| `event_type` | `reason_code` | ID 与位置 | `values` | 含义 |
|---|---|---|---|---|
| `SWEEP_RESOLVED` | 无 | `actor_id`：Vanguard；`position`：被横扫的相邻格 | `{targets_hit: int}` | 横扫完成；命中数为 `0` 也是正常结果。 |
| `SHOT_MISSED` | 固定为 `SHOT_MISSED` | `actor_id`：Ranger；`target_id`：请求中的 UUID；`position`：提交的 `expected_cell` | 无 | 射击动态失败；具体原因有意隐藏。 |
| `SHOT_HIT` | 无 | `actor_id`：Ranger；`target_id`：命中的核心或单位；`position`：目标格 | `{damage: int}` | 有效射击贡献了伤害。 |
| `UNIT_DAMAGED` | `ATTACK` | `target_id`：受伤单位；`position`：单位格 | `{damage: int, hp: int}` | 聚合伤害和受伤后的 HP，最低为 `0`；`hp: 0` 表示单位被摧毁。 |
| `DESTRUCTION_PARTICIPATION` | `UNIT` 或 `CORE` | `target_id`：被摧毁对象；`position`：摧毁格 | 无 | 当前玩家对该对象至少贡献了一点伤害。 |

受害者不会再收到单独的 `UNIT_DESTROYED`。请通过
`UNIT_DAMAGED.values.hp === 0`，并结合新完整状态中该单位已消失来判断摧毁。

Ranger 的所有动态失败都使用同一个 `SHOT_MISSED`。目标不存在、已经移动、属于己方、
距离不合法或射线受阻时，结果都一样，不会泄露隐藏状态。

## 移动事件

| `event_type` | `reason_code` | ID 与位置 | `values` | 含义 |
|---|---|---|---|---|
| `UNIT_MOVE_SUCCEEDED` | 无 | `actor_id`：单位；`position`：终点 | 无 | 单位完成一格移动。 |
| `UNIT_MOVE_FAILED` | 见单位移动原因 | `actor_id`：单位；`position`：未改变的起点 | 无 | 单位停留在原位。 |
| `CORE_MOVE_STARTED` | 无 | `actor_id`：核心；`position`：起点 | `{destination: Position, progress: int, required: int}` | 开始迁移；当前值为 progress `1`、required `4`。 |
| `CORE_MOVE_PROGRESS` | 无 | `actor_id`：核心；`position`：起点 | `{progress: int, required: int}` | 迁移进度增加，但核心尚未真正移动。 |
| `CORE_MOVE_SUCCEEDED` | 无 | `actor_id`：核心；`position`：终点 | 无 | 迁移最后一个 Tick 将核心移动到终点。 |
| `CORE_MOVE_FAILED` | 见迁移结算原因 | `actor_id`：核心；`position`：未改变的起点 | 无 | 最终移动失败，核心恢复为 `NORMAL`。 |
| `CORE_MOVE_START_FAILED` | 见启动原因 | `actor_id`：核心；`position`：起点 | 无 | `START_MOVE` 在进入迁移状态前失败。 |
| `CORE_MOVE_CANCELLED` | 无 | `actor_id`：核心；`position`：起点 | 无 | 取消现有迁移，核心恢复为 `NORMAL`。 |

单位移动原因：

- `MOVE_OUT_OF_BOUNDS`：下一步会造成有符号 int64 坐标溢出；
- `MOVE_BLOCKED_TERRAIN`：终点为障碍地形；
- `MOVE_CONTESTED`：不同所有者争夺同一终点；
- `MOVE_SWAP_BLOCKED`：两个敌对实体尝试沿同一条边对换；
- `MOVE_DESTINATION_OCCUPIED`：敌方占用者没有成功离开；
- `MOVE_DEPENDENCY_FAILED`：依赖的离开动作失败；
- `CELL_UNIT_LIMIT`：终点将超过实体上限。

`CORE_MOVE_FAILED` 可使用
`CORE_DESTINATION_TERRAIN_BLOCKED`、`MOVE_CONTESTED`、
`MOVE_SWAP_BLOCKED`、`MOVE_DESTINATION_OCCUPIED`、
`MOVE_DEPENDENCY_FAILED` 或 `CELL_UNIT_LIMIT`。

`CORE_MOVE_START_FAILED` 可使用
`CORE_DESTINATION_OUT_OF_BOUNDS`、
`CORE_DESTINATION_TERRAIN_BLOCKED`、
`CORE_DESTINATION_OCCUPIED` 或 `CELL_UNIT_LIMIT`。

## 信标和重生事件

| `event_type` | `reason_code` | ID 与位置 | `values` | 含义 |
|---|---|---|---|---|
| `BEACON_PICKUP_FAILED` | `CORE_MOVING`、`ALREADY_CARRIED` 或 `BEACON_NOT_PRESENT` | `actor_id`：核心或单位；`position`：动作主体所在格 | 无 | 无法拾取信标。 |
| `BEACON_PICKED_UP` | 无 | `actor_id`：新携带者；`position`：拾取格 | 无 | 动作主体成为信标携带者。 |
| `BEACON_DROP_FAILED` | `CORE_MOVING` 或 `NOT_BEACON_CARRIER` | `actor_id`：核心或单位；`position`：动作主体所在格 | 无 | 无法放下信标。 |
| `BEACON_DROPPED` | 无 | `actor_id`：原携带者；`position`：放下格 | 无 | 主动放下成功。 |
| `BEACON_DROPPED_ON_DEATH` | 无 | `actor_id`：被摧毁携带者；`position`：摧毁格 | 无 | 信标自动落地。 |
| `RESPAWN_DELAYED` | `NO_LEGAL_SPAWN` | 无 ID、无位置 | 无 | 没有找到合法的确定性出生候选格；下一 Tick 再试。 |
| `CORE_RESPAWNED` | 无 | `target_id`：新核心；`position`：出生格 | `{resources: int, workers: int}` | 玩家以初始资源和工人恢复为 `ACTIVE`。 |

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

收到新状态后，直接用新的 `state.objects` 替换旧对象。事件只解释状态为什么变成这样，
不要把它们当作补丁回放到旧状态上。
