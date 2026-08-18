# E7 Tools 人工维护数据

角色、技能、灵魂燃烧、技能倍率、技能特效、刻印和专属装备的详细修改方法见 [HERO_EDITING_GUIDE.md](./HERO_EDITING_GUIDE.md)。

`public/library/*.json` 是生成文件，不要直接修改；再次抓取或执行 `npm run library:build` 时会被覆盖。

人工更新统一放在这里：

- `heroes/<角色代码>.json`：推荐的角色精简补丁。每个角色一个文件，技能、倍率、特效按 ID 局部合并，只写需要修改的字段。
- `heroes.overrides.json`：旧版整条记录覆盖文件，仅为兼容已有数据保留；新修改不要再写到这里。
- `artifacts.overrides.json`：按神器 `code` 覆盖满级属性、图片、说明等字段。
- `presets.overrides.json`：按角色 `code` 修正或补充一条推荐预设；值写成 `null` 可隐藏抓取预设。
- `effect-icons.json`：技能效果中文名或源图标 ID 到本地图标路径的映射。

精简角色补丁采用“只写需要修改的字段”原则。`baseStats` 按字段合并，技能按技能 ID 合并，倍率按倍率 ID 和项目 key 合并，特效按效果 ID 合并。修改后运行：

```powershell
npm run library:build
npm test
```

字段结构以 `src/library/types.ts`、`src/features/build-presets/types.ts` 为准。

角色装备预设与计算器共用 `build-presets.json`。计算器只在 `profiles.json` 保存 Buff、Debuff、技能条件等战斗状态，攻击/防御面板、神器和伤害套装会实时从当前装备预设读取；每个角色、每个战斗方最后选择的预设 ID 保存在本地选择记录中。
