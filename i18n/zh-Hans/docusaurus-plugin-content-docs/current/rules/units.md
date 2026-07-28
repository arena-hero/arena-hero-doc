---
sidebar_position: 4
title: 单位
description: Worker、Vanguard 和 Ranger 能做什么，需要多少资源。
---

# 单位

每个 Unit 存活期间拥有稳定 UUID，占一个格子容量，每 Tick 最多移动一格并执行一个动作。

## 对比

| Unit | HP | 视野 | 价格 | 攻击 | 职责 |
|---|---:|---:|---:|---:|---|
| Worker | 2 | 3 | 5 | 无 | 采集与交付 |
| Vanguard | 4 | 4 | 10 | 范围 1 格、伤害 1 | 相邻格范围压制 |
| Ranger | 2 | 5 | 12 | 直线 1-3 格、伤害 1 | 精确远程攻击 |

所有 Unit 都能使用 `MOVE`、`PICKUP_BEACON`、`DROP_BEACON` 和 `WAIT`。其他动作取决于
Unit 类型。

## Worker

允许：`MOVE`、`HARVEST`、`DEPOSIT`、`PICKUP_BEACON`、`DROP_BEACON`、`WAIT`。

`HARVEST` 要求空载 Worker 位于 `RESOURCE` 格。通常采集 1 资源；所属玩家持有 Champion Beacon 时采集并携带 2。资源点不会耗尽，因此同格多个合格 Worker 都能获得完整数量。

失去 Beacon 不会删除已经携带的第 2 点资源。

`DEPOSIT` 要求 Worker 与自己的正常、可接收 Core 同格。迁移中或迁移恢复期的 Core 不能接收。失败不会删除 cargo；Worker 死亡时 cargo 消失。

Worker 不能攻击。

## Vanguard

允许：`MOVE`、带 cardinal `direction` 的 `SWEEP`、`PICKUP_BEACON`、`DROP_BEACON`、`WAIT`。

`SWEEP` 攻击指定方向的相邻格：其中每个敌方 Unit 各受 1 伤害，敌方 Core 也受 1 伤害。多个 Vanguard 的伤害在同一战斗快照中累加，不伤害友军，也不需要 target UUID。

## Ranger

允许：`MOVE`、带 `target_id` 和 `expected_cell` 的 `SHOOT`、`PICKUP_BEACON`、`DROP_BEACON`、`WAIT`。

射击合法条件：

1. 目标是敌方 Unit 或 Core；
2. 目标仍位于 `expected_cell`；
3. Ranger 与目标同一横线或竖线；
4. 曼哈顿距离为 1、2 或 3；
5. 中间格没有障碍、Unit 或 Core。

目标格可叠加多个对象，`target_id` 指定其中一个，格内对象没有前后顺序。

POST 会接受未见过或不存在的 UUID，避免接口成为战争迷雾探测器。结算时目标不存在、友军、已移动、超距或射线被挡都统一变成 `SHOT_MISSED`。

## 动作示例

```json title="Worker 采集"
{"type": "HARVEST"}
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

动作只能包含对应 `type` 需要的字段。多余字段会让整份计划以
`UNEXPECTED_ACTION_FIELDS` 被拒绝，即使值是 `null`、空字符串或零 UUID。
