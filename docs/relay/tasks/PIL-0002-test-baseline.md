---
id: PIL-0002
title: 建立可信的测试基线并逐项登记已知失败
epic: E0
priority: P0
status: verify
owner: codex-plus:luna-medium:impl
lease_until: 2026-10-22T12:04Z
branch: task/PIL-0002-test-baseline
implementers: [codex-plus:luna-medium:impl]
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
| A1 | 复核 check-deps/tsc/lint/npm test 命令、退出码、耗时与 impl 日志一致 | 通过 | D:\pilaude\relay-evidence\PIL-0002\verify\VERIFY-3.md | 4a8ae575 | claude-cli:haiku:verify |
| A2 | 有界运行 5m3.5s<30min，超时用例逐个列出 | 通过 | D:\pilaude\relay-evidence\PIL-0002\verify\VERIFY-3.md | 4a8ae575 | claude-cli:haiku:verify |
| A3 | 每个失败的文件/用例/首行/upstream 对比/归类逐行对照 upstream-*.log | 通过 | D:\pilaude\relay-evidence\PIL-0002\verify\VERIFY-3.md | 4a8ae575 | claude-cli:haiku:verify |
| A4 | 修复卡 PIL-0213–0216/0218 存在且与基线卡号一致，notices 归 PIL-0114，未改测试/产品代码 | 通过 | D:\pilaude\relay-evidence\PIL-0002\review\REVIEW.md | 4a8ae575 | claude-cli:sonnet-medium:review |
| A5 | 用户授权草稿 PR #1，两次推送 actions/runs=0、无 github-actions 套件；Actions 不可运行，未取得 Linux 结果，未与 Windows 混合 | 通过（条件款不成立：未取得 Linux 结果） | D:\pilaude\relay-evidence\PIL-0002\verify\A5-ci.md | 4a8ae575 | claude-cli:sonnet-medium:review |

## 日志

- 2026-10-19T09:50Z · claude:opus-medium:coord · 迁移：由接力治理初始化从旧 handoff / plan / 扩展矩阵转写。
- 2026-10-19T09:50Z · claude:opus-medium:coord · 验收标准取自用户确认过的验收出口，迁移时冻结；请用户抽查。
- 2026-10-22T09:04Z · codex-plus:luna-medium:impl · 领取，租约至 2026-10-22T12:04Z
- 2026-10-22T09:43Z · codex-plus:luna-medium:impl · in_progress → verify
- 2026-10-22T12:54Z · codex-plus:luna-medium:impl · 用户 2026-10-22 同意在 GitHub Actions 跑一次 Linux CI（草稿 PR 触发，被自动模式拦截，待用户执行）
- 2026-10-22T13:13Z · claude-cli:haiku:verify · 证据 A1：通过
- 2026-10-22T13:13Z · claude-cli:haiku:verify · 证据 A2：通过
- 2026-10-22T13:13Z · claude-cli:haiku:verify · 证据 A3：通过
- 2026-10-22T13:14Z · claude-cli:sonnet-medium:review · 证据 A4：通过
- 2026-10-22T13:14Z · claude-cli:sonnet-medium:review · 证据 A5：通过（条件款不成立：未取得 Linux 结果）
