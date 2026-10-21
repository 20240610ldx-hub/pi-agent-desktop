---
id: PIL-0184
title: WSL 环境发现、执行与路径隔离
epic: E4
priority: P1
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0182]
files_allowed: [lib/environment-wsl-adapter.ts, lib/environment-wsl-adapter.test.mjs, lib/environment-wsl-paths.ts, app/api/environments/wsl-targets/route.ts]
files_shared: [lib/environment-types.ts, lib/environment-runtime.ts]
acceptance_sha:
waivers: []
---

## 目标

在 Windows 真实枚举已安装 WSL 发行版，并在选定发行版/目录中执行会话工具，保持 Linux 路径与变量隔离。对应 GOALS E4，供 C58/C61 消费。

## 背景与现状

现有 cwd 不是 WSL 运行目标。用户要求真实能力先于 Run in；P1：PIL-0172/0175 的目标列表与真实选择依赖。

## 验收标准

- [ ] A1 在装有测试发行版的 Windows 实机通过 wsl.exe 枚举真实发行版/默认项/状态；未安装、无发行版、发行版失联分别返回明确空/错误，不造固定 WSL 目标。验证：实际 wsl.exe 输出与 API 列表逐项对照。
- [ ] A2 在指定发行版以指定 Linux cwd/公开变量运行命令、写入/读回测试文件，输出目标标识及 Linux 路径；其他发行版/本机不出现同一写入。验证：真实 WSL 命令/文件及 PIL-0182 会话 consumer。
- [ ] A3 路径转换区分 Linux 路径、Windows 驱动器/UNC 与无效路径，带空格/非 ASCII/元字符参数按参数传递不注入 shell；Folders 越界拒绝且变量不改宿主 process.env。验证：environment-wsl-adapter.test.mjs + 真实测试路径。
- [ ] A4 统一 gate 待批/拒绝时 WSL 命令执行计数为 0；Stop 在 5 秒内终止该测试进程而不终止其他 WSL 用户任务，发行版退出/断流后不重发也不回退本机。验证：目标 PID、旁路存活进程与会话状态。
- [ ] A5 由独立验证者运行受影响定向测试：`node --test lib/environment-wsl-adapter.test.mjs`；`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0184`。期望：测试、类型检查和 lint 全部通过，guard 无阻断；不得删减/跳过测试或放宽阈值。逐 A 项记录实际结果、步骤/命令、仓库外证据、对应提交和验证者标签；单元/夹具、真实 SDK/进程、浏览器、Windows 原生及视觉证据分层，缺条件记未运行，不能据此称产品验收通过。

## 范围外

安装/启用 WSL、管理/删除发行版、Run in UI、系统级自动启动服务和 Linux 正式发行包。

## 实现提示

读 files-and-access/fork-files-security；复用 PIL-0182 契约，environment-types 仅追加 WSL 类型。测试不得用 wsl --shutdown 停他人的进程。

所列新文件为拟新增能力入口；只在这些后端/服务文件实现，UI 归对应 E2 卡。files_shared 仅少量类型/桥接/模块注册，不转移实质逻辑；不绕过现有授权与生命周期。保持 todo 和空 acceptance_sha；本轮不实现、不 freeze，也不记录通过证据。

lib/environment-runtime.ts 为 PIL-0182 主卡文件，仅允许追加本 adapter 的导入/注册调用；不得改变公共执行契约、默认目标或其他 adapter 行为。真实环境 read/write/bash 都要在目标执行，验证目标写读和本机无写入；只远程执行 bash 不能通过。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-21T07:23Z · codex-plus:gpt-xhigh:planner · 创建
- 2026-10-21T07:37Z · codex-plus:gpt-xhigh:planner · 做了：创建能力卡编号并完成仓库外待应用规划草案，尚未填写本卡模板 / 状态：原组件卡 PIL-0115 写入经文件接口、apply_patch、独立 Node 三次均 EPERM，按规则停止；本卡仍未冻结，不可领取，P1 为对应界面/能力依赖路径的拟定优先级 / 下一步：宿主修复既有任务文件写权限后，协调者从 planner-2026-10-21/draft-card-changes.json 核对差异与当前 tip，再由规划者应用和复核，勿直接当完成卡 / 风险：62 原卡及 parity-index 尚未修订，重叠和依赖问题未解决；未改 ACL、未运行 Git 写命令或产品测试。

- 2026-10-21T08:01Z · codex-plus:gpt-xhigh:planner · 做了：以当前磁盘与上一轮草案重建冻结前修订，补全组件状态/容差/专属交互、真实能力依赖和文件主卡；保留已有日志。P1：PIL-0172、PIL-0175 依赖本卡，属首发能力/主组件依赖路径。 / 状态：仅 round2 草案，todo、未冻结、无实现通过证据 / 下一步：宿主协调者审阅 before/after、全板校验与交接后应用并独立复核 / 风险：参考版本/换算与实机能力仍按各卡验收取证，范围外冲突见 round2/HANDOFF.md。

