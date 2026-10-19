---
id: PIL-0111
title: Windows 原生验收基线
epic: E11
priority: P1
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: []
files_allowed: [e2e/native-*.mjs, e2e/*.ps1, docs/pilaude-windows-regression.md]
files_shared: []
acceptance_sha: 
waivers: []
---

## 目标

建立一套在 Windows 桌面构建上重复执行的原生检查：WebView2、DPI 缩放、剪贴板、外部编辑器打开、独立窗口、托盘与退出。对应 GOALS E11 与 E2。

## 背景与现状

此前大部分验收在浏览器预览中完成，Windows 原生多项"未验"。已有零散脚本：`e2e/native-*.mjs`、`e2e/native-window-probe.ps1`。

## 验收标准

- [ ] A1 规划者补全：列出原生检查项、采集方式（截图、进程列表、剪贴板读回）和 DPI 组合。

## 范围外

Windows 10/11 干净机器的耐久测试（属 PIL-0110 的发布门槛）。

## 实现提示

先读仓库根 AGENTS.md 中相关 Hard rules 与 Topic Notes。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-19T09:50Z · claude:opus-medium:coord · 迁移：由接力治理初始化从旧 handoff / plan / 扩展矩阵转写。
- 2026-10-19T09:50Z · claude:opus-medium:coord · 草稿：验收需规划者核实现状后补全并冻结。
