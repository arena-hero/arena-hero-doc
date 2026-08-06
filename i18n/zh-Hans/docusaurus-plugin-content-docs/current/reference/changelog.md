---
sidebar_position: 4
title: 更新日志
description: 玩法、协议、前端、SDK、文档和 Skill 的版本化变更历史。
---

# 更新日志

本页根据服务端、公开前端、Python SDK、文档和 Arena Hero Skill 五个仓库的 Git 历史整理。
这里只记录玩家或开发者能观察到的变化；纯重构、CI 维护和内部安全修复会合并说明，不会把
每条 commit 原样复制进来。

游戏规则版本和 Python SDK 版本互相独立。公开 HTTP 与 WebSocket API 仍是 v0.1。
当前文档对应的确切代码见[来源与版本策略](./source-and-version.md)。

## 2026 年 8 月 6 日

### 游戏规则 v0.14 — 动态 Unit 价格取代维护费

- 删除每 Tick 维护费和所有欠费伤害。`population_tier`、`upkeep_next_tick`、
  `UPKEEP_PAID` 和 `UPKEEP_DEFICIT` 直接从协议中删除，不保留弃用字段。
- Worker、Vanguard、Ranger 的基础价格仍为 5、10、12，适用于第 1-20 个 Unit。
  从第 21 个开始，价格为 `round_half_up(base_price × (13/10)^k)`，其中
  `k = max(0, floor((population - 20) / 5) + 1)`；精确分数只在最后舍入一次。
- 生产价格使用同 Tick Unit 自毁和战斗死亡后的存活人口。初始和重生 Worker 仍然免费。
- `CORE_SPAWN_SUCCEEDED.values.cost` 与
  `CORE_SPAWN_FAILED/INSUFFICIENT_RESOURCES.values.required` 返回实际结算价格。
- 两个官方网页客户端删除维护费预警和结果，并按当前状态显示动态价格；同 Tick 死亡可能让
  服务端实际扣款低于预览。
- Python SDK v0.2.9 删除旧状态字段，增加精确的
  `unit_cost(unit_type, population)` 和只读 `UNIT_BASE_COSTS`。

依赖两个已删除状态字段或枚举维护费事件的客户端需要更新。HTTP 与 WebSocket 仍保持
API v0.1，因为端点和消息 envelope 没有改变。

