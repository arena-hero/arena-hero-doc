---
sidebar_position: 2
title: 接口参考
description: 客户端、Turn、单位控制、模型、事件和异常的完整参考。
---

# Python SDK 接口参考

- 安装包：[`arena-hero`](https://github.com/arena-hero/arena-hero-python)
- 导入名：`arena_hero`
- Python：3.11 或更高版本

所有公开模型都有完整类型，底层是不可变的 Pydantic 模型。服务端状态会先通过校验，
然后才交给你的循环。

## 客户端

### `ArenaHeroClient`

同步客户端：

```python
ArenaHeroClient(
    *,
    api_key: str,
    base_url: str = "https://api.arenahero.io",
    websocket_url: str | None = None,
    request_timeout: float = 5.0,
    request_retries: int = 2,
    reconnect_min_delay: float = 0.25,
    reconnect_max_delay: float = 5.0,
    max_message_size: int = 2 * 1024 * 1024,
)
```

### `AsyncArenaHeroClient`

异步客户端接受完全相同的参数：

```python
AsyncArenaHeroClient(
    *,
    api_key: str,
    base_url: str = "https://api.arenahero.io",
    websocket_url: str | None = None,
    request_timeout: float = 5.0,
    request_retries: int = 2,
    reconnect_min_delay: float = 0.25,
    reconnect_max_delay: float = 5.0,
    max_message_size: int = 2 * 1024 * 1024,
)
```

| 参数 | 含义 |
|---|---|
| `api_key` | 必填。通过 `Authorization: Bearer …` 发送的凭据。 |
| `base_url` | HTTP API 基址，命令地址会从这里推导。 |
| `websocket_url` | WebSocket 地址。省略时从 `base_url` 推导。 |
| `request_timeout` | 单次 HTTP 命令请求的超时秒数。 |
| `request_retries` | 第一次请求失败后，最多再安全重试多少次。 |
| `reconnect_min_delay` | WebSocket 首次重连前等待的秒数。 |
| `reconnect_max_delay` | WebSocket 重连等待上限，单位为秒。 |
| `max_message_size` | 接受的 WebSocket 单条消息最大字节数。 |

SDK 不会从环境变量读取这些参数。

### `turns()`

同步：`ArenaHeroClient.turns() -> Iterator[Turn]`

异步：`AsyncArenaHeroClient.turns() -> AsyncIterator[AsyncTurn]`

每个可操作的 Tick 只返回一次。回执仍然会在内部处理，并写入
`latest_receipts`。

### `events()`

同步：`ArenaHeroClient.events() -> Iterator[Tick | Turn | Received]`

异步：`AsyncArenaHeroClient.events() -> AsyncIterator[Tick | AsyncTurn | Received]`

返回完整的应用层 WebSocket 事件流：

| 事件 | 何时出现 | 你该做什么 |
|---|---|---|
| `Tick` | 新 Tick 已经宣布。 | 记下编号；这时还没有状态可以操作。 |
| `Turn` / `AsyncTurn` | 完整玩家状态已经准备好。 | 读取状态、排好动作，然后提交。 |
| `Received` | `AGENT` 或 `MANUAL` 的计划已保存。 | 替换这个来源、这个 Tick 之前的回执。 |

一个客户端同一时间只能有一个 `events()` 或 `turns()` 迭代器。

### `latest_receipts`

```python
from arena_hero import CommandSource


agent_receipt = game.latest_receipts.get(CommandSource.AGENT)
manual_receipt = game.latest_receipts.get(CommandSource.MANUAL)
```

这个只读映射保存当前 Tick 每个来源最新的 `Received`。新 Tick 开始时会清空。

### `submit()`

提交一份已经构造好的完整计划：

```python
accepted = game.submit(plan, idempotency_key="agent-10583-plan-1")
```

异步写法：

```python
accepted = await game.submit(plan, idempotency_key="agent-10583-plan-1")
```

返回类型是 `Accepted`。不传 `idempotency_key` 时，SDK 会自动生成。如果网络失败导致
结果不确定，SDK 会带着同一个 Key 重试完全相同的请求字节。

自定义 Key 必须是 8–128 个可见 ASCII 字节，不能包含空格。

### `close()`

关闭当前 WebSocket 和 HTTP 连接池。优先使用 `with` 或 `async with`，这样退出时会
自动关闭。

## Turn

`Turn` 和 `AsyncTurn` 的状态与控制接口完全一致。唯一的区别是
`AsyncTurn.submit()` 需要 `await`。

### 状态

| 属性 | 类型 | 含义 |
|---|---|---|
| `tick` | `int` | 这份状态和计划所属的 Tick。 |
| `state` | `PlayerState` | 完整、权威的玩家状态模型。 |
| `resources` | `int` | 当前存放在 Core 里的资源。 |
| `core` | `Core | None` | 自己控制的 Core；重生期间是 `None`。 |
| `units` | `tuple[Unit, ...]` | 自己控制的所有 Unit。 |
| `workers` | `tuple[Worker, ...]` | 自己控制的 Worker。 |
| `vanguards` | `tuple[Vanguard, ...]` | 自己控制的 Vanguard。 |
| `rangers` | `tuple[Ranger, ...]` | 自己控制的 Ranger。 |
| `visible_enemies` | `tuple[UnitView | CoreView, ...]` | 当前可见的敌方对象。 |
| `terrain` | `tuple[TerrainView, ...]` | 可见障碍与当前可用资源的批次。 |
| `resource_cells` | `frozenset[Position]` | 仅本 Turn 可见且可用的资源点。 |
| `obstacle_cells` | `frozenset[Position]` | 当前可见的障碍格。 |
| `beacon` | `ChampionBeacon` | 经过视野裁剪的信标状态。 |
| `events` | `tuple[ResolutionEvent, ...]` | 上一个 Tick 的私有结算结果。 |
| `plan` | `CommandPlan` | 当前在内存里排好的完整计划。 |

`Position` 是 `(x, y)` 顺序的 `tuple[int, int]`。

### 方法

| 方法 | 含义 |
|---|---|
| `unit(unit_id)` | 按 UUID 或 UUID 字符串查找一个受控 Unit。 |
| `clear()` | 清掉所有 Unit 和 Core 的待提交动作。 |
| `submit(idempotency_key=None)` | 提交当前排好的完整计划。 |

新的 Tick 到来后，再调用旧 Turn 上的动作会抛出 `TurnClosedError`。不要跨 Tick 保存并
复用 Unit 或 Core 控制对象。

## Unit 控制接口

所有受控 Unit 都有这些成员：

| 成员 | 类型或签名 |
|---|---|
| `view` | `UnitView` |
| `id` | `UUID` |
| `position` | `Position` |
| `hp` | `int` |
| `unit_type` | `UnitType` |
| `move(direction)` | 移动一格。 |
| `pickup_beacon()` | 拾取当前格的信标。 |
| `drop_beacon()` | 放下携带的信标。 |
| `self_destruct()` | 在维护费前移除这个 Unit；不返还资源，也不造成范围伤害。 |
| `wait()` | 明确提交 `WAIT`。 |
| `clear_action()` | 把这个 Unit 从待提交计划里移除。 |

每个 Unit 最多只有一个待提交动作。后调用的方法会替换之前的动作。

### Worker

额外状态：

| 成员 | 类型 | 含义 |
|---|---|---|
| `cargo` | `int` | 当前携带的资源量。 |

额外控制：

| 方法 | 含义 |
|---|---|
| `harvest()` | 尝试消耗当前格的资源点。 |
| `deposit()` | 与 Core 同格时，把携带资源存入 Core。 |

一次成功采集消耗一个自然资源点。普通赢家携带 1 资源；所属玩家持有 Beacon 的赢家
从同一个点携带 2。死亡 Worker 留下的 Cargo 资源堆会被优先回收，而且不会取得超过
实际剩余量的资源。多个合格 Worker 采同一格时，只有最低 UUID 成功，其他人收到
`HARVEST_FAILED`，reason 是 `RESOURCE_DEPLETED`。

### Vanguard

| 方法 | 含义 |
|---|---|
| `sweep(direction)` | 攻击指定方向的相邻格。 |

### Ranger

```python
ranger.shoot(target)
ranger.shoot(target_id, expected_cell=(120, 85))
```

`target` 可以是可见的 `Unit`、`Core`、`UnitView` 或 `CoreView`。SDK 会把目标 UUID
和当前位置一起写入命令。只传 UUID 或 UUID 字符串时，必须同时传
`expected_cell`。

服务端仍会按照游戏规则结算射击。命令能成功构造，不代表一定命中。

## Core 控制接口

`Core` 控制对象有这些成员：

| 成员 | 类型或签名 |
|---|---|
| `view` | `CoreView` |
| `id` | `UUID` |
| `owner_username` | `str` |
| `position` | `Position` |
| `hp` | `int` |
| `shield` | `int` |
| `spawn(unit_type)` | 生产 `WORKER`、`VANGUARD` 或 `RANGER`。 |
| `repair_shield()` | 消耗资源修复护盾。 |
| `start_move(direction)` | 开始移动 Core。 |
| `cancel_move()` | 取消 Core 当前的移动。 |
| `pickup_beacon()` | 拾取当前格的信标。 |
| `drop_beacon()` | 放下携带的信标。 |
| `wait()` | 明确提交 `WAIT`。 |
| `clear_action()` | 清掉 Core 的待提交动作。 |

Core 也只有一个动作槽。后调用的方法会替换之前排好的动作。

## 状态模型

### `PlayerState`

| 字段 | 类型 |
|---|---|
| `status` | `PlayerStatus` |
| `respawn_at_tick` | `int | None` |
| `resources` | `int` |
| `population` | `int` |
| `population_tier` | `int` |
| `upkeep_next_tick` | `int` |
| `champion_beacon` | `ChampionBeacon` |
| `objects` | `tuple[TerrainView | CoreView | UnitView, ...]` |
| `events` | `tuple[ResolutionEvent, ...]` |

每个字段的含义和视野规则见[状态模型](../api/state-model.md)。

### 对象模型

| 模型 | 主要字段 |
|---|---|
| `UnitView` | `kind`、`id`、`controlled`、`position`、`hp`、`unit_type`、`cargo` |
| `CoreView` | `kind`、`id`、`owner_username`、`controlled`、`position`、`hp`、`shield`、`state`、移动字段 |
| `TerrainView` | `kind`、`positions`；`RESOURCE` 表示当前可见的可用位置 |
| `ChampionBeacon` | `position`、`status`、`carrier_id` |

控制类（`Worker`、`Vanguard`、`Ranger`、`Core`）是受控对象的便捷接口。敌方对象仍然是
不可变的 `UnitView` 或 `CoreView`。

每个 `CoreView` 都有 `owner_username`，值不含 `@`。显示时写成
`f"@{core.owner_username}"`。Unit 没有这个字段，也不会暴露所属玩家。

### `ResolutionEvent`

| 字段 | 类型 |
|---|---|
| `event_id` | `UUID` |
| `tick` | `int` |
| `event_type` | `str` |
| `reason_code` | `str | None` |
| `actor_id` | `UUID | None` |
| `target_id` | `UUID | None` |
| `position` | `Position | None` |
| `values` | `dict[str, Any] | None` |
| `resource_amount` | `int | None` |
| `harvest_source` | `HarvestSource | None` |

事件名和原因码保留为字符串，这样服务端以后新增值时，旧版 SDK 不会直接崩掉。具体
含义见[结算结果](../api/resolution-results.md)。

其中 `HARVEST_FAILED`/`RESOURCE_DEPLETED` 表示同 Tick 有 UUID 更低的合格 Worker
消耗了被竞争的资源点。Cargo 事件可以直接通过 `resource_amount` 读取掉落或回收数量。
`harvest_source is HarvestSource.DROPPED_CARGO` 表示正在回收掉落资源；
`HarvestSource.RESOURCE_NODE` 表示普通自然资源采集。不适用或无法识别的值会返回
`None`。

### `Tick`、`Received` 和 `Accepted`

| 模型 | 字段 |
|---|---|
| `Tick` | `tick` |
| `Received` | `tick`、`source`、`received_at`、`plan` |
| `Accepted` | `accepted`、`tick`、`source`、`received_at` |

`Accepted` 是 HTTP `202` 确认。`Received` 是 WebSocket 广播给这名玩家所有在线客户端
的权威计划。

## 命令模型

大多数代码应该通过 `Turn` 排动作。需要直接控制协议模型时，也可以自己构造：

```python
from uuid import UUID

from arena_hero import CommandPlan, Direction, MoveAction


plan = CommandPlan(
    tick=10583,
    unit_actions={
        UUID("9d3e4941-2816-4a39-a220-df8cd95e877d"): MoveAction(
            direction=Direction.UP
        )
    },
)

accepted = game.submit(plan)
```

公开的 Unit 动作模型：

| Unit 动作 | 必填数据 |
|---|---|
| `WaitAction` | 无 |
| `MoveAction` | `direction` |
| `HarvestAction` | 无 |
| `DepositAction` | 无 |
| `SweepAction` | `direction` |
| `ShootAction` | `target_id`、`expected_cell` |
| `PickupBeaconAction` | 无 |
| `DropBeaconAction` | 无 |
| `SelfDestructAction` | 无 |

| Core 动作 | 必填数据 |
|---|---|
| `WaitAction` | 无 |
| `SpawnAction` | `unit_type` |
| `RepairShieldAction` | 无 |
| `StartMoveAction` | `direction` |
| `CancelMoveAction` | 无 |
| `PickupBeaconAction` | 无 |
| `DropBeaconAction` | 无 |

`CommandPlan.unit_actions` 是 Unit UUID 到动作的映射。
`CommandPlan.core_action` 是一个 Core 动作，也可以是 `None`。

## 枚举

| 枚举 | 可选值 |
|---|---|
| `Direction` | `UP`、`DOWN`、`LEFT`、`RIGHT` |
| `UnitType` | `WORKER`、`VANGUARD`、`RANGER` |
| `PlayerStatus` | `ACTIVE`、`RESPAWNING` |
| `CoreState` | `NORMAL`、`MOVING` |
| `CommandSource` | `AGENT`、`MANUAL` |
| `BeaconStatus` | `GROUND`、`CARRIED` |
| `HarvestSource` | `RESOURCE_NODE`、`DROPPED_CARGO` |

`Direction.delta` 会返回对应的 `(dx, dy)`。

## 异常

所有 SDK 异常都继承自 `ArenaHeroError`。

| 异常 | 含义 |
|---|---|
| `ConfigurationError` | 构造参数或幂等键无效、客户端已关闭，或者同时启动了两个迭代器。 |
| `AuthenticationError` | WebSocket 握手拒绝了 API Key。 |
| `PolicyViolationError` | WebSocket 以策略违规码 `1008` 关闭。 |
| `ProtocolError` | 服务端消息不符合公开协议。 |
| `APIError` | 命令 API 返回了结构化拒绝。 |
| `TransportError` | 安全重试用完后，网络操作仍然失败。 |
| `TurnClosedError` | 代码试图修改已经过期的 Turn。 |
| `InvalidActionError` | 本地目标或动作无法安全表示成协议命令。 |

`APIError` 提供 `status_code`、`error`、`message` 和 `details`。

游戏里的动态失败不是 Python 异常。它们会作为 `ResolutionEvent` 出现在下一次
`Turn.events` 里。

## 连接行为

SDK 会：

- 只在 `Authorization` 请求头中发送 API Key；
- 关闭 WebSocket 消息压缩，保持与服务端约定一致；
- 自动处理协议层 Ping/Pong；
- 对临时 WebSocket 故障使用带随机抖动的指数退避重连；
- 遇到关闭码 `1008` 后停止重连；
- 把每个 `state` 都当成完整替换；
- 对结果不确定的命令提交，使用相同字节和同一个幂等键安全重试。

服务端命令窗口是全局的，Turn 到达时可能已经过去一部分。计划算好就尽快提交。完整的
时间与恢复规则见[可靠的命令循环](../agent/command-loop.md)。
