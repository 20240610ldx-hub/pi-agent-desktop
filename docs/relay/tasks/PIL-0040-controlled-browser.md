---
id: PIL-0040
title: 受控浏览器
epic: E5
priority: P1
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0030]
files_allowed: [lib/browser*, app/api/browser/**]
files_shared: []
acceptance_sha:
waivers: []
---

## 目标

智能体可以操作一个可见的专用 Chromium：导航、阅读、截图、点击、输入、标签页、下载、取消和人工接管；未审批的提交和上传计数为 0。对应 GOALS E5。

## 背景与现状

Plan Task 5 与 Spec 第 9 节定义了要求；当前实现状态未核实。

## 验收标准

- [ ] A1 规划者补全：核实现状，按 Plan Task 5 拆成若干卡（引擎打包、工具注册、审批、恢复）。

## 范围外

绕过网站登录、验证码或付费限制。

## 实现提示

先读仓库根 AGENTS.md 中相关 Hard rules 与 Topic Notes。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-19T09:50Z · claude:opus-medium:coord · 迁移：由接力治理初始化从旧 handoff / plan / 扩展矩阵转写。
- 2026-10-19T09:50Z · claude:opus-medium:coord · 草稿：验收需规划者核实现状后补全并冻结。
- 2026-10-21T12:27Z · claude:opus-medium:planner · 用户 2026-10-21 决定：引擎改为内嵌 WebView2 子 webview + playwright-core 附着（修订 Spec 9；Tauri unstable 由 spike 决定，失败回退系统 Edge 独立窗口）；不导入日常浏览器 Cookie，受控浏览器内每项目独立 profile 手动登录；域名授权项目级、首次访问审批，提交/上传逐次审批；首发只验 Windows。调研见 relay-evidence/PIL-0040/research-2026-10-21/PROPOSAL.md
- 2026-10-21T12:30Z · claude:sonnet-high:planner · 规划者已拆分子卡（均未冻结）：PIL-0191 引擎与 pane 内核（含 spike）；PIL-0192 会话核心与工具注册；PIL-0193 提交/上传/导航审批门（依赖 PIL-0030）；PIL-0194 标签页与下载；PIL-0195 人工接管/取消/恢复；PIL-0196 pane 桥接契约。依赖链 0191→0192→0193→{0194,0195}→0196→PIL-0165。PIL-0165 的 depends_on 需加 PIL-0196，由协调者处理。本卡保持伞卡，A1 随拆分完成。
