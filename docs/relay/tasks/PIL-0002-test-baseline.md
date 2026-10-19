---
id: PIL-0002
title: 建立可信的测试基线并逐项登记已知失败
epic: E0
priority: P0
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: []
files_allowed: [docs/relay/test-baseline.md]
files_shared: [package.json]
acceptance_sha: b7426f70c1fa
waivers: []
---

## 目标

让每个 agent 都能分辨"我弄坏了"和"本来就坏"：在 Windows 上得到一份完整、有界、可复现的测试基线。对应 GOALS E0。

## 背景与现状

旧记录称全量 Windows 测试存在既有失败与挂起，此前各切片只运行定向测试。`npm test` 先运行 `check:deps`，再用 `node --test` 跑 app/lib/scripts/components/hooks/public 下全部 `*.test.mjs`。

## 验收标准

- [ ] A1 在集成分支 HEAD 的干净 worktree 中，于 Windows PowerShell 依次运行 `npm run check:deps`、`node_modules/.bin/tsc --noEmit`、`npm run lint`、`npm test`；每个命令的完整输出、退出码和耗时存入 evidence。
- [ ] A2 挂起有界：`npm test` 带单测超时（`--test-timeout`），整套在 30 分钟内结束；被超时终止的用例逐个列出。
- [ ] A3 `docs/relay/test-baseline.md` 列出每个失败或超时用例：文件、用例名、错误首行、在 `upstream/main` 是否同样失败、归类（环境 / 既有缺陷 / fork 回归）。
- [ ] A4 每个失败组都有一张新任务卡（todo，可不冻结），基线文件引用卡号。不修改任何测试或产品代码来消除失败（超时参数除外）。
- [ ] A5 若 GitHub Actions 现有 workflow 可运行，其 Linux 结果单独记录，不与 Windows 结果混合。

## 范围外

修复失败用例本身（各自建卡）；E2E 浏览器套件（另建卡）。

## 实现提示

先读仓库根 AGENTS.md 中相关 Hard rules 与 Topic Notes。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-19T09:50Z · claude:opus-medium:coord · 迁移：由接力治理初始化从旧 handoff / plan / 扩展矩阵转写。
- 2026-10-19T09:50Z · claude:opus-medium:coord · 验收标准取自用户确认过的验收出口，迁移时冻结；请用户抽查。
