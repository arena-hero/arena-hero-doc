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

战斗伤害先扣护盾，扣完了才动 HP。Core 是你放资源的地方，同时也负责交维护费、接收
交付、生产 Unit、恢复 HP 和护盾，以及——很慢地——迁移。维护费欠款伤害超额 Unit，
不会伤害 Core。

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

在战斗中摧毁敌方 Core 也可能增加己方库存。对该 Core 伤害最高的玩家只能拿到当前容量
装得下的部分，多出的资源直接销毁；如果该玩家的 Core 也在同 Tick 被摧毁，受害者库存
则全部销毁。详见[摧毁与重生](./destruction-and-respawn.md#库存归谁)。

## Core 动作

一份来源计划里最多写一个 Core 动作：

| 动作 | 参数 | 用途 |
|---|---|---|
| `SPAWN` | `unit_type` | 在 Core 格生产一个 Unit。 |
| `HEAL` | 无 | 战斗后消耗资源恢复 Core HP，1 资源恢复 1 HP，直至回满。 |
| `REPAIR_SHIELD` | 无 | 消耗 1 资源恢复 1 护盾。 |
| `START_MOVE` | `direction` | 开始四 Tick 迁移。 |
| `CANCEL_MOVE` | 无 | 取消迁移并清零进度。 |
| `PICKUP_BEACON` | 无 | 拾取同格地面 Beacon。 |
| `DROP_BEACON` | 无 | 放下 Core 携带的 Beacon。 |
| `SELF_DESTRUCT` | 无 | 战斗后销毁这个 Core、库存和所有己方 Unit。 |
| `WAIT` | 无 | 显式不行动。 |

## Core 自毁

任意存活 Core 都可以提交不带其他字段的 `{"type":"SELF_DESTRUCT"}`。它不检查资源、
Unit 数量、迁移状态或历史自毁次数，也没有冷却。迁移中的 Core 会先推进或完成本 Tick
位移，仍然支付维护费并承受攻击。

战斗优先。如果敌方攻击已经摧毁 Core，照常计算摧毁参与和资源归属，自毁不再执行。
如果 Core 在战斗后仍存活，它会在 Unit 恢复、Core 恢复、修盾和生产之前自毁：

- Core 库存全部销毁，不退款也不转移；
- 所有己方 Unit 被移除并计入 `units_lost`；
- Worker Cargo 和 Champion Beacon 掉在各载体实际的战后位置；
- 不造成伤害，不给任何玩家摧毁参与或战利品；
- 立即进入普通重生流程，并增加 `respawn_count`。

私有 `CORE_DESTROYED` 使用 `reason_code: SELF_DESTRUCT`，不含 `destroyed_by`；出生点
部署成功时随后出现 `CORE_RESPAWNED`。新 Core 可在下一 Tick 再次自毁。

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
- 在战斗结束后才创建，所以出生 Tick 不会被攻击；
- 从下一个 Tick 起计入维护费。

Worker 交付排在 Core 动作之前，所以这个 Tick 实际存入的资源，可以在动作本身合法时
用于该 Core 动作。唯一做不到的是回头补上自毁阶段结束后已经扣掉的那笔维护费。
战斗中从敌方 Core 夺取的资源，可以在同 Tick 先供 Unit 恢复 HP，再供 Core 动作使用。

## HP 恢复

`HEAL` 是 Unit 或 Core 的完整动作。它在同时战斗伤害结算后执行，每实际恢复 1 HP 就从
Core 扣 1 资源，并自动持续到对象 HP 回满或 Core 资源耗尽。

Unit 必须仍然存活，并与自己静止的 Core 同格。Unit 按 UUID 原始字节序依次恢复，然后才
结算 Core 动作。致死伤害无法恢复。即使当前 HP 已满或资源为零，也可以提前提交 `HEAL`：
因为对象可能先受到非致死战斗伤害，Core 也可能先夺取到资源。到结算时条件仍不满足，
动作只会私下失败，不扣资源。

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

- 不能生产、恢复 HP、修盾，也不能拾取或放下 Beacon，但可以 `SELF_DESTRUCT`；
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

维护费自动扣，不占 Core 动作。服务端先扣掉 Core 能支付的部分，剩余每 1 点欠款对超额
Unit 造成 1 HP 伤害。Core 不会因为欠维护费掉盾或掉血。

离 Core 最近的 19 个 Unit 受保护。其他 Unit 按到当前 Core 的曼哈顿距离从远到近排列；
距离相同时按 Unit UUID 原始字节序。伤害会集中打在第一名身上，死亡后才轮到下一名。

因此死亡的 Unit 会在移动、Worker、Beacon 和战斗阶段前被移除。Worker Cargo 和携带的
Beacon 原地掉落，但不授予任何敌人摧毁参与。没死的 Unit 保留锁定动作，本 Tick 仍可
行动，也可以在战斗后合法使用 `HEAL`。私有 `UPKEEP_PAID` 给出 `due`、`paid` 和
`deficit`；随后每个受伤 Unit 都有 `UNIT_DAMAGED` / `UPKEEP_DEFICIT`，其中包含
`damage` 和剩余 `hp`。
