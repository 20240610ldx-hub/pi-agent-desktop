---
id: PIL-0010
title: Changes 面板在独立窗口打开（功能迁入与浏览器层验证）
epic: E2
priority: P1
status: done
owner: codex-plus:sol-high:impl
lease_until:
branch: task/PIL-0010-changes-popout-window
implementers: [codex-plus:sol-high:impl]
depends_on: [PIL-0001]
files_allowed: [app/changes/**, components/ChangesPane.window.test.mjs, lib/changes-window*, lib/workspace-popout-copy.ts, lib/app-prefs.ts, src-tauri/src/changes_window.rs, e2e/changes-window*.mjs, e2e/sidebar-pin-order.mjs]
files_shared: [components/AppShell.tsx, components/ChangesPane.tsx, components/ChangesPane.test.mjs, components/WorkspacePaneDock.tsx, components/WorkspacePaneDock.test.mjs, components/WorkspacePaneControls.tsx, components/WorkspacePaneControls.test.mjs, lib/desktop-native.ts, scripts/fork-ownership.json]
acceptance_sha: b6c8d8d40ea3
waivers: []
---

## 目标

右侧 pane 工具条提供“在新窗口打开”，Changes 在独立窗口中保留提交列表、文件树选择、diff 范围、未发送反馈和滚动位置，主会话与草稿留在背景不受影响。对应 [GOALS E2](../GOALS.md)。本卡把已做好的功能迁入当前主线并完成浏览器层与 Rust 单元层验证；Windows 原生窗口实测拆在 PIL-0200，像素级复刻由 E2 复刻卡（PIL-0144/0145/0150/0169）负责。

## 背景与现状

审计日期 2026-10-22，对象是主线 `fusion/pi-claude-desktop` 与备份分支 `wip/pre-relay-2026-10-19-index`（5193f1e，旧基线 2254561）。

- 主线已有最小弹出链路：`AppShell.openChangesPopout` → `lib/desktop-native.ts openChangesWindow(cwd, targetId)` → Rust `open_changes_window`（`src-tauri/src/changes_window.rs`，仅 main 窗口可调用，URL 固定为服务器 origin 的 `/changes?cwd=…&targetId=…`）→ `app/changes/page.tsx`。独立页每次都重新初始化 Changes 状态，工具条只有 Changes 头部的 `onOpenWindow` 按钮，通用 pane 工具条没有入口。
- 备份 index 里的“窗口切片”共 19 个源文件，相对旧基线改动 +1379/-109（含 docs 与不相关 hunk）：`app/changes/page.tsx`、`app/changes/page.test.mjs`、`components/{AppShell,ChangesPane,WorkspacePaneControls,WorkspacePaneDock}.tsx`、`components/{ChangesPane,ChangesPane.window,WorkspacePaneDock}.test.mjs`、`lib/{app-prefs,desktop-native}.ts`、`lib/{changes-window-state,workspace-popout-copy}.ts`、`lib/changes-window-state.test.mjs`、`lib/changes-window.test.mjs`、`src-tauri/src/changes_window.rs`、`e2e/{changes-window,changes-window-restore,sidebar-pin-order}.mjs`。主线上缺少的新文件：`lib/changes-window-state*`、`lib/workspace-popout-copy.ts`、`components/ChangesPane.window.test.mjs`、`e2e/changes-window*.mjs`。
- 可迁移性已只读核对：用 `git merge-file`（基线 2254561 / 主线 / index 三方）逐文件试合并，上述 19 个文件除 `scripts/fork-ownership.json` 外全部 0 冲突；`AppShell.tsx`（主线自基线起 +306/-105）、`desktop-native.ts`、`app-prefs.ts` 文本上能干净合并，但仍需人工复核语义。index 里还夹带两处与窗口无关的 hunk，不得迁入：`scripts/release-workflows.test.mjs` 的 Todo 注意事项断言（属 PIL-0070/PIL-0114），以及 `scripts/fork-ownership.json` 中的 Todo/扩展条目（只迁入窗口相关的 `driftedUpstreamFiles` 与 `forkOwnedPaths` 条目；与该文件的 1 处冲突需手动解）。
- 设计与历史验证（仅作机制说明，旧会话记录在 `wip/pre-relay-2026-10-19-index` 的 `docs/engineering/pilaude-ui/new-window.md`，历史档案，不要往里追加）：视图状态存本地 `pi-changes-window-views-v1`，URL 只带随机 UUID `viewId`；每条记录 24 小时过期、最多 8 条、96Ki、128 个路径、16Ki 反馈，不存 patch／凭据／聊天草稿；`comparisonId` 变化时同名文件不重新绑定旧选行，评论保留为“未绑定”且无提交按钮；Rust 校验 UUID 格式并核对调用方 label 与可信 origin。
- 旧证据哪些仍可参考：旧会话的浏览器 `changes-window` 五组与 `changes-window-restore` 一组 GREEN、受影响 48/48、cargo `changes_window::tests` 5/5，都是针对旧基线 2254561 的结果，**不能**当作主线上的通过证据，必须在任务提交上重跑。旧会话“Windows 独立窗口、WebView/DPI/原生 IME/焦点均未验”，该结论仍然成立，对应 PIL-0200。
- 浏览器 e2e 需要一个带夹具的 dev server：在任务 worktree 里 `npm run dev`（开发期不得运行 `next build`），用 `node scripts/relay.mjs lock preview` 串行，脚本通过 `E2E_BASE_URL` 指向它（脚本默认 `http://127.0.0.1:30142`，该预览实例已不存在，需显式传入）。

## 验收标准

- [ ] A1 入口与可达性：Changes 面板头部和通用 pane 工具条都有“在新窗口打开”双窗图标；英文、简体、繁体 tooltip 与 `lib/workspace-popout-copy.ts` 文案一致；Tab 可聚焦，Enter 与 Space 可触发；Files、Terminal、Tasks 三个 pane 没有真实弹出能力，按钮显示禁用并给出各自原因，不静默缺席；浏览器中的 tooltip 文案是“新标签页”，不声称原生窗口；会话窗口（conversation-*）与未选项目文件夹时按钮禁用并解释原因。验证：`node --experimental-strip-types --test components/WorkspacePaneDock.test.mjs components/WorkspacePaneControls.test.mjs components/ChangesPane.test.mjs` 通过，加 `E2E_BASE_URL=<任务 dev server> node e2e/changes-window.mjs` 产出的三语工具条截图（人工读图一次，写入证据）。
- [ ] A2 状态随窗口保留：从已选提交、已选文件、split／wrap、行选择、侧栏折叠和滚动位置的主 pane 点击弹出，新视图恢复同一 `comparisonId` 下的全部这些状态；刷新独立页恢复其自己的最新状态；URL 只含 cwd、targetId 与不透明 `viewId`，不含路径、提交号或反馈文字；`pageErrors`、`consoleErrors`、`nonReadRequests`、`externalRequests` 全为空。验证：`E2E_BASE_URL=<任务 dev server> node e2e/changes-window.mjs` 与 `E2E_BASE_URL=<任务 dev server> node e2e/changes-window-restore.mjs` 退出码 0，报告 JSON 与读过的截图落在 `D:/pilaude/relay-evidence/PIL-0010/`；层级标注为“浏览器 + 夹具”。
- [ ] A3 主会话不受影响：弹出与关闭前后，主窗口原聊天 textarea 是同一个 DOM 节点、草稿文本逐字不变、主 pane 仍挂载且其提交与文件选择不变；独立窗内的“添加到草稿”只经带 ACK 的 targetId 通道追加到原草稿一次，IME 组合期间不提交；关闭独立窗不向模型发送任何内容（报告中 `nonReadRequests` 为空）。验证：同 A2 的两个 e2e 脚本里对应分组全部通过；`node --experimental-strip-types --test app/changes/page.test.mjs lib/changes-window.test.mjs` 通过。
- [ ] A4 失败与恢复路径：（a）本地存储不可用、记录超 96Ki 或超过 128 个路径时，在打开窗口之前报错，不创建窗口；（b）浏览器拦截弹窗时显示错误，不静默失败；（c）`viewId` 缺失、过期、格式非法，或与 cwd／targetId 不匹配时，独立页显示明确的恢复提示并仍可使用最新对比；（d）`comparisonId` 变化后，同名文件的旧评论保持未绑定、无提交按钮、重新选行后原文不丢；（e）A→B→A 切换会话，旧 targetId 不复用。验证：`node --experimental-strip-types --test lib/changes-window-state.test.mjs lib/changes-window.test.mjs app/changes/page.test.mjs components/ChangesPane.window.test.mjs` 与 e2e 的 missing-record、changed-comparison 分组通过；每个分支至少一个会因去掉对应实现而失败的用例（先看到失败再看到通过，红绿记录写入日志）。
- [ ] A5 Rust 与权限边界：`cargo test --manifest-path src-tauri/Cargo.toml changes_window` 全部通过，且至少包含 5 个窗口相关用例（URL 编码、feedback target、非法目录、viewId 格式与长度边界、非 main 调用方拒绝）；`viewId` 只接受 36 位小写 UUID；调用方非 main 窗口或当前页不是可信 origin 根页时拒绝；桌面 API token 与 viewId 之外的状态不进入 URL；`src-tauri/capabilities/desktop-conversation.json` 与 `desktop-changes.json` 没有被修改（guard 的范围检查可证明）。验证：上述命令输出与 `git diff --stat fusion/pi-claude-desktop -- src-tauri/capabilities` 为空。
- [ ] A6 迁移完整性与收尾：只按 index `5193f1e` 相对 `2254561` 的差异逐文件迁入上述 19 个窗口源文件，不整文件覆盖；`scripts/release-workflows.test.mjs` 与 Todo 相关 fork-ownership 条目没有进入本分支；`AppShell.right-panel-row.test.mjs` 与 `AppShell.file-viewer-state.test.mjs` 仍通过；`node --test scripts/fork-ownership.test.mjs` 通过。最终执行并记录：`node --experimental-strip-types --test lib/changes-window-state.test.mjs lib/changes-window.test.mjs app/changes/page.test.mjs components/ChangesPane.test.mjs components/ChangesPane.window.test.mjs components/WorkspacePaneDock.test.mjs components/WorkspacePaneControls.test.mjs components/AppShell.file-viewer-state.test.mjs components/AppShell.right-panel-row.test.mjs scripts/fork-ownership.test.mjs`、`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0010` 全部通过，guard 无未豁免阻断项；用例总数不少于迁入前对应文件的用例数（旧会话同组合为 48）。

## 范围外

Windows 原生开窗、移动、DPI、关闭与进程清理的实机验证（PIL-0200，依赖 PIL-0111 的原生基线）；会话级“新窗口”（`conversation-*`，已有 `open_conversation_window`）；Files、Terminal、Tasks 等其他 pane 的弹出；与 Windows Claude Desktop 3.1623 的像素与交互复刻（PIL-0144、PIL-0145、PIL-0150、PIL-0169）；新增 token 或扩大 capability。

## 实现提示

- 先读根 AGENTS.md 的 Hard rules 与 `docs/agents/fork-ui.md`、`docs/agents/fork-desktop.md`；不运行 `next build`。
- 迁移方式：在任务 worktree 里 `git diff 2254561 5193f1e -- <19 个路径>` 生成补丁后 `git apply --3way`，逐文件看结果；新文件可用 `git show 5193f1e:<path>` 取出再核对，不要整目录复制旧工作区。`fork-ownership.json` 手工合并窗口条目。
- AppShell、ChangesPane、WorkspacePane*、desktop-native 都被 E2 复刻卡拥有（见 files_shared），本卡只做窗口相关的最小 hunk，不顺手改样式。这些复刻卡都依赖本卡，合入顺序天然串行。
- 浏览器测试需要夹具 dev server；e2e 的夹具来自 `e2e/sidebar-pin-order.mjs`（本卡包含其 frame/protocol guard 一条改动）。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |
| A1 | 定向 66/66；三语工具条与 tooltip、Files 禁用原因截图 | 通过 | D:\pilaude\relay-evidence\PIL-0010\verify\VERIFY.md | 721036d1 | claude-cli:sonnet-high:verify |
| A2 | changes-window.mjs 7 组与 changes-window-restore.mjs 通过，无页面/控制台错误、无外部请求 | 通过 | D:\pilaude\relay-evidence\PIL-0010\verify\VERIFY.md | 721036d1 | claude-cli:sonnet-high:verify |
| A3 | 原 textarea 同节点草稿不变；IME 组合不提交；添加到草稿经 ACK 只追加一次 | 通过 | D:\pilaude\relay-evidence\PIL-0010\verify\VERIFY.md | 721036d1 | claude-cli:sonnet-high:verify |
| A4 | 变异 11 个：单元或 e2e 均能打红（2 个等价变异存活） | 通过 | D:\pilaude\relay-evidence\PIL-0010\verify\VERIFY.md | 721036d1 | claude-cli:sonnet-high:verify |
| A5 | cargo test changes_window 6/6，capabilities 无差异，两个权限变异打红；Opus 复核调用方校验 | 通过 | D:\pilaude\relay-evidence\PIL-0010\review\REVIEW.md | 721036d1 | claude-cli:opus-high:review |
| A6 | tsc 0，lint 0 错误，guard 无问题，npm test 基线 11 全在无新增（Mermaid 间歇超时单跑 21/21） | 通过 | D:\pilaude\relay-evidence\PIL-0010\verify\VERIFY.md | 721036d1 | claude-cli:sonnet-high:verify |

## 日志

- 2026-10-19T09:50Z · claude:opus-medium:coord · 迁移：由接力治理初始化从旧 handoff / plan / 扩展矩阵转写。
- 2026-10-19T09:50Z · claude:opus-medium:coord · 验收标准取自用户确认过的验收出口，迁移时冻结；请用户抽查。
- 2026-10-19T14:20Z · codex:gpt:coord · 做了：恢复原窗口上下文并只读核对源与最后失败，证据D:/pilaude/relay-evidence/PIL-0001/recovery-windows/recovery.json。状态：19条窗口源在index快照5193f1e，native lib.rs/checker/probe三个blob匹配working23329458；四轮自建进程与调试端口当前无匹配残留，无需终止。最后run1792392333147预期about:blank但实际已是30142根页，真实开窗IPC、OS1到2到1、移动/DPI/关闭后草稿均未到达，不作为A4通过。下一步：用户恢复工作且PIL-0001完成后，在PIL-0010任务worktree交调试者解决初始导航隔离，再独立验证。风险：空API数组不覆盖CDP接入前请求，不降低真实IPC和窗口验收要求；本轮未改源或启动GUI。
- 2026-10-22T00:00Z · claude:sonnet-high:planner · 做了：重写验收标准为浏览器层 A1–A6，原生窗口实测拆到 PIL-0200，初始导航隔离难题归入 PIL-0111 的夹具代理方案；核对 19 文件可干净迁移（除 fork-ownership.json）。状态：未冻结（acceptance_sha 已清空，原冻结文本作废，需协调者重新 freeze，缩小范围的部分需用户确认）。下一步：协调者审阅后 freeze。风险：A1 的通用 pane 工具条改动落在 WorkspacePaneDock／Controls 等复刻卡拥有的文件，合入需依赖顺序。
- 2026-10-22T03:34Z · planner · 冻结验收标准 b6c8d8d40ea3
- 2026-10-22T09:54Z · codex-plus:sol-high:impl · 领取，租约至 2026-10-22T12:54Z
- 2026-10-22T12:56Z · codex-plus:sol-high:impl · in_progress → verify
- 2026-10-22T13:17Z · codex-plus:sol-high:impl · verify → review
- 2026-10-22T13:20Z · claude-cli:sonnet-high:verify · 证据 A1：通过
- 2026-10-22T13:20Z · claude-cli:sonnet-high:verify · 证据 A2：通过
- 2026-10-22T13:21Z · claude-cli:sonnet-high:verify · 证据 A3：通过
- 2026-10-22T13:21Z · claude-cli:sonnet-high:verify · 证据 A4：通过
- 2026-10-22T13:21Z · claude-cli:opus-high:review · 证据 A5：通过
- 2026-10-22T13:21Z · claude-cli:sonnet-high:verify · 证据 A6：通过
- 2026-10-22T13:21Z · claude-cli:opus-high:review APPROVE · review → done（评审 claude-cli:opus-high:review APPROVE）
