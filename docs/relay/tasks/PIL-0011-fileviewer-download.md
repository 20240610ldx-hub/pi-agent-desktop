---
id: PIL-0011
title: 查清并修复 FileViewer 窄 pane 下载被取消
epic: E2
priority: P2
status: in_progress
owner: codex-plus:sol-high:impl
lease_until: 2026-10-22T12:35Z
branch: task/PIL-0011-fileviewer-download
implementers: [claude:sonnet-xhigh:impl, codex-plus:sol-high:impl]
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
- 2026-10-19T14:11Z · claude:sonnet-xhigh:impl · 复述：目标是 FileViewer 窄 pane 下载真正保存正确文件。A1 原样运行 E2E_FILE_TOOLBAR_DOWNLOAD_CONTROL=1 node e2e/file-panel.mjs 保存失败输出；A2 用有界最小浏览器实验区分 fixture/浏览器限制与产品缺陷，并逐项记录假设和结果；A3 保留下载断言，验证实际落盘文件名、bytes 与源 sha256，若确为环境限制且触及 R3 冲突则 blocked 交规划；A4 跑受影响测试、tsc、lint、guard。所有代码基于任务 HEAD，只改 files_allowed，不读主 checkout live 源码。任务板仅 --no-commit，由协调者串行提交；实现自测只写日志，不写 passing evidence。
- 2026-10-19T14:15Z · claude:sonnet-xhigh:impl · 做了：基于任务 HEAD fdc57d85f441f485d928820699b58c6d25255b28 完整读卡/规则/对应 docs，check 通过，未改产品源码。最小夹具 07-anchor-repro.log (exit1/778ms) 复现同 download URL 的 anchor 事件和正确文件名，但 failure=canceled、saveAs失败，context request/route均不含下载URL。复现后列出假设：H1 浏览器整体禁止保存，预测 blob 也失败；H2 download 属性触发的浏览器路径绕过 Playwright route，预测同URL fetch/普通导航能进handler并保存；H3 FileViewer逻辑是取消的必要条件，预测独立anchor不复现。08-anchor-controls.log (exit0/1203ms) 两项对照 fetch→blob/无download属性普通导航均进入同URL handler，saveAs实际落盘各53bytes，sha256均为4b20f34d60937a0cc1cfd44c5518a3c46a56a02f4ace9a783cce52d1d4090d9e，等于夹具源；因此排除H1/H3作为旧症状唯一解释，支持H2。以上全是生成夹具，不是native/产品实测。 / 状态：分支 HEAD fdc57d8，干净无代码改动；A1完整产品命令未运行（无任务worktree preview，且本批暂停不扩scope）；A2定位到独立于产品的夹具路由缺口，但完整产品/原生根因仍待证；A3产品与native均未运行；A4仅guard通过(0files)，tests/tsc/lint未运行。完整命令/退出码/时间见 D:/pilaude/relay-evidence/PIL-0011/01-12日志及anchor-controls/result.json与两个落盘夹具文件。 / 下一步：按主协调转达的本批暂停要求设blocked交回；恢复时先由协调者批准任务worktree专用launch配置scope，锁preview并用专用端口完整运行A1，再以真实文件服务与路由fixture对照确认是否需要修产品或harness；不得用filename事件作为A3证据。 / 风险：隔离夹具支持浏览器路由缺口但不能替代真实FileViewer或Tauri保存验证；若最终走环境skip分支将触及A3与R3冲突，必须blocked交规划；本轮未删除断言/加重试/skip，未写通过证据，preview锁已释放。任务板仅--no-commit，请协调者串行提交。
- 2026-10-19T14:15Z · claude:sonnet-xhigh:impl · in_progress → blocked：有界夹具已定位download属性与Playwright route缺口，产品根因尚未证；任务worktree无专用preview launch，按本批暂停要求不扩scope/不启动新服务，完整A1与A3native留待恢复后验证。
- 2026-10-19T14:16Z · codex:gpt:coord · blocked → todo：用户要求暂停并交还租约；夹具下载路由缺口已定位，产品完整复现与原生字节验收尚未运行，保留blocked原因与全部证据供下次接手
- 2026-10-22T09:35Z · codex-plus:sol-high:impl · 领取，租约至 2026-10-22T12:35Z
