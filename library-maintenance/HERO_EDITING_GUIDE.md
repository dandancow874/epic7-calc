# 角色与技能人工维护指南

本目录用于保存不会被重新抓取覆盖的人工修正。角色图鉴的最终数据由构建脚本生成，不要直接修改 `public/library/heroes.json`。

## 推荐：直接在软件中修改

日常只修改一个数值时，不需要手写 JSON：

1. 打开“角色图鉴”并进入目标角色。
2. 点击右上角“编辑角色数据”。
3. 直接修改基础面板、技能说明、获得灵魂、灵魂燃烧、技能倍率或技能特效。
4. 点击“保存并更新图鉴”。

软件只会将发生变化的字段写入 `library-maintenance/heroes/<角色代码>.json`，随后自动重新生成图鉴。关闭编辑器后即可看到新数据。

以下手工编辑说明用于批量修改、修复无法在编辑器中表示的特殊字段，或排查数据问题。

## 文件位置

| 用途 | 文件或目录 | 是否建议编辑 |
| --- | --- | --- |
| 抓取后的单角色原始数据 | `<原始数据目录>/heroes/<角色代码>.json` | 可用于查看字段；重新抓取时可能被覆盖 |
| 永久人工修正 | `library-maintenance/heroes/<角色代码>.json` | 推荐 |
| 旧版整条覆盖 | `library-maintenance/heroes.overrides.json` | 仅兼容，不建议新增 |
| 技能效果图标映射 | `library-maintenance/effect-icons.json` | 推荐 |
| 图鉴最终生成数据 | `public/library/heroes.json` | 禁止直接编辑，会被重新生成覆盖 |
| 前端角色类型定义 | `src/library/types.ts` | 用于查询最终字段结构 |

角色代码通常是英文名的小写连字符形式。例如：

```text
里安娜路西艾拉 -> rhianna-and-luciella
萨若米亚       -> saria
```

可在 `public/library/heroes.json` 中搜索中文名并查看同一条记录的 `code`。

## 技能原始字段

单角色原始文件中的 `skills` 数组包含以下常用字段：

| 字段 | 作用 |
| --- | --- |
| `skill_id` | 技能唯一 ID，例如 `sk_c2185_1` |
| `name` | 技能名称 |
| `description` | 技能说明 |
| `turn_cool_desc` | 冷却时间说明 |
| `soul_gain` | 使用技能获得的灵魂数 |
| `soul_burn_skill` | 灵魂燃烧消耗和效果 |
| `lv_eff` | 技能强化等级效果 |
| `multipliers` | 技能倍率 |
| `skill_eff_explains` | Buff、Debuff 和特殊机制说明 |

原始数据中的 `soul_burn_skill` 可能是 JSON 字符串：

```json
"soul_burn_skill": "{\"desc\": \"无视效果抗性。\", \"soul_req\": 20}"
```

构建后会转成以下统一格式：

```json
"soulBurn": {
  "cost": 20,
  "description": "无视效果抗性。"
}
```

## 使用精简角色补丁

每个角色使用一个文件，文件名必须是角色 `code`。例如：

```text
library-maintenance/heroes/rhianna-and-luciella.json
```

文件内容直接写这个角色需要修改的字段，不需要再包一层角色代码：

```json
{
  "descriptionLine": "人工修正后的角色简介"
}
```

`baseStats` 等对象支持只写需要修改的字段：

```json
{
  "baseStats": {
    "atk": 1200,
    "spd": 115
  }
}
```

基础面板字段：

```text
atk 攻击力      hp 生命值       def 防御力       spd 速度
chc 暴击率      chd 暴击伤害     eff 效果命中      efr 效果抗性
```

百分比在数据中使用小数，例如 `0.15` 表示 `15%`。

## 修改技能

技能使用对象格式，以技能 `id` 为键。只写目标技能和需要修改的字段，不会影响其他技能：

```json
{
  "skills": {
    "sk_c0000_1": {
      "name": "技能名称",
      "description": "修改后的技能说明。",
      "soulBurn": {
        "cost": 20,
        "description": "无视效果抗性。"
      }
    }
  }
}
```

没有灵魂燃烧的技能写：

```json
"soulBurn": null
```

## 修改技能倍率

倍率按倍率 `id` 合并，倍率项目按 `key` 合并：

