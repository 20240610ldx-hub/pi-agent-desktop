---
id: PIL-0185
title: Remote Control 自有主机配对与受控执行
epic: E4
priority: P1
status: parked
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0182]
files_allowed: [lib/environment-remote-adapter.ts, lib/environment-remote-adapter.test.mjs, lib/environment-peer-service.ts, lib/environment-peer-auth.ts, app/api/environment-peer/route.ts, app/api/environment-peer/events/route.ts, app/api/environments/remote-pairings/route.ts]
files_shared: [lib/environment-types.ts, lib/environment-runtime.ts]
acceptance_sha:
waivers: []
---

## 目标

在用户控制的两台/两个独立 Pilaude 主机实例之间提供显式配对的 Remote Control：列出已授权远端项目并执行任务，撤权/停止后远端不继续执行。对应 GOALS E4/E9；不依赖 Pilaude 云账号。

## 背景与现状

C40/C58 的 Remote Control 目前只有展示信息，不能用改标签替代真实目标。复用 PIL-0182 执行契约及既有请求安全；P1：C40/C58 真实远程状态/项目选择依赖。

## 验收标准

- [ ] A1 在两套隔离的受控实例显式启用并配对自有测试主机，验证挑战/身份后才可列出允许的项目；默认不对外提供远程执行，未知/过期/伪造配对请求拒绝且执行计数为 0。验证：真实双实例连线/拒绝路径，无第三方账号或云中继。
- [ ] A2 远端项目列表与状态来自已配对主机的真实授权记录；选择一个远端项目执行打印目标标记/cwd/公开变量、写文件再读取的任务，文件仅出现在远端授权根。验证：双端日志/文件、统一会话事件流与目标标识。
- [ ] A3 请求认证与项目/工具权限在远端再次验证，父端批准不能提升远端授权；越界路径/嵌套调用/撤权后续请求执行数为 0，凭据不进 SSE/日志。验证：实际双实例和 PIL-0030/0182 gate 执行计数，不用 UI 勾选证明权限。
- [ ] A4 Stop/撤权在 5 秒内终止远端测试进程，断连/失联/服务重启显示中断/失败且不自动重发；重新配对需用户显式操作，旧凭据不可复用。验证：远端 PID/请求计数、重启与撤权过程，超时如实失败。
- [ ] A5 由独立验证者运行受影响定向测试：`node --test lib/environment-remote-adapter.test.mjs`；`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0185`。期望：测试、类型检查和 lint 全部通过，guard 无阻断；不得删减/跳过测试或放宽阈值。逐 A 项记录实际结果、步骤/命令、仓库外证据、对应提交和验证者标签；单元/夹具、真实 SDK/进程、浏览器、Windows 原生及视觉证据分层，缺条件记未运行，不能据此称产品验收通过。

## 范围外

托管 Cloud/Pilaude 账号、公网中继/穿透、远程桌面视频、任意无配对主机控制、环境菜单 UI 与退出后常驻服务。

## 实现提示

使用显式配置端点和可撤销认证，读 files-and-access/fork-files-security/sessions；environment-types 只追加配对目标元数据。不要复制第三方服务协议或从参考截图提取账号/地址。

所列新文件为拟新增能力入口；只在这些后端/服务文件实现，UI 归对应 E2 卡。files_shared 仅少量类型/桥接/模块注册，不转移实质逻辑；不绕过现有授权与生命周期。保持 todo 和空 acceptance_sha；本轮不实现、不 freeze，也不记录通过证据。

lib/environment-runtime.ts 为 PIL-0182 主卡文件，仅允许追加本 adapter 的导入/注册调用；不得改变公共执行契约、默认目标或其他 adapter 行为。真实环境 read/write/bash 都要在目标执行，验证目标写读和本机无写入；只远程执行 bash 不能通过。

Remote Control 的此版产品边界是用户控制的直接可达实例，不含云账号或中继；显式启用、短期一次性配对挑战、可撤销认证与远端项目再授权必须真实可测。只允许通过受保护传输建立跨机连接；无保护的明文端点拒绝建立控制通道，环回测试也不能证明跨机保护已通过。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-21T07:23Z · codex-plus:gpt-xhigh:planner · 创建
- 2026-10-21T07:37Z · codex-plus:gpt-xhigh:planner · 做了：创建能力卡编号并完成仓库外待应用规划草案，尚未填写本卡模板 / 状态：原组件卡 PIL-0115 写入经文件接口、apply_patch、独立 Node 三次均 EPERM，按规则停止；本卡仍未冻结，不可领取，P1 为对应界面/能力依赖路径的拟定优先级 / 下一步：宿主修复既有任务文件写权限后，协调者从 planner-2026-10-21/draft-card-changes.json 核对差异与当前 tip，再由规划者应用和复核，勿直接当完成卡 / 风险：62 原卡及 parity-index 尚未修订，重叠和依赖问题未解决；未改 ACL、未运行 Git 写命令或产品测试。

- 2026-10-21T08:01Z · codex-plus:gpt-xhigh:planner · 做了：以当前磁盘与上一轮草案重建冻结前修订，补全组件状态/容差/专属交互、真实能力依赖和文件主卡；保留已有日志。P1：PIL-0154、PIL-0172 依赖本卡，属首发能力/主组件依赖路径。 / 状态：仅 round2 草案，todo、未冻结、无实现通过证据 / 下一步：宿主协调者审阅 before/after、全板校验与交接后应用并独立复核 / 风险：参考版本/换算与实机能力仍按各卡验收取证，范围外冲突见 round2/HANDOFF.md。
- 2026-10-21T12:00Z · claude:opus-medium:planner · todo → parked：用户 2026-10-21 决定首发不做（Remote Control 首发不含）
