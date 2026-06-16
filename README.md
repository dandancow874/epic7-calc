# Epic7 Damage Calc Desktop

一个基于 Windows 的 Epic Seven 伤害计算器 / 速度推算工具。  
项目以 [tyopoyt/epic7-damage-calc](https://github.com/tyopoyt/epic7-damage-calc) 的数据与计算逻辑为基础，重新整理为 React + Tauri 的桌面便携版。

> 非官方粉丝工具。Epic Seven 及相关游戏素材版权归 Smilegate / STOVE 所有。

## 功能

- 伤害计算：攻击方、防守方、神器、技能等级、Buff / Debuff、角色特性等
- 技能伤害拆分：直伤、激爆、DoT、神器追加伤害等
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

可用脚本：

```bash
npm run assets:update
```

这个脚本会从上游仓库拉取最新 assets，并同步到项目源码中。同步后请重新打包。

> 注意：当前版本还没有实现“运行中的 exe 直接热更新 `data/assets` 后立刻生效”。这是后续计划。

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
