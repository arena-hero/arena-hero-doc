---
sidebar_position: 7
title: Champion Beacon
description: 全局坐标、拾取与放下顺序、载体、护盾与采集增益、移动和死亡掉落。
---

# Champion Beacon

世界只有一个不可摧毁的 Champion Beacon，初始位于 `[0, 0]`，重启不会重置。

## 可见性

Beacon 坐标在每个 `state` 中始终公开；`GROUND` / `CARRIED` 和不带 owner 的 `carrier_id` 只在其格当前可见时公开。

Beacon 不占容量，不阻挡移动、视野或 Ranger 射线，可以与实体同格；网页路线经过它不会自动拾取。

## 拾取与放下

任意 Unit 或正常、非迁移 Core 与地面 Beacon 同格时，可以消耗完整动作 `PICKUP_BEACON`。只有当前载体可以 `DROP_BEACON`。

多人同 Tick 拾取按载体 UUID 原始字节升序决定，最小者成功。不能从活着的载体手中直接夺取。

Beacon 动作在 Worker 采集前结算，因此本 Tick 成功拾取立即获得采集增益，成功放下立即失去增益。

## 护盾增益

持有 Beacon 时玩家 Core 护盾上限从 5 提高到 10。拾取不赠送或恢复护盾，仍要用 `REPAIR_SHIELD`。失去时超过 5 的当前护盾立即降到 5。

## Worker 增益

普通空载 Worker 采集 1；所属玩家持有 Beacon 时采集并携带 2。失去 Beacon 不删除已携带的额外 cargo，可以一次交付。无限资源点允许同格所有合格 Worker 都获得完整数量。

## 移动与死亡掉落

Beacon 跟随载体成功移动。Core 迁移期间在真实位移成功前保持当前逻辑位置。

若 Tick 开始时 Beacon 已被携带，之后主动放下、载体死亡或所属 Core 被摧毁，Beacon 会落在载体最终实际位置，并且本 Tick 不能再次拾取，最早下一 Tick。

这可以阻止一个 Tick 内在多个载体之间连锁转移。
