---
id: PIL-0011
title: 查清并修复 FileViewer 窄 pane 下载被取消
epic: E2
priority: P2
status: in_progress
owner: claude:sonnet-xhigh:impl
lease_until: 2026-10-19T17:09Z
branch: task/PIL-0011-fileviewer-download
implementers: [claude:sonnet-xhigh:impl]
depends_on: []
files_allowed: [components/FileViewer*, e2e/file-panel.mjs, app/api/files/**, app/api/desktop/save/**]
files_shared: []
acceptance_sha: 0be3c6ed0863
waivers: []
---

## 目标

FileViewer 工具栏的下载在产品里能保存出正确的文件。对应 GOALS E2。

## 背景与现状

旧检查 7645358：几何、Source、模式切换、sandbox、草稿、mention 与键盘焦点通过；但真实下载按钮和同 context 的纯 anchor 对照都触发了正确事件与文件名后被 canceled，`createReadStream` 失败且无 API 请求，聚合结果 FAILED。根因未证实，可能是预览浏览器环境限制，也可能是产品缺陷。

## 验收标准

- [ ] A1 复现：`E2E_FILE_TOOLBAR_DOWNLOAD_CONTROL=1 node e2e/file-panel.mjs` 的失败输出存证。
- [ ] A2 定位根因并在日志中写明证据：是预览环境限制还是产品缺陷，用最小实验区分（例如同一页面在 Tauri 桌面与普通浏览器中的对照）。
- [ ] A3 若是产品缺陷：修复后浏览器中下载得到正确文件名，且文件 sha256 与源文件一致。若是环境限制：在 Tauri 桌面中通过原生保存实测字节一致，并让 e2e 在该环境下以明确的跳过原因报告，而不是删除失败断言（需评审者认可）。
- [ ] A4 受影响的测试文件、`node_modules/.bin/tsc --noEmit`、`npm run lint` 通过；`node scripts/relay.mjs guard` 无未豁免阻断项。

## 范围外

FileViewer 其他视觉残差。

## 实现提示

先读仓库根 AGENTS.md 中相关 Hard rules 与 Topic Notes。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-19T09:50Z · claude:opus-medium:coord · 迁移：由接力治理初始化从旧 handoff / plan / 扩展矩阵转写。
- 2026-10-19T09:50Z · claude:opus-medium:coord · 验收标准取自用户确认过的验收出口，迁移时冻结；请用户抽查。
- 2026-10-19T14:09Z · claude:sonnet-xhigh:impl · 领取，租约至 2026-10-19T17:09Z
