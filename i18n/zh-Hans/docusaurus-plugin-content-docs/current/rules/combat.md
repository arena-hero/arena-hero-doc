---
sidebar_position: 8
title: 战斗
description: 横扫、射击、同时伤害和摧毁如何结算。
---

# 战斗

## 单一不可变快照

移动、Beacon、Worker、生产和修盾完成后，引擎冻结一个不可变战斗快照：

1. 所有锁定攻击都基于同一快照校验。
2. 累计全部合法伤害。
3. 同时应用全部伤害。
4. 伤害完成后才移除死亡 Unit 和被摧毁 Core。

战斗阶段被杀死的对象仍会完成已锁定的合法攻击，可以同归于尽。HTTP 到达顺序、完成顺序、数据库顺序和 Manual/Agent 来源都不提供先手。

v0.1 没有随机伤害、闪避、暴击、护甲、自动反击、体力、等级或装备。

## Vanguard 横扫

```json
{"type": "SWEEP", "direction": "UP"}
```

相邻目标格内每个敌方 Unit 各受 1 伤害，敌方 Core 也受 1，友军不受伤。多个横扫伤害可以累加。

## Ranger 射击

```json
{
  "type": "SHOOT",
  "target_id": "175f47f4-f7de-4785-b45c-9a2d2289a8ea",
  "expected_cell": [120, 85]
}
```

Ranger 攻击横向或纵向距离 1-3 的一个精确对象。中间任何障碍、Unit 或 Core 都会阻挡；目标格内同格对象不存在前后顺序。

接口只做静态结构检查。目标不存在、属于友军、离开预计格、斜线、超距或射线被挡，在结算时全部统一为 `SHOT_MISSED`，避免泄露雾区信息。

## Core 伤害

所有伤害先扣护盾再扣 HP。全部战斗伤害合并后 Core HP 归零，才移除其舰队；它在战斗快照中存活 Unit 已产生的攻击仍然有效。

同 Tick 多名玩家共同伤害被摧毁目标时，不根据输入顺序虚构唯一"最后一击"。

## 返回结果

战斗结果位于下一 `state.events`：

```json
{
  "event_id": "e1841781-2a89-44e4-a5ce-d4bbc46d33a1",
  "tick": 10583,
  "event_type": "SHOT_HIT",
  "actor_id": "9d3e4941-2816-4a39-a220-df8cd95e877d",
  "target_id": "175f47f4-f7de-4785-b45c-9a2d2289a8ea",
  "position": [120, 85]
}
```

普通敌方状态仍不暴露 username 或 owner ID。
