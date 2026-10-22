---
id: PIL-0072
title: pi-powerline-footer 状态行接入并修复短窗叠字
epic: E8
priority: P1
status: verify
owner: claude-cli:sonnet-high:impl
lease_until: 2026-10-22T14:17Z
branch: task/PIL-0072-powerline-footer
implementers: [claude-cli:sonnet-high:impl]
depends_on: [PIL-0001]
files_allowed: [lib/builtin-powerline-extension*, components/ExtensionWidgets*, components/ExtensionStatusLine*, e2e/powerline-footer-*.mjs, next.config.ts]
files_shared: [lib/rpc-manager*, hooks/useAgentSession*, lib/agent-event-stream*, lib/agent-event-wire*, lib/types.ts, lib/session-reader*, lib/i18n/messages/*.ts, app/native-theme.css, components/ChatWindow.tsx, package.json, package-lock.json, next.config.ts, scripts/prepare-desktop.mjs, scripts/stage-package*, scripts/web-package-layout.test.mjs, scripts/release-workflows.test.mjs, THIRD_PARTY_NOTICES.md, scripts/fork-ownership.json, docs/pilaude-pi-extensions.md]
acceptance_sha: b5738af054bb
waivers: []
---

## 目标

`pi-powerline-footer` 0.20.2 的状态行在输入器上方正确显示模型与上下文信息，短窗口下不与对话内容重叠。对应 GOALS E8。

## 背景与现状

已有（WIP）：真实 model/context renderer 经 SDK/wrapper 适配 22/22，专用直显 12/12，normal 注册 1/1，实际检查三项；但 390 px 短窗口下 primary 背景透明，与后方 transcript 叠字，旧检查未覆盖这一点。LICENSE 正文缺口未解决，暂不进入 installer。

## 验收标准

- [ ] A1 复现：390 px 短窗口截图显示叠字问题，存证。
- [ ] A2 修复后同一状态下 primary 行有不透明背景、不与 transcript 重叠；检查脚本增加对重叠的断言（例如状态行与最后一条消息的包围盒不相交），并先在修复前失败。验证：`node e2e/powerline-footer-consumer.mjs`。
- [ ] A3 one-line 默认展开/收起行为与用户要求一致（默认直接显示），刷新、切换会话、重载扩展后状态正确。
- [ ] A4 LICENSE 正文缺口记录在 THIRD_PARTY_NOTICES 中，并在卡片日志里写明是否允许打包（需用户决定）。
- [ ] A5 受影响的测试文件、`node_modules/.bin/tsc --noEmit`、`npm run lint` 通过；`node scripts/relay.mjs guard` 无未豁免阻断项。

## 范围外

完整 editor / footer 替换、第三方 compaction。

## 实现提示

先读仓库根 AGENTS.md 中相关 Hard rules 与 Topic Notes。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |
| A1 | 390×340 叠字复现存证（impl/before）并经验证者复核 | 通过 | D:\pilaude\relay-evidence\PIL-0072\verify\VERIFY.md | cb654972 | claude-cli:sonnet-high:verify |
| A2 | 真实 next dev 脚本：三尺寸浅深色不透明不重叠；consumer 夹具断言修复前失败；变异去掉 serverExternalPackages 脚本失败 | 通过 | D:\pilaude\relay-evidence\PIL-0072\verify\VERIFY-2.md | cb654972 | claude-cli:sonnet-medium:verify |
| A3 | 真实层：默认直接显示，扩展重载/SSE 重连/刷新/会话往返保持，草稿保留 | 通过 | D:\pilaude\relay-evidence\PIL-0072\verify\VERIFY-2.md | cb654972 | claude-cli:sonnet-medium:verify |
| A4 | THIRD_PARTY_NOTICES 记录 manifest MIT 与无 LICENSE；卡日志记用户决定随安装包打包；stage 断言通过 | 通过 | D:\pilaude\relay-evidence\PIL-0072\verify\VERIFY-2.md | cb654972 | claude-cli:sonnet-medium:verify |

## 日志

- 2026-10-19T09:50Z · claude:opus-medium:coord · 迁移：由接力治理初始化从旧 handoff / plan / 扩展矩阵转写。
- 2026-10-19T09:50Z · claude:opus-medium:coord · 验收标准取自用户确认过的验收出口，迁移时冻结；请用户抽查。
- 2026-10-22T11:17Z · claude-cli:sonnet-high:impl · 领取，租约至 2026-10-22T14:17Z
- 2026-10-22T11:46Z · claude-cli:sonnet-high:impl · 做了：带入 wip 的 powerline 适配与 e2e，装 pi-powerline-footer@0.20.2，primary 行加不透明 CSS 与重叠断言，THIRD_PARTY_NOTICES 记 LICENSE 缺口 / 状态：分支最后提交 59655a70，A1-A5 自测完成，A4 待用户决定打包，npm test 11 失败均在基线 12 内 / 下一步：交验证 / 风险：installer 不含该包时 factory 会抛错；无 3.1623 参考，量测待参考；交接 relay-evidence/PIL-0072/impl/HANDOFF.md
- 2026-10-22T11:49Z · claude-cli:sonnet-high:impl · 缺包时跳过 powerline 扩展(不抛错,警告一次),补单测
- 2026-10-22T11:49Z · claude-cli:sonnet-high:impl · in_progress → verify
- 2026-10-22T12:11Z · claude-cli:sonnet-high:impl · verify → in_progress
- 2026-10-22T12:11Z · claude:opus:coordinator · 范围 [lib/builtin-powerline-extension*, components/ExtensionWidgets*, components/ExtensionStatusLine*, e2e/powerline-footer-*.mjs] → [lib/builtin-powerline-extension*, components/ExtensionWidgets*, components/ExtensionStatusLine*, e2e/powerline-footer-*.mjs, next.config.ts]：验证 F1：webpack 静态改写 createRequire.resolve，需把 pi-powerline-footer 加入 serverExternalPackages（同 rpiv-todo）；只允许改该数组
- 2026-10-22T12:54Z · claude-cli:sonnet-high:impl · 用户 2026-10-22 决定：pi-powerline-footer 随安装包打包（含许可信息）
- 2026-10-22T13:32Z · claude-cli:sonnet-high:impl · FIX2：真实 next dev 状态行修复（serverExternalPackages）、整包入口接入、随安装包打包、MIT 依据 manifest 记入 NOTICES；真实层脚本修复前失败/后通过；npm test 11 败均在基线
- 2026-10-22T13:33Z · claude-cli:sonnet-high:impl · in_progress → verify
- 2026-10-22T13:43Z · claude-cli:sonnet-high:verify · 证据 A1：通过
- 2026-10-22T13:43Z · claude-cli:sonnet-medium:verify · 证据 A2：通过
- 2026-10-22T13:43Z · claude-cli:sonnet-medium:verify · 证据 A3：通过
- 2026-10-22T13:43Z · claude-cli:sonnet-medium:verify · 证据 A4：通过
