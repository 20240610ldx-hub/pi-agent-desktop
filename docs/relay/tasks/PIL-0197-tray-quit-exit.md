---
id: PIL-0197
title: Windows 托盘 Quit 只隐藏窗口不结束进程
epic: E11
priority: P1
status: in_progress
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

## 日志
- 2026-10-21T12:46Z · planner · 创建
- 2026-10-21T12:47Z · planner · 冻结验收标准 93fcef9363a2
- 2026-10-21T13:04Z · claude:sonnet-high:impl · 领取，租约至 2026-10-21T16:04Z
- 2026-10-22T02:41Z · claude:sonnet-high:impl · 复述：A1 托盘 Quit 后进程/exit 行/子进程；A2 keep-awake 随进程释放；A3 关窗进托盘与 quit_app 不变；A4 修复前失败的复现脚本 + 测试 + cargo/tsc/lint/guard。
