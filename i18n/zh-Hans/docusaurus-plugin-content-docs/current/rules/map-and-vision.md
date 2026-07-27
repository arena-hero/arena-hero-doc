---
sidebar_position: 2
title: 地图与视野
description: 地形、资源梯度、视线、战争迷雾与信息边界。
---

# 地图与视野

## 地形

每格恰好有一种地形：

| 类型 | Unit 可进入 | Core 可迁入 | 阻挡视野 | 阻挡 Ranger |
|---|---:|---:|---:|---:|
| `EMPTY` | 是 | 是 | 否 | 否 |
| `RESOURCE` | 是 | 否 | 否 | 否 |
| `OBSTACLE` | 否 | 否 | 是 | 是 |

Core 和 Unit 占据格子，但不是地形。资源格是永久无限的资源点，采集不会耗尽或改变它。

## 中央资源梯度

中心为 `[0, 0]`，使用曼哈顿距离：

```text
d = abs(x) + abs(y)
richness(d) = 1 + 256 / (256 + d)
```

中心资源格密度是基础密度的两倍，并向外平滑下降到永久基础下限。梯度只改变资源密度，不改变障碍密度。

## 视野值

| 对象 | 曼哈顿半径 |
|---|---:|
| Core | 5 |
| Worker | 3 |
| Vanguard | 4 |
| Ranger | 5 |

当前私有视野是所有存活己方对象视野的并集。障碍遮挡使用整数 supercover 直线：障碍格本身可见，其后方不可见；射线穿过公共角时两侧格都算经过，任一侧为障碍都会阻挡。

Unit、Core 和资源格不阻挡**视野**，但 Unit 和 Core 会阻挡 Ranger 的**射击**。

## 服务端发送什么

每个 `state` 包含：

- 全部己方 Core 和 Unit，即使它们不在其他己方对象视野内；
- 当前可见的敌方 Core 和 Unit；
- 可见地形，合并成一个 `OBSTACLE` 和一个 `RESOURCE` 对象；
- 始终公开的 Champion Beacon 坐标；
- 仅在 Beacon 格可见时公开的状态和 carrier ID。

敌方对象带 `controlled: false`，不包含 owner。Worker cargo 只出现在己方 Worker 上。

## 探索记忆

服务端不保存或重发玩家完整探索历史。网页保存在本地；Agent 若需要记忆，必须自行持久化旧地形和最后观察。新设备只有当前视野。

:::warning 旧知识可能过期

地形永久不变，但最后看到的 Unit、Core 或 Beacon 状态可能已经变化。

:::

## Beacon 信息边界

视野外始终只有：

```json
{"position": [0, 0]}
```

看见地面 Beacon：

```json
{"position": [0, 0], "status": "GROUND"}
```

看见载体：

```json
{
  "position": [0, 0],
  "status": "CARRIED",
  "carrier_id": "175f47f4-f7de-4785-b45c-9a2d2289a8ea"
}
```

`carrier_id` 不泄露 owner。