来源：[服务端 `b24cfcd`](https://github.com/arena-hero/arena-hero/commit/b24cfcd22b82c0af0f3993397d2696629762e7e5)、
[前端 `00f4093`](https://github.com/arena-hero/arena-hero-web/commit/00f4093e532309f750a12dfae6864f7b164a898c)
和 [SDK `423d252`](https://github.com/arena-hero/arena-hero-python/commit/423d252adcca439669adb3e7b04252e53b4430bd)。

## 2026 年 8 月 3 日

### 游戏规则 v0.13 — Ranger 真正按格射击

- `SHOOT` 保留原名并始终使用 `expected_cell`，但 `target_id` 改为可选；现有精准目标命令
  完全兼容。
- 不带 `target_id` 时，Ranger 可以射击横、竖或准确 45° 斜线上射程 1-3 内任意未受阻挡
  的格子，即使命令提交时该格还是空的。
- 移动先结算。服务端命中届时格内 HP 最低的敌方对象，HP 相同时按 UUID 原始字节序；
  空格按普通、不可区分的 `SHOT_MISSED` 结算。
- 两个网页客户端现在始终允许 Ranger 射击并高亮全部合法射击格，不再要求前端编造目标
  UUID。
- Python SDK v0.2.8 加入 `ranger.shoot_cell(position)`，让 `ShootAction.target_id` 可选，
  同时保留 `ranger.shoot(...)`。

这修复了 8 月 2 日仅网页端的近似实现：当时界面看起来是在选格，但无法指定一个可见敌人
作为 `target_id` 时仍会拒绝射击。HTTP 与 WebSocket API 保持 v0.1；由于服务端战斗选目标
逻辑改变，游戏规则升至 v0.13。

来源：[服务端 `57c2a5b`](https://github.com/arena-hero/arena-hero/commit/57c2a5b2c070c808092ddcf5425d0c87773fc6e2)、
[前端 `ceaf2b6`](https://github.com/arena-hero/arena-hero-web/commit/ceaf2b60b51882dedd65e15f9205d9fae91945ae)
和 [SDK `e32ff94`](https://github.com/arena-hero/arena-hero-python/commit/e32ff948b7ee05fa932a1305eef164bc45fc2986)。

### 游戏规则 v0.12 — Core 无条件主动自毁

- 任意存活 Core 都能提交 `{"type":"SELF_DESTRUCT"}`，不受资源、Unit 数量、迁移状态
  或冷却限制。
- 位移和战斗先结算。敌方致死攻击保留正常摧毁参与和资源归属；否则存活 Core 在恢复、
  修盾和生产前销毁库存与所有己方 Unit。
- Worker Cargo 和 Champion Beacon 掉在各载体实际位置。Core 自毁不造成伤害，也不给
  任何玩家摧毁参与或战利品。
- 私有 `CORE_DESTROYED` 使用 `reason_code: SELF_DESTRUCT`，不含 `destroyed_by`，之后
  走普通的同 Tick 重生流程。
- 两个网页客户端都加入带确认的危险 Core 动作，并显示专用 Tick 结果和重生提示。
- Python SDK v0.2.7 加入 `core.self_destruct()`，并允许严格的
  `SelfDestructAction` 作为 Core 动作。

这次修改保持 HTTP 与 WebSocket API v0.1，但新增了严格的 `core_action.type` 枚举值。
使用封闭 Core 动作联合类型的客户端，必须先更新才能解析包含该动作的权威
`received.plan`。

来源：[服务端 `bdd68e8`](https://github.com/arena-hero/arena-hero/commit/bdd68e86c778cf973452fecd5cb6a4bcf091ad45)、
[前端 `9d2d553`](https://github.com/arena-hero/arena-hero-web/commit/9d2d5534dae9e9bf170436f7fce90fe79ddce5f1)
和 [SDK `880e3a3`](https://github.com/arena-hero/arena-hero-python/commit/880e3a3869300053c8a99092b7495ba4a97f2c0e)。

## 2026 年 8 月 2 日

### 官方网页——按格指定攻击

- 先锋的手动操作现在可以选择任意相邻格，包括预计敌人会在结算时进入的空格。
- 游侠的手动操作现在直接选择高亮射击格。前端继续使用现有的 `target_id` 与
  `expected_cell` 协议：格内已有敌人时选择当前 HP 最低者；预判射击空格时，选择一步
  内可能进入该格的最低 HP 可见敌人。
- 这只是网页端和教程改进；服务端战斗规则及指令 JSON 没有变化。

这个只改客户端的实现后来由上面的规则 v0.13 取代；新规则允许真正不带目标的按格射击。

### 公开终身排行榜

- 新增一个公开排行榜接口和网页，只显示三项终身统计：信标持有 Tick、造成伤害和
  Core 摧毁参与。
- 每榜显示分数大于 0 的前 100 名；同分使用相同排名，并按 username 稳定排序。
- 只公开 username、排名与分数。其他私人统计、邮箱和内部用户 ID 仍然保持私有。

### 游戏规则 v0.11 — 维护费欠款伤害超额 Unit

- 维护费仍然先扣 Core 现有资源，但每 1 点未支付欠款改为对超额 Unit 造成 1 HP 伤害，
  不再伤害 Core。
- 离当前 Core 最近的 19 个 Unit 受保护。其他 Unit 按曼哈顿距离从远到近排列，同距离按
  UUID 原始字节序；伤害沿这个顺序集中结算。
- 欠费死亡发生在移动与战斗前。Worker Cargo 和携带的 Beacon 正常掉落，不授予敌人
  摧毁参与；受伤但存活的 Unit 本 Tick 仍可行动并在之后恢复。
- `UPKEEP_PAID` 继续给出 `due`、`paid` 和 `deficit`；`UNIT_DAMAGED` /
  `UPKEEP_DEFICIT` 给出受伤 Unit、伤害与剩余 HP。
- 前端会在 Tick 结果中解释欠费伤害与死亡。当下 Tick 维护费超过 Core 当前资源时，
  前端还会提前显示确切缺口和受威胁的 Unit；Python SDK 文档说明了如何读取这个向前
  兼容的事件。

来源：[服务端 `83ae972`](https://github.com/arena-hero/arena-hero/commit/83ae972099ad99c21cbc15c1beaf4a4e3ca724d9)、
[前端 Tick 结果 `0a673f1`](https://github.com/arena-hero/arena-hero-web/commit/0a673f1011c7a3cda393b75e0e8bd9012da4ef7c)、
[前端预警 `4d2808c`](https://github.com/arena-hero/arena-hero-web/commit/4d2808cea3c2e4f7fdee4b7939ff0fbd22ace5e3)
和 [SDK `8f967aa`](https://github.com/arena-hero/arena-hero-python/commit/8f967aabad8798580e8c9f20bde0f082a8914c47)。

### 游戏规则 v0.10 — 战斗后恢复 HP

- 所有 Unit 与自己的静止 Core 同格时都可以使用 `HEAL`；Core 也可以把 `HEAL` 作为
  自己的动作。
- 恢复在同时战斗伤害之后结算，每实际恢复 1 HP 消耗 1 Core 资源，一次动作可以消耗多份
  资源直至回满。
- Unit 按 UUID 顺序先恢复，然后才结算 Core 动作。致死伤害无法恢复，恢复失败不扣资源。
- Core 恢复 HP、修盾和生产都改到战斗后结算。因此刚修好的护盾不能吸收刚结束的伤害，
  新生产的 Unit 在出生 Tick 不会被攻击。
- 战斗中从敌方 Core 夺取的资源，可以立即用于同 Tick 的 Unit 恢复和 Core 动作。
- 增加私有恢复结果事件、生涯 HP 恢复统计、前端操作与提示，以及 Python SDK v0.2.6 的
  `unit.heal()`、`core.heal()`、`HealAction` 和类型化 `HealingResult`。

来源：[服务端 `5a3bcdf`](https://github.com/arena-hero/arena-hero/commit/5a3bcdf5fbc75574938dc35acf48b12145b37582)、
[前端 `789cf1b`](https://github.com/arena-hero/arena-hero-web/commit/789cf1b5584a18b2de5f2b2ee5546c3d9fb68166)
和 [SDK `4a29585`](https://github.com/arena-hero/arena-hero-python/commit/4a295851002ac5e73b34fa652e8d084f780c01ed)。

## 2026 年 8 月 1 日

### 游戏规则 v0.9 — 摧毁 Core 后夺取资源

- Core 因战斗被摧毁后，它的全部库存会尝试交给摧毁 Tick 对该 Core 造成伤害最多的玩家。
- 伤害相同时按玩家 UUID 原始字节序。所有攻击者仍照常获得摧毁参与；该统计不决定资源归属。
- 获胜者最多存入战后容量 `max(10, population × 5)`，多出的资源直接销毁。
- 如果获胜者的 Core 也在同一个战斗 Tick 被摧毁，受害者资源全部销毁。维护费欠款导致的
  Core 摧毁不产生战利品。
- 新增私有 `CORE_RESOURCES_CAPTURED` 结果、前端提示，以及 SDK 类型化模型
  `CoreResourceCapture`。

来源：[服务端 `a998d8d`](https://github.com/arena-hero/arena-hero/commit/a998d8d7dd3809f0cf66a60f3afe61a7008ba2e2)、
[前端 `0daf69a`](https://github.com/arena-hero/arena-hero-web/commit/0daf69a2a4fc5f7b8a8f1b5af30a7e621f8fb24d)、
[SDK `9cfe088`](https://github.com/arena-hero/arena-hero-python/commit/9cfe08821b468002887e5dea2b4bc603a76abe47)、
[文档 `9a881bf`](https://github.com/arena-hero/arena-hero-doc/commit/9a881bf066fe91ba2eaa4e9d7057c33cb8bd260a)
和 [Skill `1c4b126`](https://github.com/arena-hero/arena-hero-skill/commit/1c4b1268bec25254b13e1c92152cd58cdfc146c3)。

### 游戏规则 v0.8 — Ranger 斜线射击

- Ranger 可以横向、纵向或沿精确 45° 斜线攻击，射程为 1–3 格。
- 只有射线中间格上的障碍物会阻挡；射线两侧的对象和障碍物不影响射击。

来源：[服务端 `59268f3`](https://github.com/arena-hero/arena-hero/commit/59268f3048f3845dde1358a366365dcaba459185)。

### 游戏规则 v0.7 — 穿透射击与立即重生

- Ranger 射击可以穿过 Unit 和 Core，只有地形障碍物阻挡。
- 删除复活冷却；Core 被摧毁后，通常会在同一个结算 Tick 后段立即尝试部署替代 Core。
- 网页同时修复了 Core 移动与 Worker 交付的优先级，并在地图上恢复显示 Core 护盾。

来源：[穿透射击 `fb7680f`](https://github.com/arena-hero/arena-hero/commit/fb7680fec34338d8f31fa0d656b29639e78c6a34)
和[立即重生 `2b32550`](https://github.com/arena-hero/arena-hero/commit/2b325502fe40ccda3ee615c48a15855d6822fabd)。

## 2026 年 7 月 30 日

### 游戏规则 v0.6 — Core 最低容量

- Core 容量改为 `max(10, population × 5)`，因此存活 Unit 为 0、1、2 时仍有 10 点容量。
- 交付不能超过严格上限；人口下降后，已有的超额库存会立刻销毁。

来源：[服务端 `f81b6c9`](https://github.com/arena-hero/arena-hero/commit/f81b6c95db339e144226ca92514ad3d3c87721d9)。

### 游戏规则 v0.5 — 随人口变化的库存

- Core 资源容量开始由当前存活 Unit 人口决定。
- 前端和 SDK 开始公开当前容量与剩余空间。

来源：[服务端 `bc16014`](https://github.com/arena-hero/arena-hero/commit/bc16014cb039c34238bdef0f556219d6638ba4cc)。

## 2026 年 7 月 29 日

### 游戏规则 v0.4 — Worker Cargo 可回收

- Worker 死亡时，携带的全部资源会落在最终位置。
- Cargo 资源堆独立于区块自然资源配额持久存在，可以持续采集直到清空。

来源：[服务端 `f98e22e`](https://github.com/arena-hero/arena-hero/commit/f98e22e74486d3d51a30fd38a708da1716b3b454)。

### 游戏规则 v0.3 — Unit 自毁

- 所有 Unit 都可以在扣维护费前自毁。
- 自毁不返还费用、不造成伤害，也不给敌人摧毁参与；Worker Cargo 和携带中的 Beacon
  仍按正常规则掉落。

来源：[服务端 `16b152b`](https://github.com/arena-hero/arena-hero/commit/16b152ba63f5be4fcff2c347d8edddf5324d9558)。

### 游戏规则 v0.2 — 有限资源

- 自然资源点从永久可采改成采集一次后消耗。
- 每个 32×32 区块拥有随距离变化的固定配额，每 4 个已结算 Tick 补回缺失位置。
- 同格采集竞争改为确定性判定。

来源：[服务端 `c655315`](https://github.com/arena-hero/arena-hero/commit/c6553156d8e4512fd6010a10b6500741f023c9da)。

### 前端与可见状态

- 地形按区块缓存，Arena 渲染逐步切换到更清晰、更流畅的 Canvas，重点修复 Retina
  屏幕和缩放卡顿。
- 可见 Core 开始公开 `owner_username`，前端显示为 `@username`；Unit 所属玩家仍保持私有。

来源：[地形缓存 `e2e2ba5`](https://github.com/arena-hero/arena-hero/commit/e2e2ba54f314f6167cd06e9899d0d9756ea403e0)、
[Retina 渲染 `ca2eea4`](https://github.com/arena-hero/arena-hero/commit/ca2eea48308be5e2bdf9a33e2a33808ceaccb2b6)
和 [Core username `4d6454f`](https://github.com/arena-hero/arena-hero/commit/4d6454fa1eb8fad03e1ccb2fb50c6e82f038f477)。

## 2026 年 7 月 28 日

- 官方类型化 Python SDK 上线，包含同步/异步客户端、Turn 控制器、安全重试、回执和
  WebSocket 重连。
- 双语 Docusaurus 文档站上线，随后加入独立 Python SDK 和 Arena Hero Skill 章节。
- Arena Hero Skill 上线，提供策略脚本与直接操作两种模式，随后把完整玩法和开发文档
  打包到本地，离线也能查阅。

来源：[SDK `b784c81`](https://github.com/arena-hero/arena-hero-python/commit/b784c8122f8cfc2435fc58a28ddc40a7db615970)、
[文档 `d66a0b8`](https://github.com/arena-hero/arena-hero-doc/commit/d66a0b89fa2b943526cfa8195a59e300529763e4)
和 [Skill `7e0422d`](https://github.com/arena-hero/arena-hero-skill/commit/7e0422d730d4294e19af46283ecdb24b9a835458)。

## 2026 年 7 月 26 日

- 把长期 SSE 游戏流替换为服务端向客户端下发的 WebSocket，命令仍通过 HTTP 提交。
- 新增规范化 `received` 计划消息，同一玩家的全部客户端都会收到，重连快照也会恢复。

来源：[WebSocket `243a05b`](https://github.com/arena-hero/arena-hero/commit/243a05b37330e36a481b761d76424e94a7b830e9)
和[跨客户端回执 `b9d4de7`](https://github.com/arena-hero/arena-hero/commit/b9d4de7b36c074f0a47856421eacd5eccf675541)。

## 2026 年 7 月 23–25 日

- 完成面向生产的规则、Champion Beacon、确定性移动与战斗、PostgreSQL 持久化、认证和
  部署基础。
- 删除全服状态发布屏障；每名玩家收到自己的完整 `state` 后即可提交，不必等待其他玩家。
- 单世界单服务架构扩展到 5,000 名并发玩家的目标规模。
- 加入网页交互式教程，并完成两轮安全加固。

来源：[生产对齐 `a707f66`](https://github.com/arena-hero/arena-hero/commit/a707f66a39aa9acd2b2f3a3d6369573c8a7c19d0)、
[状态发布 `694c4c0`](https://github.com/arena-hero/arena-hero/commit/694c4c0d9671eb32156bd0bf09101a38fe341a0e)、
[5,000 玩家扩展 `fb5a3cd`](https://github.com/arena-hero/arena-hero/commit/fb5a3cdcb106e2a1826724932697900ac5e7936a)
和[教程 `3a9535c`](https://github.com/arena-hero/arena-hero/commit/3a9535c53d0eb9726c609c5b13a671933a24e715)。

## 2026 年 7 月 15–17 日

- 建立共享永久世界、确定性 Tick 引擎、最初的 `tick` / `state` / command 协议、Go
  服务端、PostgreSQL 存储和网页客户端。
- 加入客户端自动路线；每个 Tick 只提交下一步合法移动。

来源：[初始实现 `c32c144`](https://github.com/arena-hero/arena-hero/commit/c32c144f6fd82b306fd0fb31a0ce9229dffb063e)
和[自动路线 `d9c7d2d`](https://github.com/arena-hero/arena-hero/commit/d9c7d2dcb6e3cf2d9a28c063080574b2be4c786e)。

## Python SDK 发布记录

SDK 版本与游戏规则版本互相独立。

| 版本 | 日期 | 开发者可见变化 |
|---|---|---|
| 0.2.9 | 2026-08-06 | PyPI 发布版；删除维护费状态字段，增加精确的动态 Unit 价格 helper。 |
| 0.2.8 | 2026-08-03 | 加入 `ranger.shoot_cell(position)`，并允许 `ShootAction` 不带 `target_id`；已发布到 PyPI。 |
| 0.2.7 | 2026-08-03 | 加入 `core.self_destruct()`，并允许严格的 Core `SelfDestructAction` 计划。 |
| 0.2.6 | 2026-08-02 | 已发布到 PyPI；增加 Unit/Core 恢复、类型化 `HealingResult`，并包含未单独发布的 0.2.5 源码中的 `CoreResourceCapture`。 |
| 0.2.5 源码 | 2026-08-01 | 增加类型化 `CoreResourceCapture`；已提交，但尚未发布到 PyPI。 |
| 0.2.4 | 2026-07-30 | 加入 Core 最低容量契约与发布元数据。 |
| 0.2.3 | 2026-07-30 | 公开 Core 资源容量与剩余空间。 |
| 0.2.2 | 2026-07-29 | 公开 Core 的 `owner_username`。 |
| 0.2.1 | 2026-07-29 | 更新打包与 Apache-2.0 发布信息；没有玩法协议变化。 |
| 0.2.0 | 2026-07-29 | 支持 Unit 自毁与 Cargo 回收事件。 |
| 0.1.0 | 2026-07-28 | 官方同步/异步 SDK 首次发布到 PyPI。 |
