---
id: PIL-0111
title: Windows 原生验收基线（启动接入、窗口探针、DPI、进程卫生）
epic: E11
priority: P1
status: verify
owner: claude-cli:sonnet-high:impl
lease_until: 2026-10-22T06:54Z
branch: task/PIL-0111-windows-native-baseline
implementers: [claude-cli:sonnet-high:impl]
depends_on: []
files_allowed: [e2e/native-harness.mjs, e2e/native-harness.test.mjs, e2e/native-baseline.mjs, e2e/native-window-probe.ps1, docs/pilaude-windows-regression.md, scripts/release-workflows.test.mjs]
files_shared: [src-tauri/src/lib.rs]
acceptance_sha: 70e3a657f80d
waivers: []
---

## 目标

提供一套可重复执行的 Windows 原生检查底座：启动桌面开发构建、安全接入其 WebView2、枚举与截取真实顶层窗口、记录 DPI、并保证每次运行不留残余进程。后续原生检查卡（PIL-0200 Changes 独立窗口、PIL-0201 剪贴板／外部编辑器／托盘驱动，以及 PIL-0146、PIL-0166、PIL-0167）都复用它，不再各写一套。对应 [GOALS E11 与 E2](../GOALS.md)。

## 背景与现状

审计日期 2026-10-22。

- 主线上没有原生基线。已有的 `e2e/native-conversation-destinations.mjs` 是“真实 AppShell + 模拟 IPC”，文件头自己写明不启动原生 WebView，不属于本卡。`docs/pilaude-windows-regression.md` 目前只记录 2026-10-18 的测试隔离修复，没有原生检查清单。
- 备份分支 `wip/pre-relay-2026-10-19`（2332945）里有三个相关文件，旧会话已写完但从未在任务提交上通过：`e2e/native-window-probe.ps1`（49 行：EnumWindows 枚举进程顶层窗口，输出句柄、标题、矩形、`GetDpiForWindow`、窗口样式位，`PrintWindow` 截图）、`e2e/native-changes-window.mjs`（137 行：起 dev 壳、开 WebView2 回环 CDP 端口、Playwright `connectOverCDP`、窗口探针前后对照，属 PIL-0200 的素材）、`src-tauri/src/lib.rs` 中 +42 行的 `development_server_url`（让开发壳消费已校验的回环 `devUrl`，而不是写死 30141，含 2 个 Rust 单元测试，可与主线 lib.rs 干净三方合并，已只读试合并 0 冲突）。
- 旧会话最后一次真实运行（run1792392333147）失败原因：期望首个 CDP 页面是 `about:blank`，实际已加载 30142 根页，即 `--msWebView2CancelInitialNavigation` 没有挡住初始导航，CDP 接入前的请求无法被夹具拦截。结论是“真实开窗 IPC、OS 窗口 1→2→1、移动、DPI、关闭均未到达”，因此旧会话没有任何原生通过证据。
- 主线现状：`src-tauri/tauri.conf.json` 的 `devUrl` 与 `lib.rs` 的 `DEV_SERVER_URL` 都是 `http://127.0.0.1:30141`；`scripts/desktop-dev.mjs` 通过 `tauri dev` 启动并注入 `PI_DESKTOP_API_TOKEN`；`src-tauri/target/debug/pi-agent-desktop.exe` 存在（2026-10-19 构建，来源特性不明，harness 必须自己检查并记录构建时间与哈希）。桌面日志位于 `%LOCALAPPDATA%\io.github.20240610ldx-hub.pilaude\logs\desktop.log`。
- PIL-0197（已完成）的 `D:/pilaude/relay-evidence/PIL-0197/impl/repro-tray-quit.ps1` 已证明可在本机用 Win32 消息驱动托盘并按进程列表／日志起止偏移判定退出，其“按日志偏移截取本次运行新增日志、只杀自己启动的进程”的做法在本卡复用；托盘驱动本身属 PIL-0201。
- 本机验收环境（用户 2026-10-21 确认）：Windows 11，2560×1600，显示缩放 150%（`AppliedDPI` 144，Claude 应用缩放 100%）。其他缩放档只能由用户在系统设置里切换。
- 项目硬约束：开发期不运行 `next build`；每个任务 worktree 自己启动 `npm run dev`，共享预览用 `node scripts/relay.mjs lock preview` 串行。

