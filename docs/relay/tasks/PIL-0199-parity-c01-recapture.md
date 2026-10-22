---
id: PIL-0199
title: 复刻验收补采：C01 主题切换、字体回退、图标与窄窗等状态
epic: E2
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0115]
files_allowed: [components/PilaudeIcon.tsx, hooks/useChatAppearance.ts, components/ChatAppearance.test.mjs]
files_shared: [app/native-theme.css]
acceptance_sha: db09b2f85583
waivers: []
---

## 目标

PIL-0115 拆出的剩余 C01 状态在补采 3.1623 原生参考后完成量测与修正。对应 GOALS E2。

## 背景与现状

用户 2026-10-22 拆卡决定。PIL-0115 验证未运行清单：relay-evidence/PIL-0115/verify/VERIFY-LOG.md。补采协议见 relay-evidence/PIL-0014/planner-2026-10-21/round3/RECAPTURE.md。已知残差：PilaudeIcon 描边 1.55 与上游 1.8/2 不一致；各 consumer disabled 不透明度 0.35/0.45/0.5 不统一；markdown 行高 `line-height:1.6` 旧规则与 C01 分节双源。

## 验收标准

- [ ] A1 补采后覆盖主题切换器（浅/深/跟随系统）各状态、中英文/数字/标点字体回退、图标尺寸与描边、图标 disabled 色、窄窗（约 800px）；逐图登记来源、DPI、应用缩放、主题。缺参考的组合继续记未运行。
- [ ] A2 同态量测按用户批准容差（CIEDE2000 ΔE ≤2、盒/间距/基线 ≤1px、圆角 ≤0.5px、图标中心 ≤1px；3.1623 原生 CSS px = 原像素 ÷1.5），给参考值/实现值/差值；统一 disabled 色令牌与图标描边，删除 markdown 行高旧规则双源。
- [ ] A3 主题切换器键盘进入/切换/返回与焦点恢复；Windows 原生 100/125/150% DPI 与 Claude 应用缩放层核验。
- [ ] A4 由独立验证者运行 `node --test components/ChatAppearance.test.mjs`、`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0199`，全部通过、guard 无阻断，不删减测试或放宽阈值。

## 范围外

侧栏消费者（归 PIL-0147）；PIL-0115 已验收状态（除非补采显示回归）。

## 实现提示

只改 C01 分节与 files_allowed；复用 PIL-0115 证据中的量测脚本。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志
- 2026-10-22T02:53Z · planner · 创建
- 2026-10-22T02:54Z · planner · 冻结验收标准 db09b2f85583
- 2026-10-22T03:00Z · claude:opus-medium:planner · PIL-0115 评审建议：native-theme.css 约 5080 行 .markdown-body 旧 line-height:1.6 已成死规则，本卡清理双源时删除。
