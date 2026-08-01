---
sidebar_position: 3
title: Core 与经济
description: Core 如何保存资源、生产 Unit、修复、移动并支付维护费。
---

# Core 与经济

## Core 属性

| 属性 | 默认值 |
|---|---:|
| HP 上限 | 5 |
| 护盾上限 | 5 |
| 持有 Beacon 时护盾上限 | 10 |
| 视野 | 5 |
| 重生启动资源 | 5 |

伤害和欠费伤害都是先扣护盾，扣完了才动 HP。Core 是你放资源的地方，同时也负责交维护
费、接收交付、生产 Unit、给自己修盾，以及——很慢地——迁移。

## 资源容量

人口只计算存活 Unit，不计算 Core。Core 最少能存 10 点资源；人口超过 2 后，每个 Unit
提供 5 点容量：

```text
resource_capacity = max(10, population × 5)
```

新玩家和重生玩家以 1 个 Worker、5 点资源开始。人口下降后，如果现有库存高于新容量，
高出的资源会立刻销毁。私有事件 `CORE_RESOURCE_OVERFLOW_DESTROYED` 会给出损失数量和
新容量。

Worker 只存入剩余容量，装不下的部分继续留在 Worker 身上。Core 已满时，
返回 `DEPOSIT_FAILED` / `CORE_RESOURCE_FULL`，Core 库存和 Worker Cargo 都不变。

## Core 动作

一份来源计划里最多写一个 Core 动作：

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

每 Tick 最多生产一个。一格能放两个可占位实体，Core 自己已经占掉一个，所以同时最多
只能有一个 Unit 和它待在一起——往满格里生产会拿到 `CELL_UNIT_LIMIT`，资源不扣。

刚生产出来的 Unit：

- 在被创建的这个 Tick 里不能行动；
- 但已经进了战斗快照，可以被打；
- 从下一个 Tick 起计入维护费。

Worker 交付排在 Core 动作之前，所以这个 Tick 实际存入的资源，可以在动作本身合法时
用于该 Core 动作。唯一做不到的是回头补上自毁阶段结束后已经扣掉的那笔维护费。

## 修盾

`REPAIR_SHIELD` 固定花 1 资源换 1 点护盾，而且不会让你超过当前上限。失败时会收到
私有的 `CORE_REPAIR_FAILED`，原因是 `SHIELD_FULL` 或 `INSUFFICIENT_RESOURCES`。

持有 Champion Beacon 只是把上限抬到 10，并不附送护盾。Beacon 一丢，超过 5 的部分
立刻被压回 5。

## 四 Tick 迁移

Core 往正方向挪一格，要花四个逻辑 Tick。

```text
START_MOVE 结算  -> 进度 1/4
下一 Tick        -> 进度 2/4
下一 Tick        -> 进度 3/4
下一 Tick        -> 尝试真实位移
```

中途不用反复提交，`WAIT` 也不会让它暂停。想换方向就得先 `CANCEL_MOVE`，一取消进度
就清零。

迁移期间的 Core：

- 不能生产、修盾，也不能拾取或放下 Beacon；
- 不能接收 Worker 交付；
- 照常交维护费、照常挨打；
- 库存保留；
- 同格的 Unit 不会被一起带走。

携带的 Beacon 要等真实位移成功了才跟着走。另外，开始迁移不预留任何东西：在你的第 4
个 Tick 到来之前，别人照样可以穿过目的格，甚至直接占住它。

第 4 Tick 的那次位移，进的是和 Unit 移动同一张全局依赖图。失败的话 Core 原地不动，
进度清零。

## 人口与维护费

人口只算 Unit，Core 自己从来不计入：

```text
N = Worker + Vanguard + Ranger
tier = floor(N / 20)
upkeep = tier × (tier + 1) / 2
```

| 人口 | 等级 | 每 Tick 资源 |
|---:|---:|---:|
| 0-19 | 0 | 0 |
| 20-39 | 1 | 1 |
| 40-59 | 2 | 3 |
| 60-79 | 3 | 6 |
| 80-99 | 4 | 10 |

Unit 的 `SELF_DESTRUCT` 会先结算，维护费按自毁后剩余的人口计算。本 Tick 后面新生产
的 Unit 从下一 Tick 才开始计费；战斗阶段死亡的 Unit 已经支付了本 Tick 维护费。

维护费自动扣，不占 Core 动作。交不起的话，库存直接归零，缺多少资源就对 Core 造成多少点
伤害，先盾后 HP。在维护阶段被打掉的 Core，舰队和锁定计划当场就没了，这个 Tick 后面
的阶段它们都不再参与；被移除 Worker 携带的 Cargo 会留在各自最后所在格。
