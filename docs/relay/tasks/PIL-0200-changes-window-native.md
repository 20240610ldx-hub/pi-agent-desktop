---
id: PIL-0200
title: Changes 独立窗口的 Windows 原生实测
epic: E2
priority: P1
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0010, PIL-0111]
files_allowed: [e2e/native-changes-window.mjs, src-tauri/src/changes_window.rs]
files_shared: []
acceptance_sha: d446dd878141
waivers: []
---

## 目标

在 Windows 桌面开发构建里，真实打开、移动、缩放、关闭 Changes 独立窗口，证明它是独立的系统顶层窗口、带完整状态、关闭后主会话与草稿不受影响。对应 [GOALS E2 与 E11](../GOALS.md)。这是 PIL-0010 功能的原生层验证，浏览器层与 Rust 单元层不在本卡重复。

## 背景与现状

审计日期 2026-10-22。

- 功能由 PIL-0010 迁入；原生底座（启动、接入、窗口探针、DPI 标注、进程卫生）由 PIL-0111 提供。本卡只写 Changes 专属断言。
- 旧素材：`git show wip/pre-relay-2026-10-19:e2e/native-changes-window.mjs`（137 行）。流程是启动壳 → CDP 接入 → 夹具 → 在主窗口点工具条“在新窗口打开” → 探针确认 OS 窗口数 1→2 → 弹出窗读取状态 → 刷新 → 点头部 Close → OS 窗口数回到 1，主草稿同一 DOM 节点。旧会话四次运行均未走到开窗：初始导航隔离问题（见 PIL-0111 A1），所以 **没有任何旧原生证据可沿用**。
- Rust 侧 `open_changes_window` 创建 `changes-<随机hex>` 窗口，原生装饰、可缩放，最小内尺寸 480×400，初始 1080×800；`close_changes_window` 只接受 `changes-*` 调用方；`on_new_window` 与导航拦截只放行 `/changes`。
- 若实测发现 Rust 窗口创建或关闭有缺陷，可以在本卡修 `src-tauri/src/changes_window.rs`，修复须先有能复现的失败（原生脚本断言或 Rust 用例），不得改 capability 文件（超范围则暂停并请协调者扩范围）。
- 用户本机：Windows 11，2560×1600，150% 缩放；其他缩放档与多显示器需要用户操作。

## 验收标准

- [ ] A1 真实开窗：用 PIL-0111 harness 启动开发壳，在夹具主会话里打开 Changes，选一个提交与文件并输入一段中文未发送反馈，点 pane 工具条“在新窗口打开”。探针确认同一进程的可见顶层窗口数由 1 变为 2；新窗口 label 匹配 `^changes-`、标题含 Changes、具有标题栏、系统菜单、可缩放边框、最大化与最小化按钮；调用日志里 `open_changes_window` 带有合法 `viewId`；`PrintWindow` 截图非空白且已读图。验证：`node e2e/native-changes-window.mjs` 退出码 0，`results.json` 的 `windowsBefore`、`windowsDuring` 与截图落在 `D:/pilaude/relay-evidence/PIL-0200/`；层级标注“Windows 原生 + 夹具数据”。
- [ ] A2 状态带入与刷新：弹出窗恢复同一提交、同一文件选择、同一 diff 范围与未发送反馈（中文原文），反馈文本逐字一致；刷新弹出窗后仍保持；窗口内容宽高、`devicePixelRatio` 与 `GetDpiForWindow` 一致并记录；`pageErrors`、`consoleErrors`、`realApiRequests`、外部请求均为空。验证：同 A1 命令的断言项与 `results.json` 字段。
- [ ] A3 移动、缩放、关闭与恢复：用探针把弹出窗移动到另一位置并缩放到最小尺寸附近（480×400 内尺寸以上），窗口矩形随之改变且内容仍可读；分别用头部 Close 按钮（`close_changes_window`）和系统关闭（`WM_CLOSE`）各关闭一次，两次后进程仍存活、可见窗口数回到 1 且句柄为原主窗口、主窗口聊天输入框仍是同一个 DOM 节点且草稿逐字不变；关闭后再次点击“在新窗口打开”能创建新的 `changes-*` 窗口（label 与前一个不同）。失败路径：未选择项目文件夹时按钮禁用，直接调用也不创建窗口且显示错误；`desktop.log` 本次新增部分无 panic。验证：`node e2e/native-changes-window.mjs` 对应分组断言与日志摘录。
- [ ] A4 DPI 与残留：弹出窗与主窗口的 DPI 相同并被记录；脚本退出后 5 秒内由本次运行启动的进程树无残余，且没有终止任何运行前已存在的进程。当前 150% 档由 agent 自动运行；至少再有一个其他缩放档（建议 100%）由用户切换后运行，另一档未做时写“未运行”并保持本项未通过。验证：`results.json` 的 `dpi` 与进程前后对照；用户操作步骤见实现提示。
- [ ] A5 收尾：`node --test e2e/native-harness.test.mjs`（PIL-0111 交付的自测不得变红）、若改了 Rust 则 `cargo test --manifest-path src-tauri/Cargo.toml changes_window` 通过、`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0200` 通过，guard 无未豁免阻断项；脚本无硬编码用户名与私有路径。

## 范围外

浏览器层与状态存储的行为（PIL-0010）；会话级新窗口（PIL-0146 的原生部分）；Windows 10；多显示器跨 DPI 拖动（有第二显示器时作为附加记录，无则写“未运行”）；与参考图的像素比对。

## 实现提示

- 复用 PIL-0111 的 harness，不重复启动代码。Changes 专属断言来自旧脚本的 `popup` 部分。
- 点击要走真实 UI（pane 工具条按钮），不要直接 `invoke`；`invoke` 的记录只用来核对参数。
- 需要用户的步骤（最少）：（1）切换缩放到 100%：设置 → 系统 → 屏幕 → 缩放，告诉协调者，agent 随即新启动应用跑 `node e2e/native-changes-window.mjs --label dpi100`，跑完把缩放切回 150%；（2）运行期间保持交互式桌面解锁，不要手动操作窗口；（3）不需要管理员权限。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-22T00:00Z · claude:sonnet-high:planner · 做了：由 PIL-0010 的原生验收项（原 A4）拆出本卡。状态：未冻结。下一步：协调者审阅后 freeze；PIL-0146 若要把本卡作为独立窗口原生证据，需加入其 depends_on。风险：旧脚本从未走通，首个障碍是 PIL-0111 的初始导航隔离。
- 2026-10-22T03:34Z · planner · 冻结验收标准 d446dd878141
