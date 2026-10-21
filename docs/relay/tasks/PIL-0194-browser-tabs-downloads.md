---
id: PIL-0194
title: 受控浏览器标签页与下载
epic: E5
priority: P1
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0192, PIL-0193]
files_allowed: [lib/managed-browser-tabs*.ts, lib/managed-browser-downloads*.ts, lib/managed-browser-tabs*.test.mjs, lib/managed-browser-downloads*.test.mjs, app/api/browser/tabs/**, app/api/browser/downloads/**, src-tauri/src/managed_browser_events*.rs]
files_shared: [lib/managed-browser-tools.ts, lib/chat-downloads-tool.ts, src-tauri/src/lib.rs, lib/i18n/messages/*.ts]
acceptance_sha:
waivers: []
---

## 目标

智能体与用户能在受控浏览器里管理标签页（列出、新建、切换、关闭、处理弹窗），下载经审批后保存到项目授权目录并可取消。对应 [GOALS](../GOALS.md) E5「导航、阅读、点击、输入、下载、取消」。

## 背景与现状

- 引擎来自 PIL-0191：Rust 侧 `on_download`（返回 false 可拦截）与 `on_new_window` 是第一道原生拦截，Playwright 层再核对。
- 审批来自 PIL-0193（下载发起属审批类别之一）；路径与授权目录规则沿用 [fork-files-security](../../agents/fork-files-security.md) 的 allow-list 与 `lib/path-security.ts`，不使用字符串前缀判断。
- 既有 `lib/chat-downloads-tool.ts` 负责聊天下载展示，本卡只做挂接，不改其行为。
- 用户决定首发只验 Windows；路径按 Windows 大小写、保留名、junction 校验。

## 验收标准

- [ ] A1 本地站点的 `target=_blank` 与 `window.open` 产生的新标签出现在 tabs 列表，可切换、可关闭；关闭当前标签后焦点回到相邻标签；会话中最后一个标签关闭后保留一个空白标签而不是崩溃。验证：本地站点集成测试。
- [ ] A2 下载未批准时磁盘上 0 字节落盘且没有临时文件残留；批准后保存到项目授权目录。文件名清洗（`..`、路径分隔符、Windows 保留名、超长、重复）；目标经 junction/符号链接指向授权目录之外时拒绝。验证：下载矩阵测试，逐项检查磁盘。
- [ ] A3 下载中取消（用户取消或会话取消）删除半成品并返回「已取消」；磁盘满或目标不可写返回结构化错误；服务器中途断开返回失败而非成功。验证：慢速本地站点 + 故障注入测试。
- [ ] A4 被 `on_download` 原生拦截或取消的下载，Playwright 层不出现「已完成」事件，下载列表状态与磁盘一致；已落盘下载在聊天下载展示中可见且路径与实际一致。验证：状态与磁盘对账测试。
- [ ] A5 弹窗与新标签的目标 origin 同样经 PIL-0193 的域名授权：未授权 origin 的新标签被拦截并提示，不加载。验证：未授权域名弹窗测试，请求数为 0。
- [ ] A6 受影响测试文件、`node_modules/.bin/tsc --noEmit`、`npm run lint`、`cargo check`（src-tauri）通过；`node scripts/relay.mjs guard --task PIL-0194` 无阻断项。

## 范围外

上传（PIL-0193）；接管与崩溃恢复（PIL-0195）；标签页 UI 条（PIL-0196/0165）；下载内容扫描；下载文件的自动打开或执行。

## 实现提示

- 先读 `docs/agents/fork-files-security.md` 与 `lib/path-security.ts`、`lib/chat-downloads-tool.ts`。
- 下载先写入应用私有临时目录，批准并校验路径后再原子移动；取消只清理自己创建的临时文件。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志
- 2026-10-21T12:28Z · planner · 创建
- 2026-10-21T12:40Z · claude:sonnet-high:planner · 填写目标/验收（由 PIL-0040 拆出）；未冻结，待规划者评审后 freeze。
