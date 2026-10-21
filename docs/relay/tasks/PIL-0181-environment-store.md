---
id: PIL-0181
title: 环境配置、Folders 与变量作用域持久化
epic: E3
priority: P1
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0030]
files_allowed: [lib/environment-types.ts, lib/environment-store.ts, lib/environment-store.test.mjs, lib/environment-variables.ts, lib/environment-variables.test.mjs, app/api/environments/route.ts, app/api/environments/[id]/route.ts, app/api/environments/[id]/folders/route.ts, app/api/environments/[id]/variables/route.ts]
files_shared: []
acceptance_sha: eb08ed7e3c8c
waivers: []
---

## 目标

建立本地环境记录、Folders 与环境级变量的真实持久化和校验，供 C58–C62 建立/编辑/恢复；所有保存值有明确隔离作用域。环境记录为用户级（存 Pilaude 用户数据根，所有项目可列出），项目与会话只保存 environmentId 引用，不复制内容；Folders 与执行仍受项目授权约束。对应 GOALS E3（凭据加密）与 E9。

## 背景与现状

现有 cwd/本机信息不等于环境配置，尚无环境变量子页 consumer。用户要求先建能力卡；本卡只做配置服务，不把保存记录当远程执行成功。windowsCredentialCipher() 与 lib/pilaude-data.ts 已存在，故不依赖 PIL-0020 桩卡。Remote Control 首发不含（用户 2026-10-21 决定，PIL-0185 parked）。P1：PIL-0182 与 C58–C62 依赖。

## 验收标准

- [ ] A1 API 真实创建/列出/编辑/删除专用测试 Local/SSH/WSL 环境记录（类型枚举保留扩展位，首发不创建 Remote 记录），校验名称/类型/标识并原子保存到 Pilaude 用户数据根；服务重启能还原，坏文件报告错误且不覆盖原文件。删除测试记录只操作独立测试数据根，真实用户记录的删除遵循既有确认门。验证：接口步骤、隔离数据根落盘/重启及 node --test lib/environment-store.test.mjs。
- [ ] A2 Folders API 规范化本机目录、去重且保序；不存在/无权/越界符号链接返回明确错误，取消不落盘；远程路径按目标语义存储，不拿本机 path 校验冒充远端存在。验证：真实测试目录/链接、API 错误及重启前后记录。
- [ ] A3 变量语法固定为每个非空行 KEY=VALUE，在第一个等号处分割；KEY 匹配 [A-Za-z_][A-Za-z0-9_]*，保留 VALUE 的空格及后续等号，允许空 VALUE；坏格式/非法键/重复键报明确行号且整次保存不落盘；不执行 shell 展开。更新时未更改的遮蔽字段使用显式保留标记，展示占位符不能被保存为值。存为 environmentId 专属覆盖，不改 process.env 或其他环境；生产持久化不明文保存变量值，复用现有受保护凭据机制，API 展示/错误/日志脱敏。验证：lib/environment-variables.test.mjs（逐条语法/行号/保留标记用例）+ 真实隔离存储的字节/日志检查。
- [ ] A4 实际配置 consumer 按 environmentId 解析 Folders/变量快照，两个环境的同名变量互不串；空/缺失/删除/取消返回可区分状态，当前会话持有版本不会被静默换到其他环境。验证：真实服务两环境读写/重启与解析调用；执行消费另由 PIL-0182 验。
- [ ] A5 接口遵循现有请求安全；环境记录为用户级，项目与会话只保存 environmentId 引用。执行与 Folders 受项目授权约束：环境 Folders 中不在目标项目授权根内的目录不被当作该项目的可写根（越界按 PIL-0030 处理）；变量明文只由执行服务按 environmentId 解析，API 只返回遮蔽值。验证：用未授权项目 cwd 读取变量明文或借环境越权写入被拒绝，写入与执行计数为 0。不得复制真实账号/个人路径或用 mock API 冒充存储。
- [ ] A6 由独立验证者运行受影响定向测试：`node --test lib/environment-store.test.mjs lib/environment-variables.test.mjs`；`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0181`。期望：测试、类型检查和 lint 全部通过，guard 无阻断；不得删减/跳过测试或放宽阈值。逐 A 项记录实际结果、步骤/命令、仓库外证据、对应提交和验证者标签；单元/夹具、真实 SDK/进程、浏览器、Windows 原生及视觉证据分层，缺条件记未运行，不能据此称产品验收通过。

## 范围外

环境 UI、远程连接/认证、运行命令、Pilaude 云账号与托管存储；不新增另一套凭据加密。

## 实现提示

读 docs/agents/files-and-access.md、fork-files-security.md、models.md。直接复用 lib/credential-store.ts 与 lib/pilaude-data.ts 现有导出。用 userHome 路由 Pi 数据、systemHome 做授权显示；直接复用 lib/credential-store.ts 导出的 windowsCredentialCipher().protect/unprotect，为变量写独立的加密文件，不把环境键伪装成 provider credential，也不改现有 auth.json。

所列新文件为拟新增能力入口；只在这些后端/服务文件实现，UI 归对应 E2 卡。files_shared 仅少量类型/桥接/模块注册，不转移实质逻辑；不绕过现有授权与生命周期。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-21T07:23Z · codex-plus:gpt-xhigh:planner · 创建
- 2026-10-21T07:37Z · codex-plus:gpt-xhigh:planner · 做了：创建能力卡编号并完成仓库外待应用规划草案，尚未填写本卡模板 / 状态：原组件卡 PIL-0115 写入经文件接口、apply_patch、独立 Node 三次均 EPERM，按规则停止；本卡仍未冻结，不可领取，P1 为对应界面/能力依赖路径的拟定优先级 / 下一步：宿主修复既有任务文件写权限后，协调者从 planner-2026-10-21/draft-card-changes.json 核对差异与当前 tip，再由规划者应用和复核，勿直接当完成卡 / 风险：62 原卡及 parity-index 尚未修订，重叠和依赖问题未解决；未改 ACL、未运行 Git 写命令或产品测试。

- 2026-10-21T08:01Z · codex-plus:gpt-xhigh:planner · 做了：以当前磁盘与上一轮草案重建冻结前修订，补全组件状态/容差/专属交互、真实能力依赖和文件主卡；保留已有日志。P1：PIL-0154、PIL-0172、PIL-0173、PIL-0174、PIL-0176、PIL-0182 依赖本卡，属首发能力/主组件依赖路径。 / 状态：仅 round2 草案，todo、未冻结、无实现通过证据 / 下一步：宿主协调者审阅 before/after、全板校验与交接后应用并独立复核 / 风险：参考版本/换算与实机能力仍按各卡验收取证，范围外冲突见 round2/HANDOFF.md。
- 2026-10-21T12:33Z · claude:sonnet-high:planner · 冻结前修订第3轮：明确环境记录用户级（项目只存 environmentId 引用）；Folders/执行受项目授权；删除 →PIL-0020（所需导出已存在）；Epic 改 E3；G3 变量语法/行号报错/保留标记移入 A3；Remote 首发不含；G6 删除过期文字
- 2026-10-21T12:39Z · planner · 冻结验收标准 eb08ed7e3c8c
