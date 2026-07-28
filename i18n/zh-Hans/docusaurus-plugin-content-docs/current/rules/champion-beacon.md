---
sidebar_position: 7
title: Champion Beacon
description: Champion Beacon 如何显示、被携带、掉落并提供加成。
---

# Champion Beacon

世界上只有一个 Champion Beacon，它不可摧毁，初始位置是 `[0, 0]`。重启既不会移动它，
也不会把它重置。

## 可见性

每份 `state` 里都带着 Beacon 的坐标，对所有人、在任何时候都公开。只有当它所在的格子
恰好可见时，你才会知道它是 `GROUND` 还是 `CARRIED`，以及一个不带 owner 的
`carrier_id`。

Beacon 本身很不占地方：

- 不占用格子容量；
- 什么都不阻挡——移动、视野、Ranger 射线都不挡；
- 可以和其他实体待在同一格；
- 网页路线正好经过它，也不会顺手把它捡起来。

## 拾取与放下

任意 Unit，或者一个没在迁移的正常 Core，只要和地面上的 Beacon 同格，就可以花掉整个
动作去 `PICKUP_BEACON`。而 `DROP_BEACON` 只有当前载体能用。

如果同一个 Tick 有好几个对象同时去拿，就比载体 UUID 的原始字节，最小的那个拿到。
你没法从一个还活着的载体手里直接抢走它。

Beacon 动作在 Worker 采集之前结算，这带来一个很方便的结果：

- 这个 Tick 拾取成功，采集增益当场就生效；
- 这个 Tick 放下成功，增益当场就没了。

## 护盾增益

持有 Beacon 会把这名玩家的 Core 护盾上限从 5 提到 10。

- 拾取本身不赠送护盾，也不做任何修复。
- 你照样得花 `REPAIR_SHIELD`，1 资源换 1 点护盾。
- Beacon 一丢，当前超过 5 的护盾立刻被压回 5。

## Worker 增益

符合条件的空载 Worker 平时采回 1 点资源；所属玩家持有 Beacon 时，采集并携带 2 点。

已经背在身上的那份加成 cargo，即使 Beacon 丢了也还是 2 点，可以一次交付掉。而且资源
点是无限的，所以同格的每个符合条件的 Worker 都照样拿满。

## 移动与死亡掉落

载体每成功移动一次，Beacon 就跟着走。Core 迁移期间，它一直停在 Core 当前的逻辑
位置，直到第 4 Tick 的真实位移成功为止。

假设 Tick 开始时 Beacon 已经在被携带，之后它被主动放下，或者载体死了，或者所属
Core 被摧毁——这三种情况下 Beacon 都会落在载体最终的实际位置，而且本 Tick 谁也捡
不起来，最早也得等下一个 Tick。

这个冷却就是重点：它阻止一个 Tick 之内把 Beacon 在一串载体之间接力传下去。
