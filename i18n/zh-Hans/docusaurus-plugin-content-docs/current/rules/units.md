---
sidebar_position: 4
title: 单位
description: Worker、Vanguard 和 Ranger 能做什么，需要多少资源。
---

# 单位

每个 Unit 活着的时候 UUID 保持不变，占一格容量，每 Tick 最多走一格、最多做一个动作。

## 对比

| Unit | HP | 视野 | 价格 | 攻击 | 职责 |
|---|---:|---:|---:|---:|---|
| Worker | 2 | 3 | 5 | 无 | 采集与交付 |
| Vanguard | 4 | 4 | 10 | 范围 1 格、伤害 1 | 相邻格范围压制 |
| Ranger | 2 | 5 | 12 | 八方向直线 1-3 格、伤害 1 | 精确远程攻击 |

`MOVE`、`PICKUP_BEACON`、`DROP_BEACON`、`HEAL`、`SELF_DESTRUCT` 和 `WAIT` 所有 Unit
都能用，其余动作则要看类型。

## Worker

允许的动作：`MOVE`、`HARVEST`、`DEPOSIT`、`PICKUP_BEACON`、`DROP_BEACON`、
`HEAL`、`SELF_DESTRUCT`、`WAIT`。

`HARVEST` 要求一个空载 Worker 站在 `RESOURCE` 格上。自然资源点通常产出 1 点，
所属玩家持有 Champion Beacon 时产出 2 点，随后该点被消耗。若同格有死亡 Worker
留下的 Cargo 资源堆，则优先回收：普通 Worker 一次拿 1 点，Beacon Worker 最多拿
2 点，但不会超过资源堆实际剩余量。

如果同一个 Tick 有多个合格的空载 Worker 采同一个点，只有 UUID 原始字节序最小的
Worker 成功。资源点只消耗一次，其他竞争者都收到 `HARVEST_FAILED`，reason 是
`RESOURCE_DEPLETED`。Beacon 不会改变这个胜负顺序。

所谓载重上限，其实就是上一次成功采集或回收拿到的量：平时是 1，有 Beacon 时最多是 2。
Beacon 丢了也不会把 Worker 身上已经背着的那点加成资源抹掉。

`DEPOSIT` 要求 Worker 和自己的 Core 同格，而且这个 Core 必须处于正常、可接收的
状态——正在迁移或者刚迁移完还在恢复的 Core 收不了货。Core 容量是
`max(10, population × 5)`；交付只存入能装下的部分，剩余 Cargo 留在 Worker 身上。Core 已满
时返回 `CORE_RESOURCE_FULL`。任何交付失败都不会动 Cargo。Worker
不管因为什么死亡，全部 Cargo 都会变成最后所在格的资源堆。

Worker 完全不能攻击。

## Vanguard

允许的动作：`MOVE`、带 cardinal `direction` 的 `SWEEP`、`PICKUP_BEACON`、
`DROP_BEACON`、`HEAL`、`SELF_DESTRUCT`、`WAIT`。

`SWEEP` 打你指定方向上的那一格相邻格：站在那儿的每个敌方 Unit 各受 1 伤害，敌方
Core 同样受 1。多个 Vanguard 打同一格，伤害会在同一份战斗快照里累加。

横扫不需要 target UUID，也绝不会伤到自己人。

## Ranger

允许的动作：`MOVE`、带 `target_id` 和 `expected_cell` 的 `SHOOT`、`PICKUP_BEACON`、
`DROP_BEACON`、`HEAL`、`SELF_DESTRUCT`、`WAIT`。

一次射击只有在下面几条全部成立时才合法：

1. 目标是敌方 Unit 或 Core；
2. 目标还在 `expected_cell` 上；
3. Ranger 和目标在同一条横线、竖线或 45° 斜线上；
4. 沿该直线的距离是 1、2 或 3——相对位置 `(3, 3)` 算 3 格，`(2, 1)` 不在合法直线上；
5. 中间的格子里没有障碍物。

Unit 和 Core 无论敌我都不阻挡 Ranger 射击。目标格上可能叠着好几个对象，`target_id`
指定其中一个；同格对象之间没有前后顺序。斜射只检查射线实际经过的斜线中间格，
斜线两侧的障碍物不阻挡。

POST 接口故意接受你没见过、甚至根本不存在的 UUID，就是不让它变成探测战争迷雾的
工具。到结算时，目标不存在、目标是友军、目标已经移开、距离不对、射线被挡，全都
归成同一个私有的 `SHOT_MISSED` 事件。

## 自毁

所有 Unit 都能提交：

```json
{"type": "SELF_DESTRUCT"}
```

它会在扣维护费之前移除这个 Unit，因此本 Tick 按自毁后的实际人口计费。Unit 不再执行
其他动作，不返还生产费用，不造成范围伤害，也不给任何玩家摧毁参与。Worker 携带的资源
会掉在当前格。携带 Beacon 的 Unit 也会把 Beacon 掉在这里，而且本 Tick 不能再次拾取。玩家
会收到 `UNIT_SELF_DESTRUCTED`，`units_lost` 同时增加 1。

## 恢复 HP

所有 Unit 都能提交：

```json
{"type": "HEAL"}
```

Unit 会用掉本 Tick 的完整动作。战斗结束后，它必须仍然存活，并与自己静止的 Core 同格。
动作从 Core 库存中按 1 资源恢复 1 HP，可以一次恢复多点，直到 HP 回满或资源耗尽。Unit
按 UUID 原始字节序依次恢复，然后才结算 Core 动作。致死伤害会先移除 Unit，无法恢复。
满血或当前没有资源时提交仍是一份合法计划；若到结算时情况没有改变，动作失败且不扣资源。

## 动作示例

```json title="Worker 采集"
{"type": "HARVEST"}
```

```json title="任意 Unit 自毁"
{"type": "SELF_DESTRUCT"}
```

```json title="任意 Unit 恢复 HP"
{"type": "HEAL"}
```

```json title="Vanguard 向右横扫"
{"type": "SWEEP", "direction": "RIGHT"}
```

```json title="Ranger 射击"
{
  "type": "SHOOT",
  "target_id": "175f47f4-f7de-4785-b45c-9a2d2289a8ea",
  "expected_cell": [120, 85]
}
```

一个动作只能带它自己 `type` 需要的字段。多出一个无关字段，整份计划就会以
`UNEXPECTED_ACTION_FIELDS` 被拒，哪怕它的值是 `null`、空字符串或者全零 UUID。
