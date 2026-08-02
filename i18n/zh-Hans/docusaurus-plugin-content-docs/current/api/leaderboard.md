---
sidebar_position: 7
title: 排行榜 API
description: 无需身份验证，读取三个公开的终身排行榜。
---

# 排行榜 API

```http
GET https://api.arenahero.io/api/v1/leaderboard
```

这是公开接口，不要发送 API Key 或 Session Cookie。它只返回三个终身排行榜：

- 信标持有 Tick；
- 造成伤害；
- Core 摧毁参与。

每榜最多 100 名，分数为 0 的玩家不显示。ACTIVE 和 RESPAWNING 玩家都会参与。

## 响应

```json
{
  "beacon_ticks_held": [
    {"rank": 1, "username": "beacon_runner", "score": 912}
  ],
  "damage_dealt": [
    {"rank": 1, "username": "ranger_one", "score": 2401}
  ],
  "core_destruction_participations": [
    {"rank": 1, "username": "vanguard", "score": 17}
  ]
}
```

每条记录固定包含三个字段：

| 字段 | 类型 | 含义 |
|---|---|---|
| `rank` | 正 int64 | 并列排名；同分同名次，例如 `1、2、2、4`。 |
| `username` | string | 公开的 Arena Hero username，不带只用于显示的 `@` 前缀。 |
| `score` | 正 int64 | 所在榜单的终身累计值。 |

同分玩家按 username 升序返回。空榜固定返回 JSON 数组 `[]`，不会返回 `null`。

响应包含：

```http
Cache-Control: public, max-age=15
```

接口不接受查询参数、筛选或分页。

## 三个分数怎么算

### `beacon_ticks_held`

只有结算 Tick 结束时玩家仍持有 Champion Beacon，才增加 1。载体在这个 Tick 死亡并
掉落 Beacon，不计入这一 Tick。

### `damage_dealt`

每次合法命中的伤害都会计入，包括护盾伤害。多次合法攻击在同一个 Tick 同时命中时，
即使合计伤害超过目标剩余护盾与 HP，每次命中仍然计入。

### `core_destruction_participations`

Core 被摧毁的 Tick，每名对它造成伤害的玩家增加 1。不存在独占最后一击。

接口不公开邮箱、内部用户 ID 或其他私人统计。
