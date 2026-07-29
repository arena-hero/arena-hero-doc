---
sidebar_position: 1
title: 快速开始
description: 安装官方 Python SDK，并运行同步或异步 Agent。
---

# Python SDK

官方 SDK 会处理 WebSocket 连接、命令提交、类型化状态、回执、安全重试和断线重连。
游戏循环怎么写、每个 Unit 做什么，由你决定。

需要 Python 3.11 或更高版本。

## 安装

从 PyPI 安装：

```bash
python -m pip install arena-hero
```

安装包名是 `arena-hero`，代码里的导入名是 `arena_hero`。

## 同步循环

普通 Python 程序使用 `ArenaHeroClient`：

```python
from getpass import getpass

from arena_hero import ArenaHeroClient, Direction


api_key = getpass("Arena Hero API key: ")

with ArenaHeroClient(api_key=api_key) as game:
    for turn in game.turns():
        for worker in turn.workers:
            if worker.position in turn.resource_cells:
                worker.harvest()
            else:
                worker.move(Direction.RIGHT)

        turn.submit()
```

这里有两点要记住：

1. `move()`、`harvest()` 只会修改内存里正在构造的计划，不会发网络请求。
2. `turn.submit()` 才会一次性提交完整计划。同一个对象提交前又调用了别的动作方法，
   后一次会顶掉前一次。

`turn.resource_cells` 包含本 Turn 可见的自然资源点和死亡 Worker 留下的 Cargo
资源堆，但不公开资源堆数量。自然资源点成功采集一次后消失；多个合格 Worker 抢同一格
时，只有最低 UUID 成功，其余 Worker 会在下一份 Turn 收到
`HARVEST_FAILED`/`RESOURCE_DEPLETED`。

退出 `with` 时，HTTP 和 WebSocket 连接会自动关闭。

## 异步循环

如果你的程序本来就跑在 `asyncio` 上，使用 `AsyncArenaHeroClient`：

```python
import asyncio
from getpass import getpass

from arena_hero import AsyncArenaHeroClient, Direction


async def play(api_key: str) -> None:
    async with AsyncArenaHeroClient(api_key=api_key) as game:
        async for turn in game.turns():
            for vanguard in turn.vanguards:
                vanguard.sweep(Direction.LEFT)

            await turn.submit()


asyncio.run(play(getpass("Arena Hero API key: ")))
```

同步和异步客户端的状态、单位接口完全一样，只有迭代、提交和关闭的写法不同：

| 同步 | 异步 |
|---|---|
| `ArenaHeroClient` | `AsyncArenaHeroClient` |
| `for turn in game.turns()` | `async for turn in game.turns()` |
| `turn.submit()` | `await turn.submit()` |
| `game.close()` | `await game.close()` |

## API Key

API Key 直接传给客户端：

```python
game = ArenaHeroClient(api_key="your-api-key")
```

SDK 不会从环境变量读取 API Key 或接口地址。值从哪里加载、在传入构造函数之前如何保管，
由你的程序决定。不要把真实 Key 提交到版本库。

## 读取当前 Turn

每个 `Turn` 都是一份完整、权威的当前状态：

```python
turn.tick
turn.resources
turn.core
turn.units
turn.workers
turn.vanguards
turn.rangers
turn.visible_enemies
turn.resource_cells
turn.obstacle_cells
turn.beacon
turn.events
```

能用分类好的集合时就直接用。例如 `turn.workers` 只包含自己控制的 Worker，
`turn.visible_enemies` 包含当前看得到的敌方 Unit 和 Core。

不要把旧的 `resource_cells` 当成永久地图数据。资源会被消耗；区块每结算满 4 个 Tick
只补回缺少的槽位；视野外新增或消失的点，要等重新看到那格才知道。

`turn.events` 是上一个 Tick 的私有结算结果。之前的命令到底发生了什么，看这里。

每个自己或可见敌方的 `CoreView` 都带原始 `owner_username`。界面上可以这样显示：

```python
for enemy in turn.visible_enemies:
    if enemy.kind == "CORE":
        print(f"@{enemy.owner_username}")
```

协议值本身不带 `@`。Unit 不公开所属玩家。

Cargo 掉落和回收可以直接读取类型化属性：

```python
from arena_hero import HarvestSource

for event in turn.events:
    if event.event_type == "WORKER_CARGO_DROPPED":
        print("掉落", event.resource_amount, "位置", event.position)
    elif event.harvest_source is HarvestSource.DROPPED_CARGO:
        print("回收", event.resource_amount, "位置", event.position)
```

## 控制所有对象

```python
from arena_hero import Direction, UnitType


for worker in turn.workers:
    worker.move(Direction.UP)
    # 后调用的 HARVEST 会替换这个 Worker 的 MOVE。
    worker.harvest()

for ranger in turn.rangers:
    if turn.visible_enemies:
        ranger.shoot(turn.visible_enemies[0])

if turn.core is not None:
    turn.core.spawn(UnitType.WORKER)

turn.submit()
```

玩家处于重生状态时，`turn.core` 是 `None`。给 Core 下命令前先检查。

所有字段、方法、事件和异常都列在
[接口参考](./reference.md)里。

## 完整事件流

大多数 Agent 只需要 `game.turns()`。如果你还要处理 Tick 通知，或者读取其他在线客户端
提交的权威计划，就用 `game.events()`：

```python
from arena_hero import ArenaHeroClient, Received, Tick, Turn


with ArenaHeroClient(api_key=api_key) as game:
    for event in game.events():
        if isinstance(event, Tick):
            current_tick = event.tick
        elif isinstance(event, Turn):
            event.submit()
        elif isinstance(event, Received):
            print(event.source, event.plan)
```

同一个客户端只能选择 `events()` 或 `turns()` 其中一个，不能同时消费两条迭代流。

## 连接本地后端

默认连接生产环境。测试本地服务时，明确传入两个地址：

```python
game = ArenaHeroClient(
    api_key=api_key,
    base_url="http://localhost:8080",
    websocket_url="ws://localhost:8080/api/v1/game/ws",
)
```

## 接下来读什么

- [接口参考](./reference.md)：构造参数、模型、控制方法、事件和异常。
- [游戏规则](../rules/world-and-ticks.md)：移动、战斗、经济和视野如何结算。
- [可靠的命令循环](../agent/command-loop.md)：时间窗口、计划替换、回执和恢复。
- [直接接入 API](../agent/quickstart.md)：直接使用 HTTP 和 WebSocket。
