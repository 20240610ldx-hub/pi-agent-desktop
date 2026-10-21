---
id: PIL-0183
title: SSH 环境真实执行、取消与连接恢复
epic: E4
priority: P1
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0182]
files_allowed: [lib/environment-ssh-adapter.ts, lib/environment-ssh-adapter.test.mjs, lib/environment-ssh-config.ts, app/api/environments/ssh-hosts/route.ts]
files_shared: [lib/environment-types.ts, lib/environment-runtime.ts]
acceptance_sha:
waivers: []
---

## 目标

使用户自有 SSH 主机成为真实运行目标，可靠传递远程 cwd/变量、流式结果、退出与取消，并保留主机身份校验。对应 GOALS E4，供 C58/C59 消费。

## 背景与现状

只有 SSH 对话框参考，无连接/执行服务。复用 PIL-0182 契约，显式使用用户配置的主机/凭据；P1：C58/C59 环境选择与创建依赖。

## 验收标准

- [ ] A1 使用验证者自建本地 OpenSSH 测试主机和专用测试密钥建立真实连接，远程执行 pwd/公开变量输出、写文件再读取；核对远端标记/文件和本机不存在该文件。验证：实际 SSH 进程/目标文件与流式输出，不连接真实第三方账号。
- [ ] A2 host 列表来自真实 ssh config/显式保存的环境记录，解析只读且不执行配置中的命令；未知/变更主机密钥须明确确认或拒绝，不能自动跳过 host-key 校验。验证：本地受控主机新/旧/变更指纹与拒绝后远程执行计数为 0。
- [ ] A3 身份验证失败、主机不可达、超时/断连、错误 cwd/缺权限均返回真实错误，不把失败连线显示 ready，不自动降级本机；公开测试变量正确引用，路径/变量值不插入未转义 shell。验证：实际测试主机异常路径 + 参数注入测试。
- [ ] A4 通过统一 gate 后才执行，待批/拒绝不启动远程命令；Stop 在 5 秒内停止测试远程进程及本地 ssh 子进程，断连/重连不自动重放。验证：PIL-0182 契约、远端 PID 与执行计数。
- [ ] A5 由独立验证者运行受影响定向测试：`node --test lib/environment-ssh-adapter.test.mjs`；`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0183`。期望：测试、类型检查和 lint 全部通过，guard 无阻断；不得删减/跳过测试或放宽阈值。逐 A 项记录实际结果、步骤/命令、仓库外证据、对应提交和验证者标签；单元/夹具、真实 SDK/进程、浏览器、Windows 原生及视觉证据分层，缺条件记未运行，不能据此称产品验收通过。

## 范围外

SSH UI、托管跳板/云账号、修改用户 ssh config、安装 SSH 服务、密码/私钥明文持久化。

## 实现提示

按 PIL-0182 复用执行契约；environment-types 只追加 SSH 元数据类型，不重写环境存储。环境里无 OpenSSH 测试主机时记未运行并安排受控实机验证，不能用假服务冒充。

所列新文件为拟新增能力入口；只在这些后端/服务文件实现，UI 归对应 E2 卡。files_shared 仅少量类型/桥接/模块注册，不转移实质逻辑；不绕过现有授权与生命周期。保持 todo 和空 acceptance_sha；本轮不实现、不 freeze，也不记录通过证据。

lib/environment-runtime.ts 为 PIL-0182 主卡文件，仅允许追加本 adapter 的导入/注册调用；不得改变公共执行契约、默认目标或其他 adapter 行为。真实环境 read/write/bash 都要在目标执行，验证目标写读和本机无写入；只远程执行 bash 不能通过。

SSH 仅连接用户控制的测试主机并复用系统 OpenSSH；显式确认新/变更主机密钥，不修改用户全局 ssh config，不导出私钥。配置条目中的命令不由枚举接口执行，连接仍受本卡明确的授权及 host-key 门约束。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-21T07:23Z · codex-plus:gpt-xhigh:planner · 创建
- 2026-10-21T07:37Z · codex-plus:gpt-xhigh:planner · 做了：创建能力卡编号并完成仓库外待应用规划草案，尚未填写本卡模板 / 状态：原组件卡 PIL-0115 写入经文件接口、apply_patch、独立 Node 三次均 EPERM，按规则停止；本卡仍未冻结，不可领取，P1 为对应界面/能力依赖路径的拟定优先级 / 下一步：宿主修复既有任务文件写权限后，协调者从 planner-2026-10-21/draft-card-changes.json 核对差异与当前 tip，再由规划者应用和复核，勿直接当完成卡 / 风险：62 原卡及 parity-index 尚未修订，重叠和依赖问题未解决；未改 ACL、未运行 Git 写命令或产品测试。

- 2026-10-21T08:01Z · codex-plus:gpt-xhigh:planner · 做了：以当前磁盘与上一轮草案重建冻结前修订，补全组件状态/容差/专属交互、真实能力依赖和文件主卡；保留已有日志。P1：PIL-0172、PIL-0173 依赖本卡，属首发能力/主组件依赖路径。 / 状态：仅 round2 草案，todo、未冻结、无实现通过证据 / 下一步：宿主协调者审阅 before/after、全板校验与交接后应用并独立复核 / 风险：参考版本/换算与实机能力仍按各卡验收取证，范围外冲突见 round2/HANDOFF.md。

