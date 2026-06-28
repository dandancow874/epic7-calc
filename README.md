# Epic7 Damage Calc Desktop

一个基于 Windows 的 Epic Seven 伤害计算器 / 速度推算工具。  
项目以 [tyopoyt/epic7-damage-calc](https://github.com/tyopoyt/epic7-damage-calc) 的数据与计算逻辑为基础，重新整理为 React + Tauri 的桌面便携版。

> 非官方粉丝工具。Epic Seven 及相关游戏素材版权归 Smilegate / STOVE 所有。

## 功能

- 伤害计算：攻击方、防守方、神器、技能等级、Buff / Debuff、角色特性等
- 技能伤害拆分：直伤、激爆、DoT、神器追加伤害等
- 追加来源显示：支持 DoT、追伤类神器、角色护盾值等独立显示
- 装备套装：支持愤怒套、热情套装、穿透套、激流套、追击套等伤害相关套装
- HP 相关特性：使用施法者最大生命的角色/神器特性会自动显示最大生命增加与余香
- 速度推算：通过开局 CR 与我方速度推算敌方速度范围
- 截图识别：粘贴行动条截图，自动识别 CR 数值
- 角色别名：可手动编辑角色别名，搜索时生效
- Profile 自动保存：攻击方和防守方分别保存角色数值
- 便携数据：Windows exe 会在程序旁边读取/保存 `data` 文件夹
- 界面缩放：按住 `Ctrl` + 鼠标滚轮缩放，`Ctrl + 0` 重置

## 下载 / 使用

当前便携版 exe 位于：

```text
release/Epic7 Damage Calc Portable.exe
```

运行后会在 exe 旁边使用：

```text
release/data/
```

常见数据文件：

```text
release/data/aliases.json   # 用户本地别名覆盖
release/data/profiles.json  # 用户本地角色数值与神器保存
```

如果你只是修改默认别名并希望打包给别人使用，请改：

```text
src/data/aliases.json
```

这个文件会作为源码默认别名库一起发布。

## 开发环境

需要安装：

- Node.js
- Rust / Cargo
- Windows WebView2 Runtime

安装依赖：

```bash
npm install
```

启动网页开发预览：

```bash
npm run dev
```

打开：

```text
http://127.0.0.1:5174
```

## 打包 Windows exe

一键更新 assets、重新打包并启动 exe：

```text
update-assets-build.bat
```

双击该脚本会自动执行：

1. 检查 Node.js / npm / Rust Cargo
2. 如果缺少 `node_modules`，自动执行 `npm install`
3. 从上游仓库更新 assets
4. 重新打包 Windows exe
5. 覆盖 `release/Epic7 Damage Calc Portable.exe`
6. 启动新版 exe

只生成可运行 exe：

```bash
npx tauri build --no-bundle
```

生成位置：

```text
src-tauri/target/release/app.exe
```

如果需要放到便携发布目录，可以复制为：

```text
release/Epic7 Damage Calc Portable.exe
```

完整生成安装包：

```bash
npm run tauri -- build
```

## Assets 更新说明

目前英雄、神器、技能公式等核心 assets 数据会被打包进 exe。  
因此更新 assets 后，需要重新打包 exe 才会生效。

只更新源码 assets：

```bash
npm run assets:update
```

这个脚本会从上游仓库拉取最新 assets，并同步到项目源码中。同步后请重新打包。

推荐直接使用：

```text
update-assets-build.bat
```

它会自动完成“更新 assets + 重新打包 + 覆盖便携 exe + 启动程序”。

> 注意：当前版本还没有实现“运行中的 exe 直接热更新 `data/assets` 后立刻生效”。这是后续计划。

### 更新 / 打包常见问题

如果更新 assets 后打包时报类似错误：

```text
Cannot find module 'src/app/models/hero-enums'
```

意思是上游 assets 的代码结构有变化，新的数据文件引用了本地程序需要提供的兼容模型。当前项目已经内置：

```text
src/app/models/hero-enums.ts
```

用于兼容新版 assets 的职业、星级、星座枚举。正常情况下直接重新拉取最新源码后再运行 `update-assets-build.bat` 即可。

如果以后又出现新的 `Cannot find module ...`，通常不是 assets 下载失败，而是上游 assets 又新增了依赖。需要在 `src/app/models/` 或对应位置补一个兼容文件，再重新打包。

如果覆盖便携 exe 失败，通常是旧版 exe 还在运行。先关闭程序，再重新运行 `update-assets-build.bat`。

如果上游新增了新的装备套装、Buff 或计算字段，assets 更新后可能只会先带来数据和翻译。桌面版界面仍需要在本地代码里接入对应开关，才能显示在页面上并参与计算。例如当前已接入新版 assets 中的 `fervorSet`，中文显示为“热情套装”。

角色或神器如果在 assets 中提供了 `barrier` / `barrier2` 公式，桌面版会在技能表上方的“追加来源”区域显示护盾值。追伤类神器、DoT 伤害也会显示在同一区域。

只要角色或神器特性包含 `casterMaxHP`，桌面版会自动追加 `casterMaxHPIncrease` 与 `casterLingeringFragranceStack` 输入项，中文分别显示为“最大生命增加(%)”和“余香”。这些字段会进入 `casterFinalMaxHP` 计算，因此会影响 HP 相关伤害或护盾。

## 发布便携版

推荐在 GitHub Releases 中发布 zip，而不是把 exe 提交到源码仓库。

zip 内容建议：

```text
Epic7 Damage Calc Portable.exe
data/
  aliases.json
```

其中 `data/aliases.json` 可以放整理好的默认别名；`data/profiles.json` 不建议发布，因为它通常是个人角色数值配置。

## 不要上传到 GitHub 的内容

这些目录/文件是本地缓存、构建产物或个人运行数据，不建议提交：

```text
node_modules/
dist/
release/
src-tauri/target/
test-screenshots/
preview*.png
*.log
```

项目 `.gitignore` 已经排除了这些内容。

## 项目来源与许可

本项目基于 / 参考：

- [tyopoyt/epic7-damage-calc](https://github.com/tyopoyt/epic7-damage-calc)

原项目 `package.json` 标注 license 为 `ISC`。如果你公开发布本仓库，请保留来源说明与许可证声明。

Epic Seven、英雄头像、技能图标、神器图标等游戏素材版权归原权利方所有。本项目仅用于学习、研究和玩家自用，不代表官方。

## 后续计划

- 将 assets 改为运行时读取，支持 exe 旁边 `data/assets` 热更新
- 优化 CR 截图识别速度
- 进一步完善 profile 管理
- 支持更多伤害来源的拆分显示