## 验收标准

- [ ] A1 启动、接入与隔离：`node e2e/native-baseline.mjs --check launch --base <dev server origin> --out D:/pilaude/relay-evidence/PIL-0111/<run>` 在本机启动 `src-tauri/target/debug/pi-agent-desktop.exe`（缺失时只给出 `cargo build --manifest-path src-tauri/Cargo.toml --no-default-features` 的提示并退出码 2，不自己编译、不运行 `next build`），并满足：使用一次性 `WEBVIEW2_USER_DATA_FOLDER`、随机且仅监听回环的 CDP 端口；开发壳通过 `lib.rs` 的 `development_server_url` 消费 `--base` 对应的回环 `devUrl`（非回环、带凭据、带路径或查询的 origin 被 Rust 拒绝并有单元测试）；Playwright 能接入并读到 `window.__TAURI_INTERNALS__` 与主窗口 label `main`；运行期间没有任何 `/api/*` 请求到达真实 dev server（以代理计数或 dev server 访问日志证明，报告字段 `realApiRequests` 为 0），所有 API 由生成的夹具响应。实现方式不限定，但必须解决 2026-10-19 的“CDP 接入前请求”问题；建议方案是让 `--base` 指向 harness 自带的本地回环反向代理：非 `/api` 路径透传到 dev server，`/api` 与 SSE 由夹具应答，这样与 CDP 接入时序无关。报告记录 WebView2 运行时版本、Windows build 号、exe 构建时间与 SHA-256、实际 DPI。验证：命令退出码 0，`results.json` 中以上字段齐全且值符合；`cargo test --manifest-path src-tauri/Cargo.toml origin` 通过（须含迁入的 2 个用例 `configured_loopback_origin_is_used_without_starting_another_server` 与 `development_origin_rejects_nonloopback_credentials_and_route_payloads`）。
- [ ] A2 窗口探针：`e2e/native-window-probe.ps1` 对目标进程输出 JSON，每个可见顶层窗口含 `handle`、`title`、`x`、`y`、`width`、`height`、`dpi`、是否有标题栏／系统菜单／可缩放边框／最大化与最小化按钮、`printWindow` 结果与 PNG 路径；另支持把窗口移动到给定坐标（`SetWindowPos`）与发送 `WM_CLOSE` 的子命令，供后续卡使用。验证：对 A1 启动的真实主窗口运行，断言恰有 1 个可见窗口、宽高大于 0、`dpi` 等于系统当前缩放对应值（150% 时为 144）、截图 PNG 的像素尺寸等于窗口物理矩形且并非纯色（像素方差高于阈值）；失败路径：目标进程没有窗口时输出空数组且退出码 0，进程不存在时退出码非 0 并给出明确信息，截图目录不可写时报错而不是静默跳过。
- [ ] A3 DPI 标注与矩阵：每次运行记录主窗口 `GetDpiForWindow`、所在显示器缩放比例（`GetScaleFactorForMonitor` 或等价）、页面 `devicePixelRatio` 与 WebView 页面缩放；harness 只在实测缩放与 `--label dpi100|dpi125|dpi150|dpi175` 一致时接受该标签，不一致则退出码非 0，防止把 150% 的结果贴成别的档位。自动部分在本机当前 150% 档完成；其余档位需要用户参与（见实现提示中的用户步骤）。验证：当前缩放档运行通过；故意用错误标签运行得到非 0 退出码与明确提示；未做的其他档位在证据里写“未运行”，不得补写通过。
- [ ] A4 进程与退出卫生（含失败与中断路径）：每次运行前后记录进程树（应用主进程与其 `msedgewebview2` 子进程）；harness 结束时只终止自己启动的进程树，5 秒内该树无残余，且绝不终止运行前就存在的 Pilaude 或 WebView2 进程；`desktop.log` 只截取本次运行新增部分并检查含 `startup`、不含 `panic`。失败路径：exe 缺失（退出码 2，未启动任何进程）、CDP 端口 60 秒内未就绪（带上 stderr 摘要，残余进程为 0）、运行中抛出异常或被 Ctrl+C 中断（清理仍然执行）。验证：`node --test e2e/native-harness.test.mjs` 通过，其中至少覆盖：诱饵进程（例如休眠中的 node 子进程，不属于本次进程树）在清理后仍存活；异常中途清理后无残余；错误标签、错误参数、exe 缺失各自的退出码；探针 JSON 解析与路径安全；以及一次在真实 exe 上的运行对照记录（前后进程列表）。
- [ ] A5 检查清单文档：`docs/pilaude-windows-regression.md` 新增“Windows 原生验收基线”一节，用表格列出每个原生检查项的采集方式、DPI 组合、是否需要用户操作和归属任务卡，至少包含：N1 WebView2／Tauri 启动与 CDP 接入（本卡，自动）；N2 顶层窗口、装饰与 DPI 截图（本卡，自动；DPI 切换需用户）；N3 进程树与退出卫生（本卡，自动）；N4 Changes 独立窗口（PIL-0200，自动）；N5 剪贴板读回、N6 外部编辑器、N7 托盘菜单驱动（PIL-0201，自动，托盘 Quit 后 keep-awake 的 `powercfg /requests` 需用户管理员终端）；N8 原生文件对话框（PIL-0167）；N9 系统通知 toast（PIL-0166）。同时写明运行前提（交互式桌面会话、未锁屏、不需要管理员权限）、证据存放位置与“未运行不等于通过”。验证：文档存在且表格列齐全；`node e2e/native-baseline.mjs --list` 输出与文档表格的检查 ID 一致。
- [ ] A6 收尾：`node --test e2e/native-harness.test.mjs`、`cargo test --manifest-path src-tauri/Cargo.toml origin`、`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0111` 通过，guard 无未豁免阻断项；`e2e/native-*.mjs` 与 `.ps1` 中无 `as any`、空 catch 或硬编码的用户名、密钥与私有路径；报告 JSON 不含环境变量值。

