---
id: PIL-0197
title: Windows 托盘 Quit 只隐藏窗口不结束进程
epic: E11
priority: P1
status: verify
owner: claude:sonnet-high:impl
lease_until: 2026-10-21T16:04Z
branch: task/PIL-0197-tray-quit-exit
implementers: [claude:sonnet-high:impl]
depends_on: [PIL-0180]
files_allowed: [src-tauri/src/shell/platform_tray.rs, src-tauri/src/shell/mod.rs]
files_shared: []
acceptance_sha: 93fcef9363a2
waivers: []
---

## 目标

Windows 托盘菜单「Quit Pilaude」真正结束应用进程，并走与 `quit_app` 相同的退出路径（停止本地服务、触发 RunEvent::Exit、释放 keep-awake 等退出清理）。对应 GOALS E11 Windows 基线。

## 背景与现状

- PIL-0180 实机验证（2026-10-21，desktop:dev）：托盘 Quit 后窗口消失，但 `pi-agent-desktop.exe` 进程仍存活，desktop.log 无 `exit` 行，keep-awake 请求仍在；同一构建 F12 调用 `quit_app` 则正常退出并写 `exit` 行。证据：`relay-evidence/PIL-0180/verify/quit-investigation.txt`、`user-4-quit.txt`、`user-5-quit-app.txt`、`quit-app-log.txt`。
- 托盘 Quit 菜单项在 `src-tauri/src/shell/platform_tray.rs`（`quit_application_on_main_thread`），退出实现为 `src-tauri/src/shell/mod.rs` 的 `quit_application`。PIL-0180 未修改这两处。

## 验收标准

- [ ] A1 Windows 上从托盘菜单点「Quit Pilaude」后，`Get-Process pi-agent-desktop` 无进程，desktop.log 写入本次 `exit` 行，本地服务子进程无残留。验证：desktop:dev 或打包构建实机操作，记录进程列表前后对照与日志摘录。
- [ ] A2 keep-awake 开启时用托盘 Quit 退出，管理员 `powercfg /requests` 的 SYSTEM 项不再有本进程。验证：用户管理员终端前后对照文件。
- [ ] A3 关窗进托盘（非 Quit）仍保持进程与 keep-awake 不变；`quit_app` 命令路径行为不变。验证：同一构建实机对照。
- [ ] A4 先写能在修复前失败的定向测试或可复现脚本说明根因（如菜单事件未到达、主线程调度丢失、server.stop 阻塞），修复后通过；`cargo test --manifest-path src-tauri/Cargo.toml`（受影响模块）、`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0197` 通过，guard 无阻断。

## 范围外

托盘菜单样式与 C52 复刻；Linux/macOS 托盘行为。

## 实现提示

对比 `quit_app` 命令与托盘菜单事件进入 `quit_application` 的线程与时序；参考 docs/agents/fork-desktop.md。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |
| A1 | Windows 原生。用户实机托盘 Quit：进程消失(Get-Process)；验证者重跑 repro -WhileMenuOpen（desktop:dev 构建，fix 提交）：Quit 后 3.5s 进程已退出（修复前 impl 记录为存活）。失败部分：卡片要求 desktop.log 写入本次 exit 行，托盘路径实际只有 'quit requested' + 'exit forced: event loop did not stop within 2000ms'，无 exit 行（强制路径 process::exit 绕过 RunEvent::Exit 的 desktop_log）；本地服务子进程残留未验证（desktop:dev 无子进程，打包构建未测） | 失败 | D:/pilaude/relay-evidence/PIL-0197/verify/quit-log.txt, D:/pilaude/relay-evidence/PIL-0197/verify/user-4-quit.txt, D:/pilaude/relay-evidence/PIL-0197/verify/repro-whilemenuopen-rerun.txt | 02a0ce6 | claude:sonnet-high:verify |
| A2 | Windows 原生，用户管理员 powercfg /requests：托盘中 SYSTEM 含 pi-agent-desktop.exe(Pilaude keeps the system awake)，托盘 Quit(走 exit forced 路径)后 SYSTEM 仅剩 GameViewer，无本进程 | 通过 | D:/pilaude/relay-evidence/PIL-0197/verify/user-2-tray.txt, D:/pilaude/relay-evidence/PIL-0197/verify/user-4-quit.txt, D:/pilaude/relay-evidence/PIL-0197/verify/quit-log.txt | 02a0ce6 | claude:sonnet-high:verify |
| A3 | Windows 原生+代码审阅。关窗进托盘时 powercfg 仍有本进程请求(user-2-tray)；quit_application 被两条路径共用，改动仅增加日志与2s看门狗线程，正常路径(02:46:33 quit requested→+2ms exit，无 forced 行)进程正常退出。保留项：该次 02:46 是 F12 quit_app 还是托盘触发由调用方推断，验证者未亲自触发 quit_app | 通过 | D:/pilaude/relay-evidence/PIL-0197/verify/user-2-tray.txt, D:/pilaude/relay-evidence/PIL-0197/verify/quit-log.txt, D:/pilaude/relay-evidence/PIL-0197/impl/after-fix-HideMouse.txt | 02a0ce6 | claude:sonnet-high:verify |
| A4 | 修复前失败：impl before-fix-whilemenuopen.txt（Quit 后进程存活=True、日志无 exit，沿用实现者记录，未自行构建父提交）；修复后：验证者重跑 repro-tray-quit.ps1 -WhileMenuOpen 通过；cargo test shell::(2 个看门狗测试，仅测 spawn_exit_watchdog 夹具层，不覆盖 force_exit 本身)、cargo test 全量 30 通过、tsc 0、npm run lint 0、relay guard --task PIL-0197 无问题 | 通过 | D:/pilaude/relay-evidence/PIL-0197/verify/cargo-test.txt, D:/pilaude/relay-evidence/PIL-0197/verify/cargo-test-all.txt, D:/pilaude/relay-evidence/PIL-0197/verify/tsc.txt, D:/pilaude/relay-evidence/PIL-0197/verify/lint.txt, D:/pilaude/relay-evidence/PIL-0197/verify/guard.txt, D:/pilaude/relay-evidence/PIL-0197/verify/repro-whilemenuopen-rerun.txt | 02a0ce6 | claude:sonnet-high:verify |

