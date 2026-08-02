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
| 资源补充 | 每 4 个已结算 Tick（约 1 分钟） |
| Core 迁移 | 每格 4 个逻辑 Tick |
| Core 重生尝试 | 被摧毁的同一个 Tick |
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
| 初始资源 | 5 |
| 初始 Worker | 1 |
| 资源容量 | `max(10, population × 5)` |
| HP 恢复 | 1 资源 → 1 HP，战斗后结算 |
| 护盾修复 | 1 资源 → 1 护盾 |

## Units

| Unit | HP | 视野 | 成本 | 伤害 / 射程 |
|---|---:|---:|---:|---|
| Worker | 2 | 3 | 5 | 无 |
| Vanguard | 4 | 4 | 10 | 对相邻目标格造成 1 伤害 |
| Ranger | 2 | 5 | 12 | 八方向直线 1-3 格造成 1 伤害 |

## 世界

| 规则 | 数值 |
|---|---:|
| 单格容量 | 2 个占位实体 |
| 地形类型 | `EMPTY`、`RESOURCE`、`OBSTACLE` |
| 区块大小 | 32×32 |
| 中央区块环 | `cx, cy ∈ {-1, 0}` 的 2×2 个区块 |
| 资源配额 | 每区块 `max(2, floor(16 × 8 / (8 + ring)))` |
| 与最近存活 Core 的出生距离 | 20-30 |
| 坐标类型 | 有符号 int64 `[x, y]` |
| Beacon 初始位置 | `[0, 0]` |

## 经济

```text
axis(c) = c if c >= 0 else -c - 1
ring = axis(cx) + axis(cy)
resource_quota = max(2, floor(16 * 8 / (8 + ring)))
```

一个点让普通 Worker 得到 1 资源，让 Beacon 玩家的 Worker 得到 2 资源；两种情况都只
消耗一个点。同点竞争由最低的合格 Worker UUID 获胜。

Worker 死亡时会把全部 Cargo 掉在最后所在格。普通回收一次取 1 点，有 Beacon 时最多
取 2 点，但不会超过资源堆剩余量。Cargo 资源堆不计入区块自然资源配额。

```text
population = Worker + Vanguard + Ranger
resource_capacity = max(10, population × 5)
tier = floor(population / 20)
upkeep = tier × (tier + 1) / 2
```

交付只存入能装下的部分。人口下降时，高于新容量的库存会立刻销毁。

维护费交不全时，每欠 1 点就对超额 Unit 造成 1 HP 伤害。离 Core 最近的 19 个 Unit
受保护；其余按距离从远到近受伤，同距离按 UUID 原始字节序。Core 不承受欠费伤害。

战斗中被摧毁 Core 的库存交给本 Tick 对它总伤害最高的玩家，但不能超过这个容量。伤害
相同时按玩家 UUID 原始字节序；超额资源销毁，获胜方 Core 同 Tick 也死亡时则全部销毁。

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
