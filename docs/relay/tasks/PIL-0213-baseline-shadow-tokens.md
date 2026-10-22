---
id: PIL-0213
title: 定义 --shadow-md / --shadow-sm 令牌（css-variables 基线失败）
epic: E0
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0002]
files_allowed: [app/native-theme.css, app/css-variables.test.mjs]
files_shared: []
acceptance_sha:
waivers: []
---

## 目标

让下列 Windows 基线失败用例通过且不引入新失败，使 `npm test` 基线可信（GOALS E11 Windows 基线）。

## 背景与现状

来源：PIL-0002 基线文档 `docs/relay/test-baseline.md`（证据 `D:/pilaude/relay-evidence/PIL-0002/impl/npm-test-bounded-cache.log`）。

- 失败测试：every CSS variable read without a fallback is defined somewhere
- 测试文件：app/css-variables.test.mjs
- 原因与归类：日志首行：`AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal`，actual 为 `['--shadow-md', '--shadow-sm']`，期望 `[]`。fork 样式读取了两个未定义的 CSS 变量；upstream/main 上该用例通过。归类：fork 回归。
- 复现：`node --test <测试文件>`

## 验收标准

- [ ] A1 上列失败测试全部通过。验证：对 app/css-variables.test.mjs 逐个运行 `node --test <文件>` 退出码 0。
- [ ] A2 `npm test` 相对 PIL-0002 基线无新增失败，且基线中属本卡的用例消失。验证：全量运行并与基线文档对比失败名单。
- [ ] A3 不删除、跳过或放宽任何断言；`npm run lint`、`node_modules/.bin/tsc --noEmit` 通过；`node scripts/relay.mjs guard` 无阻断项。

## 范围外

基线文档列出的其他失败用例；与上述用例无关的重构。

## 实现提示

在 `app/native-theme.css` 定义（或把读取处改为带回退值）这两个变量，不得改 `app/globals.css`/`app/settings.css`（与 upstream 逐字节一致）。不得放宽测试。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志
- 2026-10-22T11:19Z · planner · 创建
- 2026-10-22T11:30Z · claude-cli:sonnet-medium:impl · 由 PIL-0002 基线 A4 转出，写入目标、背景与验收（未冻结）
