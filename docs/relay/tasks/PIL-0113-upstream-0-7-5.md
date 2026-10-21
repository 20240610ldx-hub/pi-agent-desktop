---
id: PIL-0113
title: 合入上游 abcwyc main 2026-10-20（desktop 0.7.5）
epic: E0
priority: P0
status: in_progress
owner: claude:sonnet-xhigh:impl
lease_until: 2026-10-21T07:29Z
branch: task/PIL-0113-upstream-0-7-5
implementers: [claude:sonnet-xhigh:impl]
depends_on: []
files_allowed: ["**"]
files_shared: []
acceptance_sha: 28d865bcb364
waivers: []
---

## 目标

把 fork `origin/main` 上已同步的上游 abcwyc/pi-agent-desktop（0.7.3 → 0.7.5，29 个提交，fork main `dca3f6c`、上游 `d414e9d`）以一个合并提交合入集成分支，保留 fork 的界面与身份改动。对应 GOALS「两个 fork 持续跟进上游」与 E1 产品身份。

## 背景与现状

- 合并基 `c15a65c`；试合并（`git merge-tree --write-tree HEAD origin/main`）有 41 个冲突文件，集中在 `components/AppShell.tsx`、`ChatInput.tsx`、`ChatWindow.tsx`、`SessionSidebar.tsx`、`MessageView.tsx`、`hooks/useAgentSession.ts`、`app/native-theme.css`、`package*.json`、`src-tauri/**`、`.github/workflows/release.yml`、`scripts/fork-ownership*.`。
- 上游主要内容：非项目 Chats 工作区与其 skills/MCP、项目时间线与分页会话列表、统一 composer 发送与可编辑追问、设置与菜单交互统一和聊天滚动修正、窗口首屏就绪后再显示、Windows 覆盖安装清缓存、读用户点名的文件与保存到 Downloads、0.7.5 版本与 homebrew。
- 上游未改 `app/globals.css`、`app/settings.css`、`scripts/upstream-css-baseline.json`、`lib/branding.test.mjs`。
- 合并规则见仓库根 `AGENTS.md`「Upstream merge sentinels」「Upstream merge decisions」与 `docs/merge-history.md`。

## 验收标准

- [ ] A1 任务分支上存在一个以 `origin/main`（不早于 `dca3f6c`）为第二父提交的合并提交；`git merge-base --is-ancestor dca3f6c HEAD` 退出码 0；`git diff --check` 无冲突标记。
- [ ] A2 fork 层未被回退：`node --test components/fork-extractions.test.mjs scripts/fork-ownership.test.mjs lib/branding.test.mjs components/AppShell.right-panel-row.test.mjs scripts/upstream-css-baseline.test.mjs scripts/release-workflows.test.mjs` 全部通过；AGENTS.md 列出的已拒绝上游 UI 没有重新出现（由验证者逐项 grep 记录）。产品名、窗口标识与更新通道仍为 Pilaude（E1）。
- [ ] A3 `npm test`、`node_modules/.bin/tsc --noEmit`、`npm run lint` 通过；任何失败须与集成分支合并前基线对照（同命令在合并前 HEAD 上的结果），只有合并前已存在的失败可登记，不得删、跳过或放宽测试。
- [ ] A4 `package-lock.json` 中 tauri 插件版本与 `src-tauri/Cargo.lock` 同 minor；`npm run drift` 运行并记录结果；`docs/merge-history.md` 追加本次合入段落（采纳／拒绝的上游项及理由）。
- [ ] A5 开发服务器（`npm run dev`，独立端口，取 preview 锁）首页、项目会话页、上游新增 Chats 入口可打开且控制台无报错，截图存 `relay-evidence/PIL-0113/`。
- [ ] A6 `node scripts/relay.mjs guard --task PIL-0113` 无未豁免阻断项。

## 范围外

新增功能、视觉复刻调整、主 checkout 未提交改动（他人工作，不得触碰）、推送远端与发版。

## 实现提示

- 在 `D:/pilaude/wt/PIL-0113` 里 `git merge origin/main`，逐文件解决冲突：上游拥有 SDK 适配；fork 拥有身份、`native-theme.css`、项目树侧栏与全高布局、desktop i18n。
- `package-lock.json`：按 AGENTS.md 先恢复 HEAD 版再 `npm install --package-lock-only`；改了依赖时删掉 node_modules junction 后 `npm ci`。
- 冲突解决后先提交合并（`wip(PIL-0113): merge upstream 0.7.5`），再逐条修测试。
- 不运行 `next build`（开发期间）。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志
- 2026-10-20T11:44Z · planner · 创建
- 2026-10-20T11:50Z · claude:opus-medium:coord · 写入目标、背景与验收；fork main 由本机 sync.ps1 补同步（GitHub Actions 同步因 release.yml 需 workflows 权限 422 失败）。用户已说"开工"。
- 2026-10-20T11:45Z · planner · 冻结验收标准 28d865bcb364
- 2026-10-20T11:45Z · claude:sonnet-xhigh:impl · 领取，租约至 2026-10-20T14:45Z
