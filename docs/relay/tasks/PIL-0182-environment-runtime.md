---
id: PIL-0182
title: 环境执行契约与本机真实运行路由
epic: E4
priority: P1
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0181, PIL-0030]
files_allowed: [lib/environment-runtime.ts, lib/environment-runtime.test.mjs, lib/environment-local-adapter.ts, lib/environment-session-routing.ts, lib/environment-execution-contract.ts, app/api/environments/[id]/run/route.ts]
files_shared: [lib/rpc-manager.ts, lib/types.ts, app/api/agent/new/route.ts]
acceptance_sha:
waivers: []
---

## 目标

让环境选择成为真实会话执行路由：先完成本机 adapter，再给 SSH/WSL/Remote 提供同一个权限/取消/输出契约；environmentId、cwd、Folders 和变量被工具实际消费。对应 GOALS E4。

## 背景与现状

当前只传 cwd，不能靠给菜单改名实现运行目标。PIL-0181 提供配置，PIL-0030 提供 gate；P1：三种目标 adapter 和 C58/C61/C62 依赖此契约。

## 验收标准

- [ ] A1 新建真实 Pi 会话并指定 Local environmentId，从配置快照构造工具执行服务；执行一个打印 cwd/公开测试变量、写入测试文件再读取的任务，输出和文件都属于该目标。验证：真实 SDK/本机进程/测试文件；只选菜单值或 mock adapter 不算消费。
- [ ] A2 所有 adapter 调用 read/write/bash 之前通过 PIL-0030 gate，拒绝/待批时进程启动与文件写入计数为 0；不得让远端 adapter 绕过路径/工具上限。验证：统一契约测试覆盖直接、子任务与拒绝/撤权，真实本机目标单独核验。
- [ ] A3 每会话使用环境变量隔离快照并将 Folders 按已授权根传入，不改全局 process.env；两个并发会话同名变量互不串，环境不存在/被删除/版本失效明确拒绝而不退回本机默认 cwd。验证：实际双会话/双进程输出和落盘结果。
- [ ] A4 输出事件包含 sessionId/目标和严格完成/退出状态，流式 stdout/stderr/退出码不丢失；Stop/连接失败/服务重启不会重放请求，停止后目标测试进程在约定 5 秒内退出，超时失败可见。验证：真实长运行子进程 + 断流/取消步骤，夹具补迟到事件。
- [ ] A5 契约允许独立注册 Local/SSH/WSL/Remote adapter；未实现/不可用目标返回 unsupported/unavailable，不执行备用本机命令。验证：node --test lib/environment-runtime.test.mjs 契约及真实 Local consumer；后续 adapter 复用同一测试契约。
- [ ] A6 由独立验证者运行受影响定向测试：`node --test lib/environment-runtime.test.mjs`；`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0182`。期望：测试、类型检查和 lint 全部通过，guard 无阻断；不得删减/跳过测试或放宽阈值。逐 A 项记录实际结果、步骤/命令、仓库外证据、对应提交和验证者标签；单元/夹具、真实 SDK/进程、浏览器、Windows 原生及视觉证据分层，缺条件记未运行，不能据此称产品验收通过。

## 范围外

环境菜单/表单、SSH/WSL/Remote adapter 实现、自建授权门、修改全局运行环境或自动重新发送中断请求。

## 实现提示

读 docs/agents/tools.md、sessions.md、fork-sessions.md、files-and-access.md。rpc-manager/new route/types 只追加环境服务工厂调用/可选 environmentId 字段；实质路由在新模块，保持默认本机会话行为与已有启动锁。

所列新文件为拟新增能力入口；只在这些后端/服务文件实现，UI 归对应 E2 卡。files_shared 仅少量类型/桥接/模块注册，不转移实质逻辑；不绕过现有授权与生命周期。保持 todo 和空 acceptance_sha；本轮不实现、不 freeze，也不记录通过证据。

执行契约由本卡唯一维护 lib/environment-execution-contract.ts；后续 adapter 在自己的模块导出工厂，通过既有适配器注册接口接入，不编辑其他 adapter。所有 read/write/bash（含扩展、子会话和定时任务路径）沿统一 gate 判断目标根，不能只给命令行传 cwd 而把文件工具留在本机。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-21T07:23Z · codex-plus:gpt-xhigh:planner · 创建
- 2026-10-21T07:37Z · codex-plus:gpt-xhigh:planner · 做了：创建能力卡编号并完成仓库外待应用规划草案，尚未填写本卡模板 / 状态：原组件卡 PIL-0115 写入经文件接口、apply_patch、独立 Node 三次均 EPERM，按规则停止；本卡仍未冻结，不可领取，P1 为对应界面/能力依赖路径的拟定优先级 / 下一步：宿主修复既有任务文件写权限后，协调者从 planner-2026-10-21/draft-card-changes.json 核对差异与当前 tip，再由规划者应用和复核，勿直接当完成卡 / 风险：62 原卡及 parity-index 尚未修订，重叠和依赖问题未解决；未改 ACL、未运行 Git 写命令或产品测试。

- 2026-10-21T08:01Z · codex-plus:gpt-xhigh:planner · 做了：以当前磁盘与上一轮草案重建冻结前修订，补全组件状态/容差/专属交互、真实能力依赖和文件主卡；保留已有日志。P1：PIL-0172、PIL-0175、PIL-0176、PIL-0183、PIL-0184、PIL-0185 依赖本卡，属首发能力/主组件依赖路径。 / 状态：仅 round2 草案，todo、未冻结、无实现通过证据 / 下一步：宿主协调者审阅 before/after、全板校验与交接后应用并独立复核 / 风险：参考版本/换算与实机能力仍按各卡验收取证，范围外冲突见 round2/HANDOFF.md。

