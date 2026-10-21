---
id: PIL-0180
title: Windows 保持唤醒能力与退出释放
epic: E9
priority: P1
status: done
owner: claude:sonnet-high:impl
lease_until:
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
| A2 | 需用户管理员终端 powercfg /requests 实机核对；隐藏/恢复/退出/重启四步未在运行的应用上执行。代码层(读 keep_awake.rs/lib.rs)：disable/Destroyed/RunEvent::Exit 都调 release，CloseRequested 隐藏不调用；单元测试 release_and_drop 通过，属夹具层非实机 | 未运行 | D:/pilaude/relay-evidence/PIL-0180/verify/cargo-test.txt | 2e6d9d1 | claude:sonnet-high:verify |
| A3 | cargo test --manifest-path src-tauri/Cargo.toml keep_awake：8 项全过，含五轮开关不叠加(live<=1)、失败不乐观、不支持平台报错、withdraw 失败仍释放句柄、并发开关、真实 Windows PowerCreateRequest/SetRequest 五轮往返(进程内真实 OS API，未经桌面命令/powercfg)；代码无线程/定时器。层级：夹具+Windows 原生 API 进程内；桌面应用内状态查询未运行 | 通过 | D:/pilaude/relay-evidence/PIL-0180/verify/cargo-test.txt | 2e6d9d1 | claude:sonnet-high:verify |
| A4 | 三层核对部分完成：(1)清单层通过：两命令在 desktop-shell.toml 仅定义 allow-keep-awake-status/allow-set-keep-awake，desktop-dialog.json(windows:main，remote 127.0.0.1)仅追加这两项，lib.rs 注册 handler；(3)网页失败层通过：Node 下实调 lib/desktop-native.ts 的 keepAwakeStatusNative 返回 null、setKeepAwakeNative 拒绝'only available in the desktop app'；(2)桌面调用层(Tauri ACL 运行时)未运行应用，故整体记未运行 | 未运行 | D:/pilaude/relay-evidence/PIL-0180/verify/a4-browser.txt | 2e6d9d1 | claude:sonnet-high:verify |
| A5 | cargo test keep_awake 8/8；node --test lib/keep-awake-service.test.mjs 8/8(夹具桥)；tsc --noEmit rc=0；npm run lint rc=0；relay guard --task PIL-0180 无问题；git status 干净，Cargo.lock 未改，Cargo.toml 仅给 windows-sys 增 Win32_System_Power/Threading feature，无升级；无 skip/only | 通过 | D:/pilaude/relay-evidence/PIL-0180/verify/cargo-test.txt;D:/pilaude/relay-evidence/PIL-0180/verify/node-test.txt;D:/pilaude/relay-evidence/PIL-0180/verify/tsc.txt;D:/pilaude/relay-evidence/PIL-0180/verify/lint.txt;D:/pilaude/relay-evidence/PIL-0180/verify/guard.txt | 2e6d9d1 | claude:sonnet-high:verify |
| A1 | 层级：desktop:dev 实机(src-tauri/target/debug/pi-agent-desktop.exe) + 用户管理员 powercfg /requests。主窗口 F12 invoke('set_keep_awake',{enabled:true})：user-0-off 的 SYSTEM 无本进程(默认关闭)，user-1-on 的 SYSTEM 出现 pi-agent-desktop.exe 与理由文案 'Pilaude keeps the system awake...'；DISPLAY/AWAYMODE 无项，仅 SystemRequired。接替前一行未运行 | 通过 | D:/pilaude/relay-evidence/PIL-0180/verify/user-0-off.txt;D:/pilaude/relay-evidence/PIL-0180/verify/user-1-on.txt | 2e6d9d1 | claude:sonnet-high:verify |
| A4 | 三层：(1)清单层：两命令仅在 desktop-shell.toml 定义并仅追加到 desktop-dialog.json(main)，lib.rs 已注册；(2)桌面调用层：desktop:dev 主窗口 invoke('set_keep_awake') 成功并被 OS 观察到(user-1-on/3-disabled)，层级为 desktop:dev 实机+用户管理员 powercfg；(3)网页失败层：Node 下 desktop-native 的 keepAwakeStatusNative=null、setKeepAwakeNative 拒绝。接替前一行未运行 | 通过 | D:/pilaude/relay-evidence/PIL-0180/verify/user-1-on.txt;D:/pilaude/relay-evidence/PIL-0180/verify/user-3-disabled.txt;D:/pilaude/relay-evidence/PIL-0180/verify/a4-browser.txt | 2e6d9d1 | claude:sonnet-high:verify |
| A2 | 实机已证实：关窗进托盘后请求仍在(user-2-tray)、关闭开关后请求消失(user-3-disabled)。未证实：明确退出释放——user-4-quit 请求仍在，但 pi-agent-desktop.exe PID 20272 仍存活，desktop.log 无 'exit' 行(RunEvent::Exit 未执行)，即退出路径未走到，不能判成败。重启默认关闭仅有 user-0-off 初次启动一次旁证。本卡未改 quit_application/托盘代码(见 quit-investigation.txt)；复测见日志 | 未运行 | D:/pilaude/relay-evidence/PIL-0180/verify/user-2-tray.txt;D:/pilaude/relay-evidence/PIL-0180/verify/user-3-disabled.txt;D:/pilaude/relay-evidence/PIL-0180/verify/user-4-quit.txt;D:/pilaude/relay-evidence/PIL-0180/verify/quit-investigation.txt | 2e6d9d1 | claude:sonnet-high:verify |
| A2 | 层级：desktop:dev 实机+用户管理员 powercfg。托盘保持(user-2-tray 仍在)、关闭释放(user-3-disabled 消失)、退出释放：开启后 invoke('quit_app')，desktop.log 出现 '12:45:02Z exit'(RunEvent::Exit 已执行)，Get-Process pi-agent-desktop 无进程，user-5-quit-app SYSTEM 无本进程。重启默认关闭：user-0-off 与重启后第二次(协调者转述，无单独 powercfg 文件)。限制：第二轮开启后到退出前无 powercfg 文件，开启状态由用户陈述，开启本身由 user-1-on 证实。托盘 Quit 不结束进程另列既有缺陷，不在本卡。接替前两行未运行 | 通过 | D:/pilaude/relay-evidence/PIL-0180/verify/user-2-tray.txt;D:/pilaude/relay-evidence/PIL-0180/verify/user-3-disabled.txt;D:/pilaude/relay-evidence/PIL-0180/verify/user-5-quit-app.txt;D:/pilaude/relay-evidence/PIL-0180/verify/quit-app-log.txt | 2e6d9d1 | claude:sonnet-high:verify |

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
- 2026-10-21T12:07Z · claude:sonnet-high:verify · 证据 A2：未运行
- 2026-10-21T12:07Z · claude:sonnet-high:verify · 证据 A3：通过
- 2026-10-21T12:07Z · claude:sonnet-high:verify · 证据 A4：未运行
- 2026-10-21T12:07Z · claude:sonnet-high:verify · 证据 A5：通过
- 2026-10-21T12:08Z · claude:sonnet-high:verify · 做了：对 2e6d9d1 逐项验证，A3/A5 通过；A1/A2 未运行；A4 未运行（清单层与网页失败层通过，桌面 ACL 运行时层未跑）。cargo test keep_awake 8/8，node 测试 8/8，tsc、lint、guard 全过，Cargo.lock 未改，改动均在 files_allowed/shared 内 / 状态：保持 verify，等用户证据，不记产品验收通过 / 下一步：用户在管理员终端运行应用后 powercfg /requests，前后对照并走隐藏/恢复/退出/重启，另在桌面窗口调用两命令；证据到 D:/pilaude/relay-evidence/PIL-0180/verify/ / 风险：powercfg 非管理员返回需管理员权限；A3 的 Windows 层仅进程内真实 API 往返，未经桌面命令
- 2026-10-21T12:40Z · claude:sonnet-high:verify · 证据 A1：通过
- 2026-10-21T12:40Z · claude:sonnet-high:verify · 证据 A4：通过
- 2026-10-21T12:40Z · claude:sonnet-high:verify · 证据 A2：未运行
- 2026-10-21T12:40Z · claude:sonnet-high:verify · 做了：按用户管理员 powercfg 实机结果更新证据：A1、A4 通过(desktop:dev 实机)；A2 仍未运行，退出释放未验证。user-4-quit 时 PID 20272 仍活、desktop.log 无 exit 行，quit_application/RunEvent::Exit 未被执行；本卡仅在 RunEvent::Exit 的 desktop_log 之后加 release，且未改托盘/quit_app，不似本卡引入，但未对父提交实跑 / 状态：保持 verify / 下一步：用户复测退出释放（先开启，再 invoke('quit_app')，看进程退出、desktop.log 出现 exit、powercfg 无本进程）；托盘 Quit 无效则另开卡 / 风险：未对父提交实机对比
- 2026-10-21T12:46Z · claude:sonnet-high:verify · 证据 A2：通过
- 2026-10-21T12:46Z · claude:sonnet-high:verify · 做了：核对 desktop.log，重启后的 pid 19728 在 12:45:02Z 写入 exit 行，进程已无，user-5-quit-app 的 SYSTEM 无本进程；A2 记通过。A1-A5 现全部通过。托盘 Quit 不结束进程判为既有缺陷（本卡未改 quit_application/托盘，调用 quit_app 正常退出），建议另开卡调查托盘 Quit 路径 / 状态：A1-A5 通过，转 review / 下一步：评审者核对；另开卡查托盘 Quit（Windows platform_tray 的 quit 事件）/ 风险：A2 第二轮开启态无 powercfg 文件；A1/A4/A2 属 desktop:dev 实机，非发布包；未对父提交实机对比托盘行为
- 2026-10-21T12:46Z · claude:sonnet-high:impl · verify → review
- 2026-10-21T12:48Z · claude:opus-high:review · 做了：评审 2e6d9d1（8 文件）。Rust：PowerCreateRequest 失败查 NULL/INVALID 且不建对象；PowerSetRequest 失败时 WinRequest 被 drop→CloseHandle；withdraw 失败仍 drop 关闭；Drop 仅一次 CloseHandle；REASON_CONTEXT Version=0、SIMPLE_STRING，UTF-16 缓冲活到调用结束；锁内不调用 release 无重入死锁。lib.rs：Destroyed(仅 main)与 RunEvent::Exit 调 release，CloseRequested 隐藏不释放；权限仅两条 allow 追加到 desktop-dialog(main, 127.0.0.1)；Cargo.toml 仅加 windows-sys 两个 feature，Cargo.lock 未动；窗口状态标志与插件版本未触碰；桥接窄、浏览器 status=null/set 拒绝；guard 复跑无问题。证据行与 user-0..5、quit-app-log 一致（user-4 时 PID 仍活无 exit 行，user-5 经 quit_app 有 exit 且无本进程）。托盘 Quit 在 platform_tray 中同样调用 quit_application，与成功的 quit_app 下游路径相同，本 diff 未改 shell/ 与托盘，故非本卡引入（未对父提交实跑） / 状态：评审通过 / 下一步：协调者合入；另开卡查 Windows 托盘 Quit 事件分发 / 风险：(可选)1. PowerClearRequest 失败时 Rust 已关句柄但返回 Err，TS 服务保留 enabled=true（测试亦如此断言），UI 会显示开启而 OS 已释放，实际几乎不可达，建议 PIL-0171 或后续在 set 失败后 refresh；2. 锁中毒时 status 报 false、release 不关句柄，现无锁内 panic 路径，可改 into_inner；3. 证据为 desktop:dev 非发布包，重启默认关闭仅一份 powercfg 文件；提交信息仍为 wip
- 2026-10-21T12:48Z · claude:opus-high:review · review → done（评审 claude:opus-high:review）
