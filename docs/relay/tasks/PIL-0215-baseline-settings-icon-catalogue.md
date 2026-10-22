---
id: PIL-0215
title: 修复子 agent 标签图标与推荐扩展目录数量测试
epic: E0
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0002]
files_allowed: [components/SettingsPanel.tsx, components/SettingsPanel.test.mjs, components/RecommendedPiExtensions.tsx, components/RecommendedPiExtensions.test.mjs]
files_shared: []
acceptance_sha:
waivers: []
---

## 目标

让下列 Windows 基线失败用例通过且不引入新失败，使 `npm test` 基线可信（GOALS E11 Windows 基线）。

## 背景与现状

来源：PIL-0002 基线文档 `docs/relay/test-baseline.md`（证据 `D:/pilaude/relay-evidence/PIL-0002/impl/npm-test-bounded-cache.log`）。

- 失败测试：uses the child-session robot glyph for the sub-agents tab；desktop catalogue shows eight reviewed packages and offers only four optional source choices
- 测试文件：components/SettingsPanel.test.mjs、components/RecommendedPiExtensions.test.mjs
- 原因与归类：日志首行：SettingsPanel 为 `The input did not match the regular expression /<rect x="5" y="7" width="14" height="11" rx="2" />…/`（机器人图标路径缺失，upstream 通过，fork 回归）；RecommendedPiExtensions 为 `Expected values to be strictly equal: 3 !== 4`（可选来源选项 3 个，期望 4；upstream 无此测试，fork 自有测试，既有缺陷）。
- 复现：`node --test <测试文件>`

## 验收标准

- [ ] A1 上列失败测试全部通过。验证：对 components/SettingsPanel.test.mjs、components/RecommendedPiExtensions.test.mjs 逐个运行 `node --test <文件>` 退出码 0。
- [ ] A2 `npm test` 相对 PIL-0002 基线无新增失败，且基线中属本卡的用例消失。验证：全量运行并与基线文档对比失败名单。
- [ ] A3 不删除、跳过或放宽任何断言；`npm run lint`、`node_modules/.bin/tsc --noEmit` 通过；`node scripts/relay.mjs guard` 无阻断项。

## 范围外

基线文档列出的其他失败用例；与上述用例无关的重构。

## 实现提示

确认设计意图后二选一：恢复图标/第四个可选来源，或在有依据时更新测试期望并在卡日志说明依据（须用户或规划者批准，不得单方弱化断言）。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志
- 2026-10-22T11:19Z · planner · 创建
- 2026-10-22T11:30Z · claude-cli:sonnet-medium:impl · 由 PIL-0002 基线 A4 转出，写入目标、背景与验收（未冻结）