## 范围外

Windows 10 与干净机器、安装包、升级、2 小时耐久（PIL-0110 的发布门槛）；Changes 独立窗口的具体检查（PIL-0200）；剪贴板、外部编辑器与托盘菜单驱动（PIL-0201）；原生文件对话框与系统通知（PIL-0167、PIL-0166）；与参考图的像素比对；修改 Tauri 配置或 capability；自动切换系统显示缩放（有风险，由用户手动做）。

## 实现提示

- 来源：`git show wip/pre-relay-2026-10-19:e2e/native-window-probe.ps1`、`...:e2e/native-changes-window.mjs`（取其中 launch、探针调用、进程与端口诊断部分重构为 `native-harness.mjs`，Changes 专属断言留给 PIL-0200）、`git diff 2254561 wip/pre-relay-2026-10-19 -- src-tauri/src/lib.rs`（只取 `development_server_url` 一处）。按差异迁入，不整文件覆盖。
- `e2e/native-harness.mjs` 导出启动、接入、探针、进程快照、清理与证据写入函数；`e2e/native-baseline.mjs` 是命令行入口（`--check launch|window|hygiene`、`--list`、`--label`、`--base`、`--out`）。夹具可复用 `e2e/sidebar-pin-order.mjs` 的 `installSidebarPinFixture`（PIL-0010 会改它的一处 frame 守卫），但本卡在其 `files_allowed` 外，只读引用，需要改动时请协调者扩范围。
- 清理只杀本次 `spawn` 返回的 pid 及其后代（Windows 用 `taskkill /T /PID`），不要按进程名杀。WebView2 子进程通常随浏览器进程退出，仍要按进程树核对。
- 未做 A3 其余档位时，请在证据里把 100%、125%、175% 标为“未运行”。
- 需要用户的步骤（协调者代为转达，最少操作）：（1）切换 DPI：设置 → 系统 → 屏幕 → 缩放，依次选 100%、125%（必要时再选回 150%，用户日常是 150%），每切一次告诉协调者当前档位，由 agent 运行 `node e2e/native-baseline.mjs --check window --label dpi100` 等命令；缩放切换对已运行进程不生效，所以每次都由 harness 新启动应用；（2）运行期间保持交互式桌面解锁、不要最小化 RDP；（3）本卡不需要管理员权限。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |
| A1 | 真实 exe --check window：realApiRequests 0、directBaseRequests 0；绕过路径 403 计数；cargo test origin 9/9 | 通过 | D:\pilaude\relay-evidence\PIL-0111\verify\VERIFY-2.md | 2eb5ea8 | claude:sonnet-high:verify |
| A2 | 四档窗口探针：单窗口、PNG=物理矩形、非纯色；move/close/失败路径见 VERIFY.md | 通过 | D:\pilaude\relay-evidence\PIL-0111\verify\VERIFY-2.md | 2eb5ea8 | claude:sonnet-high:verify |
| A3 | dpi100/125/150/175 实测标签与 DPI 一致；错误标签退出码 3 | 通过 | D:\pilaude\relay-evidence\PIL-0111\verify\VERIFY-2.md | 2eb5ea8 | claude:sonnet-high:verify |
| A4 | native-harness.test 30/30 不挂；真实 exe 前后进程计数一致、无残留 | 通过 | D:\pilaude\relay-evidence\PIL-0111\verify\VERIFY-2.md | 2eb5ea8 | claude:sonnet-high:verify |
| A5 | — | 通过 | D:\pilaude\relay-evidence\PIL-0111\verify\VERIFY-2.md | 2eb5ea8 | claude:sonnet-high:verify |
| A6 | tsc、lint、guard；npm test 12 基线失败逐名一致 | 通过 | D:\pilaude\relay-evidence\PIL-0111\verify\VERIFY-2.md | 2eb5ea8 | claude:sonnet-high:verify |
| A1 | 最终提交真实 exe 150% --check window：N1–N3 通过，realApiRequests 0 | 通过 | D:\pilaude\relay-evidence\PIL-0111\verify\VERIFY-5.md | 133acfc | claude-cli:sonnet-medium:verify |
| A4 | native-harness.test 43/43；真实 exe 前后 pid@created 一致、residual 0、清理 <5 s | 通过 | D:\pilaude\relay-evidence\PIL-0111\verify\VERIFY-5.md | 133acfc | claude-cli:sonnet-medium:verify |