```json
"multipliers": {
  "skill_multiplier": {
    "items": {
      "att_rate": {
        "label": "基础倍率(Attack Rate)",
        "value": "0.9",
        "displayValue": "0.9"
      },
      "pow": {
        "label": "修正倍率(Pow)",
        "value": "1",
        "displayValue": "1"
      }
    }
  }
}
```

常见倍率键：

| 键 | 含义 |
| --- | --- |
| `att_rate` | 攻击力倍率 |
| `pow` | 技能修正倍率 |
| `def_rate` | 防御力倍率 |
| `hp_rate` | 最大生命值倍率 |
| `speed_rate` | 速度倍率 |

不要只修改 `displayValue`。计算需要使用时，应同步修改 `value`。

## 修改技能特效及说明

技能特效按效果 `id` 合并：

```json
"effects": {
  "203": {
    "name": "防御力降低",
    "type": "debuff",
    "description": "防御力降低70%。",
    "icon": "/assets/debuffs/defense-debuff.png"
  },
  "130": {
    "name": "隐身",
    "type": "buff",
    "description": "若存在其他我军人员，则不会成为攻击目标。",
    "icon": "/assets/buffs/stealth-buff.png"
  }
}
```

`type` 常用值：

```text
buff    强化效果
debuff  弱化效果
common  通用机制或特殊技能特性
```

优先在 `effect-icons.json` 中维护公共图标映射，避免每个角色重复写图标：

```json
{
  "防御力降低": "/assets/debuffs/defense-debuff.png",
  "隐身": "/assets/buffs/stealth-buff.png"
}
```

图标主要位于：

```text
public/assets/buffs
public/assets/debuffs
```

页面上的技能特效可以点击，弹窗读取的就是 `name`、`description` 和 `icon`。

## 修改刻印

刻印在补丁中直接写需要修改的字段，它会合并到第一条刻印记录：

```json
{
  "devotion": {
    "self_type": "cri",
    "self_effect_max": 0.18
  }
}
```

常用字段：

```text
self_type       自阵属性类型
self_effect_max SSS 自阵最大值
public_type     群阵属性类型
public_effect_max SSS 群阵最大值
```

常用属性类型：

```text
att_rate 攻击力%       max_hp_rate 生命值%      def_rate 防御力%
cri 暴击率            cri_dmg 暴击伤害         acc 效果命中
res 效果抗性          speed 速度
```

## 修改专属装备

专属装备按专属装备 `id` 合并，包含：

- `mainStat`：专属装备主属性范围。
- `skillOptions`：对应技能的强化说明。
- `skillNumber`：技能序号，1、2、3 分别表示 S1、S2、S3。

示例可参考当前的萨若米亚维护记录：

```json
{
  "exclusives": {
    "saria-exclusive-enhancement": {
      "name": "专属强化",
      "mainStat": {
        "type": "att_rate",
        "min": 0.07,
        "max": 0.14
      },
      "skillOptions": [
        {
          "skillNumber": 2,
          "description": "因自然指引而提升的速攻值提升量额外提升10%。"
        }
      ]
    }
  }
}
```

## 重新生成与验证

修改原始角色数据后，可以直接双击项目根目录下的：

```text
更新角色图鉴数据.bat
```

它会自动执行图鉴数据生成和软件页面构建检查。成功后，在正在运行的 E7 Tools 中按 `Ctrl+R`，或者关闭软件后重新打开。

在 E7 Tools 项目根目录运行：

```powershell
npm run library:build
npm run build
npm test
npm run test:e2e
```

各命令作用：

1. `library:build`：将抓取数据与人工覆盖合并，重新生成图鉴 JSON。
2. `build`：检查 TypeScript 并生成前端文件。
3. `test`：运行数据与功能单元测试。
4. `test:e2e`：打开测试页面，检查角色图鉴、装备页、神器图鉴和计算器流程。

如果只是修改文字或倍率，至少执行前两个命令。准备提交或分发软件时，建议四个命令全部执行。

## 注意事项

- JSON 最后一项后面不能保留逗号。
- 角色、技能和效果 ID 应保持稳定，不要用中文名称代替唯一 ID。
- 百分比内部通常使用小数，展示文字可以使用百分数。
- 不要直接编辑 `public/library/heroes.json`。
- 精简补丁中的技能、倍率、倍率项目、技能特效和专属装备均使用 ID 对象，不需要复制完整数组。
- 需要删除某个技能、倍率或效果时，在对应 ID 下写 `"_delete": true`。
- 修改后若页面没有变化，先执行 `npm run library:build`，再刷新软件页面。
