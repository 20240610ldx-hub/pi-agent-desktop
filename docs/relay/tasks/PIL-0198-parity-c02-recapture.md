---
id: PIL-0198
title: 复刻验收补采：C02 按钮其余尺寸、变体与交互状态
epic: E2
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0116]
files_allowed: [vendor/open-claude-ui/CdsButton.tsx, vendor/open-claude-ui/CdsButton.test.mjs]
files_shared: [app/native-theme.css]
acceptance_sha: 4a425fd04605
waivers: []
---

## 目标

PIL-0116 拆出的剩余 C02 按钮状态在补采 3.1623 原生参考后完成量测与修正。对应 GOALS E2。

## 背景与现状

用户 2026-10-22 决定：已量测部分在 PIL-0116 合入，缺参考的状态转本卡。PIL-0116 验证者未运行清单：relay-evidence/PIL-0116/verify/measurements.md。补采协议见 relay-evidence/PIL-0014/planner-2026-10-21/round3/RECAPTURE.md（Ctrl+0、原生原字节 PNG）。

## 验收标准

- [ ] A1 补齐参考后逐尺寸（xxs/xs/sm/md/lg）、逐变体（primary/secondary/ghost/danger/onContent/brand）覆盖 default、hover、pressed、focus-visible、disabled、loading，浅深两套；逐图登记来源、DPI、应用缩放、主题。缺参考的组合继续记未运行，不伪造。
- [ ] A2 同态量测按用户批准容差（盒/间距 ≤1px、基线 ≤1px、宽高比 ±1%、圆角 ≤0.5px、图标中心 ≤1px、CIEDE2000 ΔE ≤2；3.1623 原生 CSS px = 原像素 ÷1.5），给参考值/实现值/差值；含 Submit 键帽槽宽度与 sm 主按钮。
- [ ] A3 Windows 原生/WebView2 层：真机 100/125/150% DPI 与 Claude 应用缩放下不裁切；键盘与焦点恢复在真实 consumer（PilaudeDataSection 等）中复核。
- [ ] A4 由独立验证者运行 `node --test vendor/open-claude-ui/CdsButton.test.mjs components/SettingsUi.blocks.test.mjs components/SettingsUi.group-switch.test.mjs components/SettingsUi.test.mjs`、`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0198`，全部通过、guard 无阻断，不删减测试或放宽阈值。

## 范围外

PIL-0116 已验收的四个状态（除非补采显示回归）。

## 实现提示

只改 C02 分节令牌与 CdsButton；先读 PIL-0116 证据中的量测脚本复用。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志
- 2026-10-22T02:47Z · planner · 创建
- 2026-10-22T02:48Z · planner · 冻结验收标准 4a425fd04605