## 日志

- 2026-10-19T09:50Z · claude:opus-medium:coord · 迁移：由接力治理初始化从旧 handoff / plan / 扩展矩阵转写。
- 2026-10-19T09:50Z · claude:opus-medium:coord · 草稿：验收需规划者核实现状后补全并冻结。
- 2026-10-22T00:00Z · claude:sonnet-high:planner · 做了：核对主线与 wip 备份，把占位卡补成底座卡 A1–A6；剪贴板、外部编辑器、托盘驱动拆到 PIL-0201，Changes 独立窗口实测拆到 PIL-0200。状态：未冻结。下一步：协调者审阅后 freeze。风险：dev 壳是否带 no-default-features 需在 A1 里核实；初始导航隔离若代理方案仍不可行，交调试者。
- 2026-10-22T03:34Z · planner · 冻结验收标准 70e3a657f80d
- 2026-10-22T03:54Z · claude-cli:sonnet-high:impl · 领取，租约至 2026-10-22T06:54Z
- 2026-10-22T03:56Z · claude-cli:sonnet-high:impl · 复述：A1 用 Rust 运行期 PILAUDE_DEV_URL 覆盖(devUrl 为编译期写死)+harness 回环代理证明；A2 用 native-window-probe.ps1 对真实窗口证明；A3 用实测缩放对标签；A4 用 node --test+真实 exe 前后进程表；A5 文档表格与 --list 对齐。
- 2026-10-22T03:58Z · claude-cli:sonnet-high:impl · 进度：lib.rs development_server_url+运行期覆盖(cargo test origin 9/9 过)、window probe 已提交；cargo build exe 进行中。
- 2026-10-22T04:07Z · claude-cli:sonnet-high:impl · 进度：harness+CLI 已提交；真实 exe 在 150% 跑通 N1/N2/N3（run-window-3），错误标签退出码 3；下一步：node --test、文档、gating。
- 2026-10-22T04:09Z · claude-cli:sonnet-high:impl · 进度：native-harness.test.mjs 23/23 过、A5 文档已提交；下一步：tsc/lint/guard/npm test 基线、真实运行证据。
- 2026-10-22T04:15Z · claude-cli:sonnet-high:impl · 做了：A1–A5 完成并自测（真实 exe 150% 下 N1/N2/N3 通过，进程 27→34→27 无残余；node --test 23/23；cargo origin 9/9；tsc/lint 0）。状态：分支最后提交见 git log，A3 仅 150% 档，其余档位未运行；npm test 13 失败（基线 12），新增 1 个为 release-workflows 的“no test file left out”因 e2e/native-harness.test.mjs 在其覆盖目录外。下一步：协调者决定该测试的范围/豁免，并转达用户切 DPI 100/125/175；然后交验证。风险：lib.rs 额外加了 dev 专用运行期 PILAUDE_DEV_URL；详见 relay-evidence/PIL-0111/impl/HANDOFF.md。
- 2026-10-22T04:15Z · claude:opus:coordinator · 范围 [e2e/native-harness.mjs, e2e/native-harness.test.mjs, e2e/native-baseline.mjs, e2e/native-window-probe.ps1, docs/pilaude-windows-regression.md] → [e2e/native-harness.mjs, e2e/native-harness.test.mjs, e2e/native-baseline.mjs, e2e/native-window-probe.ps1, docs/pilaude-windows-regression.md, scripts/release-workflows.test.mjs]：冻结的 e2e/native-harness.test.mjs 位于 npm test 覆盖目录外；需在覆盖断言中显式排除仅限 Windows、会结束进程的 e2e/native-*.test.mjs
- 2026-10-22T04:21Z · claude-cli:sonnet-high:impl · release-workflows 断言排除 e2e/native-*.test.mjs；npm test 失败名与基线 12 个逐名一致（25d0c84）
- 2026-10-22T04:22Z · claude-cli:sonnet-high:impl · in_progress → verify
- 2026-10-22T07:25Z · claude-cli:sonnet-high:impl · 返工进行中（CLI Sonnet 修复 Opus 评审 6 项）；DPI 100/125/175 用户已跑完，证据在 verify\dpi*。
- 2026-10-22T07:34Z · claude-cli:sonnet-high:impl · 返工2：中断/清理时序、process.on、pid 复用、realApiRequests 实测、绕过路径测试；harness 30/30；真实 exe 复跑待做
- 2026-10-22T07:48Z · claude:sonnet-high:verify · 证据 A1：通过
- 2026-10-22T07:48Z · claude:sonnet-high:verify · 证据 A2：通过
- 2026-10-22T07:48Z · claude:sonnet-high:verify · 证据 A3：通过
- 2026-10-22T07:48Z · claude:sonnet-high:verify · 证据 A4：通过
- 2026-10-22T07:48Z · claude:sonnet-high:verify · 证据 A5：通过
- 2026-10-22T07:48Z · claude:sonnet-high:verify · 证据 A6：通过
- 2026-10-22T08:07Z · claude-cli:sonnet-high:impl · 返工3：app 存活期记录根 pid@created，退出后不认根；cleanup 逐 pid taskkill 不加 /T；补 PID 复用测试；N1 终判；见 impl/FIX3.md
- 2026-10-22T08:39Z · claude-cli:sonnet-high:impl · 返工4：Toolhelp 单快照+单次 taskkill 清理，A4 用例 1.8 s（原 9-10 s），3 次 harness 测试 42/42，真实 150% 通过；见 impl/FIX4.md
- 2026-10-22T08:56Z · claude-cli:sonnet-high:impl · 复审3返工：未知创建时间进程不归属；taskkill 128 保留拒绝信息；二次快照失败不跳出收尾
- 2026-10-22T09:06Z · claude-cli:sonnet-medium:verify · 证据 A1：通过
- 2026-10-22T09:06Z · claude-cli:sonnet-medium:verify · 证据 A4：通过
