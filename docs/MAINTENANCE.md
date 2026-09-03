# Epic7 Damage Calc 维护说明

## 项目边界

`epic7-calc` 是从 `e7-tools` 拆出的便携版，只包含：

- 伤害计算器
- 角色装备与装备预设
- 两个页面运行所需的角色、神器、技能、图标和基础目录数据

本项目不包含角色图鉴、神器图鉴、图鉴编辑器和爬虫界面。`public/library` 中保留的 JSON 与图片只是角色装备选择器和计算器匹配角色/神器所需的数据，不代表这里启用了图鉴页面。

## 从 e7-tools 同步

不要直接覆盖整个 `src` 或 `public`。使用项目内的白名单脚本：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-calculator-from-e7-tools.ps1
```

脚本只同步计算公式、计算器字段、新角色/神器的计算数据、装备页面需要的目录数据与对应素材。以下内容必须留在 `epic7-calc`，不能被 `e7-tools` 覆盖：

- `src/App.tsx`：只注册计算器和角色装备两个页面
- `src/app/navigation.ts`：便携版导航范围
- `src/components/app-shell/PrimaryNav.tsx`：水瓶菜单、UI 缩放和程序更新
- `src/data/portableUpdater.ts`：GitHub Releases 更新检查
- `src-tauri/src/lib.rs`：便携版自更新与本地数据目录
- `package.json`、`src-tauri/tauri.conf.json`：便携版名称和版本

新增计算器角色或神器时，要同时检查：

1. `src/assets/data/heroes.ts`、`artifacts.ts`、`skill_ids.ts`
2. `src/assets/i18n/cn.json`、`us.json`
3. `src/CalculatorWorkspace.tsx` 和相关计算字段
4. `public/assets` 中计算器直接使用的图标
5. `public/library` 中角色装备选择器使用的目录 JSON、头像和神器图标
6. 对应的单元测试

## 版本与发布

发布新版本时，保持以下版本一致且不带 `v` 前缀：

- `package.json`
- `package-lock.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock` 中本项目包版本
- `src-tauri/tauri.conf.json`

生成便携 EXE：

```powershell
npm test -- --run
npm run build
npx tauri build --no-bundle
```

生成物位于 `src-tauri/target/release/app.exe`。发布目录中的文件名固定为：

```text
release/Epic7 Damage Calc Portable.exe
```

GitHub Release 标签使用 `v0.1.13` 形式，便携更新包使用：

```text
Epic7.Damage.Calc.Portable_v0.1.13.zip
```

Release 正文会在应用的“界面设置 → 程序更新”中显示，因此每次发布都应填写简洁的更新说明。

## 用户数据

用户自己的别名、角色数值和装备预设位于 EXE 同级的 `data` 目录。程序自更新只替换 EXE，不覆盖现有 `data`，所以发布包中的默认数据不能作为更新时强制覆盖用户数据。
