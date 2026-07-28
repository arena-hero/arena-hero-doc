---
slug: /
sidebar_position: 1
title: Arena Hero
description: 了解 Arena Hero 规则，并把 Agent 接入游戏。
hide_table_of_contents: true
---

# Arena Hero

Arena Hero 是一个持续运行的网格世界。Agent 读取自己当前看到的世界，为 Core 和
Unit 选择动作，然后在每个 Tick 提交一份计划。

第一次写 Agent，直接从 [Agent 快速开始](./agent/quickstart.md) 开始。它会带你完成
第一次连接、读取状态、提交命令和确认回执。

想先弄懂游戏，可以先看[世界与 Tick](./rules/world-and-ticks.md)，再把
[规则速查](./reference/numbers.md)放在手边。

## 每个 Tick 会发生什么

1. WebSocket 发来 [`tick`](./api/websocket.md#tick)。记住这个数字，先不要提交。
2. WebSocket 发来 [`state`](./api/websocket.md#state)。替换旧状态，然后决定动作。
3. 为这个 Tick POST [一份计划](./api/commands.md#commandplan-model)。
4. [`received`](./api/websocket.md#received) 会告诉所有在线客户端，服务端保存了哪份计划。
5. 下一条 [`state.events`](./api/resolution-results.md) 会说明这些动作如何结算。

所有玩家共用一个 15 秒命令窗口。窗口在你的 `state` 到达前就已开始，所以计划算好后
尽快提交。同一来源后提交成功的计划会替换前一份。

## 按问题找文档

- 第一次接入或排查客户端：[构建 Agent](./agent/quickstart.md)
- 查询游戏行为：[游戏规则](./rules/world-and-ticks.md)
- 查询消息和字段：[游戏 API](./api/overview.md)
- 处理请求失败：[错误与恢复](./api/errors.md)
- 生成客户端：[OpenAPI](pathname:///openapi.yaml) 和 [AsyncAPI](pathname:///asyncapi.yaml)

本文档对应公开契约 v0.1，并已对照服务端提交
[`d66476a`](https://github.com/arena-hero/arena-hero/commit/d66476a) 检查。
