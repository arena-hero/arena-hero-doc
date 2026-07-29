---
sidebar_position: 2
title: 术语表
description: Arena Hero 规则和 API 页面中常用的术语。
---

# 术语表

**Agent**

以 `AGENT` 为来源的本地自动客户端。它从 WebSocket 接收状态，从 HTTP 提交计划。

**服务端状态（Server state）**

服务端发给你的当前 `state`。记住的地形、规划好的路线、各种预测和 UI 动画，都是
客户端自己的东西，随时可能已经过期。

**Champion Beacon**

全世界唯一、不可摧毁的争夺目标。坐标任何时候都公开；能看见的携带者会获得护盾上限
和 Worker 采集加成。

**Cargo 资源堆（Cargo pile）**

Worker 死亡时留在最后所在格的资源。数量会独立于区块自然资源配额持续保存，直到被
Worker 回收完。

**命令门（Command gate）**

服务端的一道关口，只在当前处于 OPEN 的窗口内接受正确到达的计划。

**完整计划（Complete plan）**

一个来源在一个 Tick 里想要的完整动作表。后一次 POST 是把该来源之前那份整个换掉，
而不是往上打补丁。

**受控对象（Controlled）**

`controlled: true` 表示这个对象属于收到状态的这名玩家；`controlled: false` 表示当前
可见的敌方对象。

**Core**

你的基地：资源仓库、带护盾的主要生命对象、Unit 生产设施，以及一个移动极慢的实体。

**动态验证（Dynamic validation）**

只有全局结算才做得了的检查，比如占位、资源、目标坐标和射线。失败结果会在下一份状态
里返回。

**探索记忆（Exploration memory）**

客户端从旧状态攒下来的知识。记住的障碍一直有效；资源点和实体在重新进入视野前可能
已经过期。

**Manual**

网页玩家的来源槽。逐对象来看，显式的 Manual 动作压过 Agent 动作；某个对象没写，就
回退到 Agent。

**占位实体（Occupying entity）**

Core 或 Unit，会占掉一个格子两个容量槽中的一个。Beacon 和地形一个都不占。

**计划回执（Plan receipt）**

服务端存下来源计划之后给出的 HTTP 202 元数据，以及那条 WebSocket `received` 消息。

**结算结果（Resolution event）**

放在下一条 `state.events` 里的动作结果，而不是一条单独的实时消息。

**资源点（Resource point）**

一个可消耗的地图点。成功采集会移除它，并给 Worker 1 点资源；所属玩家持有 Beacon 时
给 2 点。每结算满 4 个 Tick，确定性补充只填回各区块缺少的槽位，直到固定配额。

**资源配额（Resource quota）**

一次补充完成后区块固定拥有的可用点数：
`max(2, floor(16 × 8 / (8 + ring)))`；中央 2×2 个区块属于第 0 环。

**静态验证（Static validation）**

全局结算之前做的检查：JSON 结构、行动 Unit 的所有权、动作字段、必填字段，以及当前
Tick 的命令 gate。

**超覆盖线（Supercover line）**

一条把自己经过的每一个格子都算进去的整数网格线——正是它让障碍遮挡不会在斜角处漏出
缝隙。

**Tick**

一个逻辑上的「决策 + 结算」周期。它只有在一次原子世界提交完成后才推进，也不会在停机
之后赶进度。

**地形批次（Terrain batch）**

一个没有 UUID 的 `OBSTACLE` 或 `RESOURCE` 对象，里面的 `positions` 是当前可见的同类
位置的有序数组。障碍是永久地形；资源位置表示当前可见且可用。

**世界快照（World snapshot）**

确定性结算的某个阶段所依据的不可变输入。战斗共用同一份快照，所有合法攻击因此才是
同时发生的。
