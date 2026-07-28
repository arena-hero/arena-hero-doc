---
sidebar_position: 1
title: 规则速查
description: 查询当前时序、成本、射程、容量和协议限制。
---

# 规则速查

## 时序

| 规则 | 数值 |
|---|---:|
| 全局命令窗口 | 15 秒 |
| Core 迁移 | 每格 4 个逻辑 Tick |
| Core 重生延迟 | 20 个逻辑 Tick |
| WebSocket Ping 间隔 | 20 秒 |
| WebSocket Pong 超时 | 60 秒 |
| 凭证重新校验 | 约 5 秒 |
| 推荐重连退避 | 250 ms → 5 秒，带随机抖动 |

## Core

| 属性 | 数值 |
|---|---:|
| HP | 5 |
| 护盾 | 5 |
| 携带 Beacon 时护盾上限 | 10 |
| 视野 | 5 |
| 初始资源 | 20 |
| 初始 Worker | 1 |
| 护盾修复 | 1 资源 → 1 护盾 |

## Units

| Unit | HP | 视野 | 成本 | 伤害 / 射程 |
|---|---:|---:|---:|---|
| Worker | 2 | 3 | 5 | 无 |
| Vanguard | 4 | 4 | 10 | 对相邻目标格造成 1 伤害 |
| Ranger | 2 | 5 | 12 | 正交方向 1-3 格造成 1 伤害 |

## 世界

| 规则 | 数值 |
|---|---:|
| 单格容量 | 2 个占位实体 |
| 地形类型 | `EMPTY`、`RESOURCE`、`OBSTACLE` |
| 区块大小 | 32×32 |
| 资源丰富度尺度 | 256 |
| 与最近存活 Core 的出生距离 | 20-30 |
| 坐标类型 | 有符号 int64 `[x, y]` |
| Beacon 初始位置 | `[0, 0]` |

## 经济

```text
population = Worker + Vanguard + Ranger
tier = floor(population / 20)
upkeep = tier × (tier + 1) / 2
```

| 人口 | 维护费 |
|---:|---:|
| 0-19 | 0 |
| 20-39 | 1 |
| 40-59 | 3 |
| 60-79 | 6 |
| 80-99 | 10 |
| 100-119 | 15 |

## 命令

| 限制 | 数值 |
|---|---:|
| 幂等键 | 8-128 个可见 ASCII 字节 |
| 每个 `(player, tick, source)` 的新提交 | 64 |
| 每种凭证来源的并发命令体 | 4 |
| WebSocket 入站帧限制 | 1024 字节 |
| WebSocket 消息 | `tick`、`state`、`received` |
| 命令来源 | `AGENT`、`MANUAL` |