## 日志
- 2026-10-21T12:46Z · planner · 创建
- 2026-10-21T12:47Z · planner · 冻结验收标准 93fcef9363a2
- 2026-10-21T13:04Z · claude:sonnet-high:impl · 领取，租约至 2026-10-21T16:04Z
- 2026-10-22T02:41Z · claude:sonnet-high:impl · 复述：A1 托盘 Quit 后进程/exit 行/子进程；A2 keep-awake 随进程释放；A3 关窗进托盘与 quit_app 不变；A4 修复前失败的复现脚本 + 测试 + cargo/tsc/lint/guard。
- 2026-10-22T02:41Z · claude:sonnet-high:impl · 做了：根因=Quit 事件在事件循环被托盘弹出菜单的模态循环(TrackPopupMenu)占住时到达，app.exit 只是排队的 RequestExit，循环不服务→无 RunEvent::Exit、进程和 keep-awake 残留（复现：D:/pilaude/relay-evidence/PIL-0197/impl/repro-tray-quit.ps1 -WhileMenuOpen，修复前 before-fix-whilemenuopen.txt 日志停在 'exit requested' 且进程存活，与 PIL-0180 证据一致）。修复=quit_application 加 2s 看门狗线程，超时执行 Exit 清理(keep-awake release、server.stop)并 process::exit(0)；新增 'quit requested'/'exit forced' 日志；2 个单测。正常路径(右键菜单点 Quit，窗口可见/已隐藏)实测立即写 exit 行。/ 状态：分支最后提交 02a0ce6；自测 cargo test 30 过、tsc、lint、guard 通过，证据在 relay-evidence/PIL-0197/impl/；A1-A3 真实托盘实机待用户。/ 下一步：交验证+用户手测。/ 风险：未能在合成消息下复现'正常点击也卡住'，若用户实机仍无 exit 行但出现 'quit requested' 则说明有别的原因；看门狗会在 2s 后强杀，属兜底。
- 2026-10-22T02:41Z · claude:sonnet-high:impl · in_progress → verify
- 2026-10-22T02:53Z · claude:sonnet-high:verify · 证据 A1：失败
- 2026-10-22T02:53Z · claude:sonnet-high:verify · 证据 A2：通过
- 2026-10-22T02:53Z · claude:sonnet-high:verify · 证据 A3：通过
- 2026-10-22T02:53Z · claude:sonnet-high:verify · 证据 A4：通过
- 2026-10-22T02:53Z · claude:sonnet-high:verify · 验证(02a0ce6)：A2/A3/A4 通过，A1 失败。目标：托盘Quit结束进程。做法：复跑repro -WhileMenuOpen、cargo test/tsc/lint/guard、审阅用户实机证据。结果：进程退出、powercfg释放、检查全绿；但托盘路径日志无 exit 行（只有 exit forced）。下一步：force_exit 完成清理后补写 exit 行（或由规划者 amend A1 接受 exit forced），并在打包构建确认服务子进程无残留。
- 2026-10-22T02:53Z · claude:sonnet-high:impl · verify → in_progress：A1 失败：托盘 Quit 日志无 exit 行(只有 exit forced)；见 verify/quit-log.txt
- 2026-10-22T02:56Z · claude:sonnet-high:impl · 复述（返工）：验证 A1 失败因 force_exit 绕过 RunEvent::Exit 未写 exit 行；要求清理后、process::exit 前写 exit 行并补清理顺序/日志单测。
- 2026-10-22T02:56Z · claude:sonnet-high:impl · 做了：force_exit 改为 forced_exit_sequence：写 'exit forced: …' → keep-awake release → instance lock 清理(仅 Linux，调用 crate::remove_instance_lock，与正常路径对齐) → server.stop → 写 'exit (forced)' → process::exit(0)。新增 2 个单测（清理顺序+exit 行最后；存在以 exit 开头的行）。repro 脚本 -WhileMenuOpen 增加对 exit 行的断言，重跑：进程已退出，desktop.log 出现 'exit (forced)'（after-fix2-whilemenuopen.txt）；正常点击路径仍写 'exit'（after-fix2-HideMouse.txt）。/ 状态：分支最后提交 3854190；cargo test 32 过、tsc、lint、guard 通过，证据 relay-evidence/PIL-0197/impl/。/ 下一步：交验证，用户实机复测 A1/A2/A3。/ 风险：Linux 强制路径的 instance lock 清理仅 cfg 编译，未在 Linux 实跑。
- 2026-10-22T02:56Z · claude:sonnet-high:impl · in_progress → verify
