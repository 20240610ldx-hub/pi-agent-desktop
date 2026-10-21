---
id: PIL-0195
title: 受控浏览器人工接管、取消与恢复
epic: E5
priority: P1
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0192, PIL-0193]
files_allowed: [lib/managed-browser-takeover*.ts, lib/managed-browser-recovery*.ts, lib/managed-browser-takeover*.test.mjs, lib/managed-browser-recovery*.test.mjs, e2e/managed-browser-recovery*.mjs, app/api/browser/takeover/**, src-tauri/src/managed_browser_lifecycle*.rs]
files_shared: [lib/managed-browser.ts, lib/managed-browser-tools.ts, src-tauri/src/lib.rs, lib/i18n/messages/*.ts]
acceptance_sha:
waivers: []
---

## 目标

用户可以随时接管受控浏览器（手动登录、处理验证码），交还后智能体从重新观察继续；任何时点取消都不重复执行动作；子 webview 崩溃、CDP 断线、应用退出都能恢复或干净回收。对应 [GOALS](../GOALS.md) E5「取消、人工接管」。

## 背景与现状

- 用户 2026-10-21 决定：不导入 Cookie，每项目独立 profile 在受控浏览器内手动登录，因此接管是登录的唯一途径；profile 随崩溃保留。
- [Spec 第 9 节](../../superpowers/specs/2026-10-16-pilaude-spec.md)：审批等待不重复动作；页面改变导致定位不唯一时重新观察；超时、崩溃、关闭窗口、下载取消和应用退出可传播取消；本应用创建的浏览器进程必须被回收。[Spec 第 11 节](../../superpowers/specs/2026-10-16-pilaude-spec.md)：一个幂等 shutdown 依次停止调度、审批、agent、browser 和拥有的子进程。
- 依赖 PIL-0192 的会话与工具、PIL-0193 的审批等待（取消要能打断审批等待）。引擎生命周期来自 PIL-0191。
- pane 上「接管/交还」按钮由 PIL-0196/0165 呈现；本卡提供状态机与 API。

## 验收标准

- [ ] A1 接管状态机：接管期间任意模型工具调用执行计数为 0 并返回「用户接管中」；交还后所有旧 ref 与页面版本失效，首次动作前必须先 observe；接管/交还事件写入会话记录。验证：状态机单元测试 + 本地站点集成测试。
- [ ] A2 取消：审批等待中、动作执行中、页面加载中各取消一次，不重复执行、不遗留待批卡、状态回到 idle；点击已发出后取消，结果如实报告「动作已发出，后续步骤已取消」。验证：取消时点矩阵，页面侧事件计数。
- [ ] A3 恢复：杀掉子 webview、断开 CDP、WebView2 崩溃各一次，自动重连至多一次，仍失败则会话标 `lost` 并返回可读错误；profile（含已登录 cookie）保留，重建后同项目仍是登录态。验证：故障注入 + 登录态对账。
- [ ] A4 退出回收：应用明确退出与进程被异常终止后重启，用 `tasklist` 核对没有本应用遗留的浏览器进程，用户自己的 Edge 窗口不受影响；shutdown 幂等，重复调用无副作用。验证：`e2e/managed-browser-recovery*.mjs` 记录进程列表前后对比。
- [ ] A5 超时：单个工具调用超时后取消并标明「超时」，不在后台继续点击；超时后的迟到结果被丢弃。验证：人为拉慢页面的测试。
- [ ] A6 受影响测试文件、`node_modules/.bin/tsc --noEmit`、`npm run lint`、`cargo check`（src-tauri）通过；`node scripts/relay.mjs guard --task PIL-0195` 无阻断项。

## 范围外

接管按钮与控制条的视觉复刻（PIL-0165）；Cookie 导入或从日常浏览器同步登录态；自动登录、验证码识别；多机/远程浏览器。

## 实现提示

- 先读 `docs/agents/sessions.md` 的 AgentSession shutdown 一节与 PIL-0191 的引擎接口。
- 接管期间不要关闭 CDP 连接，只让工具层短路，避免重连抖动。
- 回收按「自己创建的 webview/环境句柄」，不要按进程名杀。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志
- 2026-10-21T12:28Z · planner · 创建
- 2026-10-21T12:40Z · claude:sonnet-high:planner · 填写目标/验收（由 PIL-0040 拆出）；未冻结，待规划者评审后 freeze。
