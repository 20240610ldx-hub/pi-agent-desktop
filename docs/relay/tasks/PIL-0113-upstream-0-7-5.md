---
id: PIL-0113
title: 合入上游 abcwyc main 2026-10-20（desktop 0.7.5）
epic: E0
priority: P0
status: verify
owner: claude:sonnet-xhigh:impl
lease_until: 2026-10-21T07:29Z
branch: task/PIL-0113-upstream-0-7-5
implementers: [claude:sonnet-xhigh:impl]
depends_on: []
files_allowed: [**]
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
- 2026-10-21T05:01Z · claude:sonnet-xhigh:impl · 做了：在 D:/pilaude/wt/PIL-0113 对 origin/main(dca3f6c) 执行 git merge --no-commit，41 个冲突文件全部解决并暂存（共 203 个路径）。升级拥有的新功能全部采纳（Chats 工作区、项目时间线与分页、统一 Send/Queue/Stop 与可编辑跟进队列、app-menu 体系、窗口首屏就绪后再显示），fork 的 Pilaude 身份（0.1.0、Cargo/发行元数据、release 正文）、systemHome()、composer 外观、侧栏元数据与已拒绝上游 UI 全部保留；追加 docs/merge-history.md 段落、AGENTS.md 三条常驻规则、fork-ownership.json 数字与 decisionLog；另修 lib/notification-store.ts 的 getServerSnapshot（A5 控制台报错）、聊天态隐藏工作区控件与 Changes 卡、若干测试夹具。 / 状态：合并未提交——pre-commit guard 对每个文件报 R7，根因是任务卡写成 files_allowed: ["**"]，parseCard 不去引号，glob 变成含引号的 "**"，匹配不到任何路径（只有本卡如此）；scripts/relay.mjs 和卡片归协调者/用户，我没有绕过。工作树停在 MERGE_HEAD 状态（无未解决路径，全部已暂存）。自测：tsc 0 错；lint 0 错 1 警告（TerminalPanel，合并前即有）；npm test 3577 例 12 败，12 败全部在合并前基线 11df970 同样失败（对照见 relay-evidence/PIL-0113/a3-failure-comparison.txt）；npm run drift 无不一致；A5 dev 服务器 30188 首页、项目会话、Chats、新聊天、设置均无控制台报错，截图在 relay-evidence/PIL-0113/a5-*.png；src-tauri cargo check（Windows）通过；A2 六个测试文件中只有 release-workflows 的 diff renderer notice 一例失败，合并前即失败，原因是 autocrlf 下 THIRD_PARTY_NOTICES.md 为 CRLF。A1 未满足（尚无合并提交），A6 未满足（R7）。 / 下一步：协调者执行 relay scope PIL-0113 --remove '"**"' --add '**' --reason "files_allowed 的引号被解析进 glob" --approved-by <用户或规划者>，再由我或协调者在该 worktree 里直接 git commit（保持合并提交形态，不要 reset/stash），随后 relay guard --task PIL-0113，relay set PIL-0113 verify。 / 风险：NATIVE_POPUP_MENUS_ENABLED 现为 false（上游决定，所有菜单走 DOM，Pilaude 之前默认原生弹出）；聊天行用上游 pinnedChats/archivedChats，项目行用 fork 的 sidebar-session-metadata，两套并存；上游删除的 lib/recent-sessions.ts 与测试被保留（删测试是 R1，需用户豁免）；composer outbox CSS 未目视验证（需要真实跑 agent），test:e2e 未运行；window_appkit.rs（仅 macOS）未编译验证；lib/mcp-host.test.mjs 空闲关闭用例负载下偶发失败（idleMs 20，与合并无关）。
- 2026-10-21T05:03Z · claude:opus-medium:planner · 范围 ["**"] → ["**", **]：修正卡片书写错误：files_allowed 的引号被解析进 glob，范围本意不变
- 2026-10-21T05:03Z · claude:opus-medium:planner · 范围 ["**", **] → [**]：移除残留的带引号 glob
- 2026-10-21T05:05Z · claude:sonnet-xhigh:impl · in_progress → verify：合并提交 8389681；实现自测见卡片日志
