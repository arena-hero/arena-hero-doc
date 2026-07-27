---
sidebar_position: 3
title: Core 与经济
description: Core 属性、资源、生产、修盾、迁移、容量与维护费。
---

# Core 与经济

## Core 属性

| 属性 | 默认值 |
|---|---:|
| HP 上限 | 5 |
| 护盾上限 | 5 |
| 持有 Beacon 时护盾上限 | 10 |
| 视野 | 5 |
| 重生启动资源 | 20 |

伤害和欠费伤害都先扣护盾，再扣 HP。Core 是玩家的资源仓库、维护费支付者、交付接收点、Unit 生产点、修盾对象和慢速移动实体。

## Core 动作

| 动作 | 参数 | 用途 |
|---|---|---|
| `SPAWN` | `unit_type` | 在 Core 格生产一个 Unit。 |
| `REPAIR_SHIELD` | 无 | 消耗 1 资源恢复 1 护盾。 |
| `START_MOVE` | `direction` | 开始四 Tick 迁移。 |
| `CANCEL_MOVE` | 无 | 取消迁移并清零进度。 |
| `PICKUP_BEACON` | 无 | 拾取同格地面 Beacon。 |
| `DROP_BEACON` | 无 | 放下 Core 携带的 Beacon。 |
| `WAIT` | 无 | 显式不行动。 |

## 生产

| Unit | 价格 | 出生位置 |
|---|---:|---|
| Worker | 5 | Core 格 |
| Vanguard | 10 | Core 格 |
| Ranger | 12 | Core 格 |

Core 每 Tick 最多生产一个 Unit。每格最多有两个可占位实体，Core 自身占一个，因此只能再同格一个 Unit。`CELL_UNIT_LIMIT` 会让生产失败且不扣资源。

新 Unit 本 Tick 不能行动，但会进入战斗快照，可以被攻击并阻挡 Ranger；从下一 Tick 开始计入维护费。

Worker 交付发生在生产之前，所以本 Tick 交付的资源可以用于生产或修盾，但不能追溯支付 Tick 开始时已收取的维护费。

## 修盾

`REPAIR_SHIELD` 固定消耗 1 资源恢复 1 护盾，不能超过当前上限。失败会返回 `CORE_REPAIR_FAILED`，原因如 `SHIELD_FULL` 或 `INSUFFICIENT_RESOURCES`。

持有 Champion Beacon 只把上限提高到 10，不赠送护盾。失去 Beacon 时，超过 5 的护盾立即降到 5。

## 四 Tick 迁移

```text
START_MOVE 结算  -> 进度 1/4
下一 Tick        -> 进度 2/4
下一 Tick        -> 进度 3/4
下一 Tick        -> 尝试真实位移
```

迁移不需要重复提交，`WAIT` 不会暂停。改变方向前必须 `CANCEL_MOVE`，取消会清零。

迁移中 Core：

- 不能生产、修盾、拾取或放下 Beacon；
- 不能接收 Worker 交付；
- 继续支付维护费并承受伤害；
- 保留库存；
- 不会带走同格 Unit。

开始迁移不会预留目的格。第 4 Tick 的真实位移进入与 Unit 相同的全局移动依赖图；失败时 Core 留在原格并清零进度。

## 人口与维护费

人口只计算 Unit：

```text
N = Worker + Vanguard + Ranger
tier = floor(N / 20)
upkeep = tier × (tier + 1) / 2
```

| 人口 | 等级 | 每 Tick 资源 |
|---:|---:|---:|
| 0–19 | 0 | 0 |
| 20–39 | 1 | 1 |
| 40–59 | 2 | 3 |
| 60–79 | 3 | 6 |
| 80–99 | 4 | 10 |

维护费自动扣除，不占动作。库存不足时库存归零，每缺 1 资源对 Core 造成 1 伤害，先盾后 HP。在维护阶段被摧毁的 Core 会立即失去舰队和锁定计划，后续阶段不再行动。
