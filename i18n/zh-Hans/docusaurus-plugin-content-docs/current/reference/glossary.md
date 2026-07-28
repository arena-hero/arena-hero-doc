---
sidebar_position: 2
title: 术语表
description: Arena Hero 规则和 API 页面中常用的术语。
---

# 术语表

**Agent**

来源为 `AGENT` 的本地自动客户端。通过 WebSocket 接收状态，通过 HTTP 提交计划。

**服务端状态（Server state）**

服务端发来的当前 `state`。记住的地形、规划路线、预测和 UI 动画属于客户端，可能已经过期。

**Champion Beacon**

全世界唯一且不可摧毁的目标。其坐标始终公开；携带者在可见时会获得护盾上限与
Worker 采集加成。

**命令门（Command gate）**

服务器边界，只在当前 OPEN 窗口内接受正确到达的计划。

**完整计划（Complete plan）**

某一来源在一个 Tick 中期望的完整动作表。后续 POST 会替换而不是修补此前来源计划。

**受控对象（Controlled）**

`controlled: true` 表示对象属于接收状态的玩家；`controlled: false` 表示当前可见敌方。

**Core**

玩家的基地、资源仓库、带护盾的主要生命对象、Unit 生产设施和缓慢移动实体。

**动态验证（Dynamic validation）**

全局结算时进行的检查，例如占位、资源、目标坐标和射线。失败结果会在下一份状态中返回。

**探索记忆（Exploration memory）**

客户端根据旧状态维护的知识。已知地形保持正确，但实体知识可能已经过期。

**Manual**

网页玩家的来源槽。每个对象上，显式 Manual 动作优先于 Agent；省略则回退至 Agent。

**占位实体（Occupying entity）**

Core 或 Unit，会占用一个格子的两个容量槽之一。Beacon 和地形不占槽。

**计划回执（Plan receipt）**

服务端保存来源计划后返回的 HTTP 202 元数据，以及 WebSocket `received` 消息。

**结算结果（Resolution event）**

嵌入下一份 `state.events` 的即时动作结果，不是独立的实时消息。

**静态验证（Static validation）**

全局结算前完成的检查：JSON 结构、执行 Unit 的所有权、动作字段、必填字段和当前
Tick 命令 gate。

**超覆盖线（Supercover line）**

包含整数网格线触及的每个格子，避免障碍视线在斜角留下缝隙。

**Tick**

一个逻辑决策/结算周期。只有原子世界提交完成后才推进，停机期间不会追赶现实时间。

**地形批次（Terrain batch）**

无 UUID 的 `OBSTACLE` 或 `RESOURCE` 对象，其中 `positions` 是当前可见同类格子的
有序数组。

**世界快照（World snapshot）**

确定性结算某一阶段使用的不可变输入。战斗共用一个快照，因此所有合法攻击同时发生。
