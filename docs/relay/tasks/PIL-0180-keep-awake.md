---
id: PIL-0180
title: Windows 保持唤醒能力与退出释放
epic: E9
priority: P1
status: verify
owner: claude:sonnet-high:impl
lease_until: 2026-10-21T14:58Z
branch: task/PIL-0180-keep-awake
implementers: [codex-plus:gpt-xhigh:impl, claude:sonnet-high:impl]
depends_on: []
files_allowed: [src-tauri/src/keep_awake.rs, lib/keep-awake-service.ts, lib/keep-awake-service.test.mjs]
files_shared: [src-tauri/src/lib.rs, lib/desktop-native.ts, src-tauri/permissions/desktop-shell.toml, src-tauri/capabilities/desktop-dialog.json, src-tauri/Cargo.toml, src-tauri/Cargo.lock]
acceptance_sha: 0ef48e1df3f8
waivers: []
---

## 目标

在 Windows 桌面提供可查询、可启停的真实防自动休眠请求，后台任务可按用户开关保持系统唤醒，关闭或退出立即释放。对应 GOALS E9，供 C57 菜单消费。

## 背景与现状

C57 当前没有保持唤醒后端。用户要求能力先行；新建原生服务，UI 卡不修改 Rust 能力实现。P1：PIL-0171 的勾选/失败真值依赖。

## 验收标准

- [ ] A1 Windows 上从桌面桥显式开启后，系统可观察到该进程的防自动休眠请求；查询接口报告 OS 接受后的 enabled 状态，默认关闭。验证：原生命令及 powercfg /requests 或等效 OS 诊断前后对照，不以 JS 布尔变量证明。
- [ ] A2 关闭、明确退出、服务异常/窗口销毁后防休眠请求释放；关窗进托盘时已开启的请求仍有效，重启默认关闭。验证：实机隐藏/恢复/退出/重启与 OS 请求计数，不改变屏幕常亮或手动睡眠行为。
- [ ] A3 连续开启/关闭/重复调用各五轮没有多个请求句柄或遗留线程；API 失败/平台不支持返回明确错误，状态不能乐观显示已开启。验证：Rust 模块生命周期测试 + Windows 实机状态查询。
- [ ] A4 原生命令仅授权桌面能力可调用，普通网页无可用原生开关；使用 lib/desktop-native.ts 的窄桥接导出，拒绝/取消不改变系统状态。验证：能力清单/桌面调用/网页失败三层核对。
- [ ] A5 由独立验证者运行受影响定向测试：cargo test --manifest-path src-tauri/Cargo.toml keep_awake；`node --test lib/keep-awake-service.test.mjs`；`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0180`。期望：测试、类型检查和 lint 全部通过，guard 无阻断；不得删减/跳过测试或放宽阈值。逐 A 项记录实际结果、步骤/命令、仓库外证据、对应提交和验证者标签；单元/夹具、真实 SDK/进程、浏览器、Windows 原生及视觉证据分层，缺条件记未运行，不能据此称产品验收通过。

## 范围外

C57 菜单样式、屏幕永久常亮、阻止用户手动睡眠、退出后服务和跨平台正式发布。

## 实现提示

读 docs/agents/fork-desktop.md。lib.rs/desktop-native/权限清单只追加模块注册与窄调用；Cargo 文件仅新增该能力必要依赖并保持现有锁版本，不借此升级工具链。

所列新文件为拟新增能力入口；只在这些后端/服务文件实现，UI 归对应 E2 卡。files_shared 仅少量类型/桥接/模块注册，不转移实质逻辑；不绕过现有授权与生命周期。`powercfg /requests` 需管理员终端，由用户在验证时执行并提供输出。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |
| A1 | 需用户管理员终端 powercfg /requests 实机核对；本机非管理员 powercfg /requests 返回'此命令需要管理员权限'(rc=1)；Rust 真实 Windows 后端往返测试(cargo test keep_awake_real_windows_request_round_trip)只证明 API 调用成功，不算 OS 请求列表证据，未运行桌面应用 | 未运行 | D:/pilaude/relay-evidence/PIL-0180/verify/powercfg.txt;D:/pilaude/relay-evidence/PIL-0180/verify/cargo-test.txt | 2e6d9d1 | claude:sonnet-high:verify |

## 日志

- 2026-10-21T07:23Z · codex-plus:gpt-xhigh:planner · 创建
- 2026-10-21T07:37Z · codex-plus:gpt-xhigh:planner · 做了：创建能力卡编号并完成仓库外待应用规划草案，尚未填写本卡模板 / 状态：原组件卡 PIL-0115 写入经文件接口、apply_patch、独立 Node 三次均 EPERM，按规则停止；本卡仍未冻结，不可领取，P1 为对应界面/能力依赖路径的拟定优先级 / 下一步：宿主修复既有任务文件写权限后，协调者从 planner-2026-10-21/draft-card-changes.json 核对差异与当前 tip，再由规划者应用和复核，勿直接当完成卡 / 风险：62 原卡及 parity-index 尚未修订，重叠和依赖问题未解决；未改 ACL、未运行 Git 写命令或产品测试。

- 2026-10-21T08:01Z · codex-plus:gpt-xhigh:planner · 做了：以当前磁盘与上一轮草案重建冻结前修订，补全组件状态/容差/专属交互、真实能力依赖和文件主卡；保留已有日志。P1：PIL-0171 依赖本卡，属首发能力/主组件依赖路径。 / 状态：仅 round2 草案，todo、未冻结、无实现通过证据 / 下一步：宿主协调者审阅 before/after、全板校验与交接后应用并独立复核 / 风险：参考版本/换算与实机能力仍按各卡验收取证，范围外冲突见 round2/HANDOFF.md。
- 2026-10-21T11:57Z · planner · 冻结验收标准 0ef48e1df3f8
- 2026-10-21T11:57Z · codex-plus:gpt-xhigh:impl · 领取，租约至 2026-10-21T14:57Z
- 2026-10-21T11:58Z · coord · in_progress → todo：Codex 额度耗尽约 3 小时，改由 Claude Sonnet 实现
- 2026-10-21T11:58Z · claude:sonnet-high:impl · 领取，租约至 2026-10-21T14:58Z
- 2026-10-21T12:05Z · claude:sonnet-high:impl · 做了：新增 src-tauri/src/keep_awake.rs（PowerCreateRequest+PowerSetRequest(SystemRequired)，单句柄无线程，Drop 关句柄；非 Windows 返回不支持；8 个 Rust 测试含真机往返五轮），注册 keep_awake_status/set_keep_awake 命令与权限/capability，窗口 Destroyed 与 RunEvent::Exit 释放，desktop-native 窄桥接导出，lib/keep-awake-service.ts+8 个 node 测试；windows-sys 仅追加 Power/Threading feature，Cargo.lock 未变；提交 2e6d9d1 / 状态：cargo test keep_awake、node --test、tsc、lint、guard 均通过，证据在 relay-evidence/PIL-0180/impl；未做 powercfg /requests 实机核对与托盘/退出实机 / 下一步：验证 / 风险：无 UI 消费者；SystemRequired 在 Modern Standby 机器上可能被 OS 忽略；cargo test 需存在空的 src-tauri/resources/server 与 node 目录（已清理）
- 2026-10-21T12:05Z · claude:sonnet-high:impl · in_progress → verify
- 2026-10-21T12:07Z · claude:sonnet-high:verify · 证据 A1：未运行
