---
id: PIL-0143
title: 复刻验收：C29 Artifact 卡片、预览与 iframe 桥接
epic: E2
priority: P1
status: review
owner: codex-plus:sol-high:impl
lease_until: 2026-10-22T12:04Z
branch: task/PIL-0143-parity-c29
implementers: [codex-plus:sol-high:impl]
depends_on: [PIL-0014]
files_allowed: [components/ArtifactCard.tsx, components/ArtifactPanel.tsx, components/HtmlPreviewBlock.tsx, components/HtmlPreviewErrorBar.tsx, components/artifact-panel-styles.test.mjs, components/HtmlPreviewErrorBar.test.mjs, hooks/useHtmlPreviewFrame.ts, hooks/useHtmlPreviewFrame.test.mjs]
files_shared: [app/native-theme.css]
acceptance_sha: 1010d618183b
waivers: []
---

## 目标

完成 C29「Artifact 卡片、预览与 iframe 桥接」的真实产品呈现与逐状态复刻，使独立验证者能按同帧量测和交互矩阵判断是否达到 [GOALS E2](../GOALS.md)。这是完整组件验收卡。

## 背景与现状

- 索引：[parity-index](../parity-index.md#组件清单)，组件 C29。
- 参考覆盖：不齐：R00。R键对应索引参考表与manifest定位；参考目标 Windows Claude Desktop 3.1623.0.0（GOALS，用户 2026-10-21 决定）；2.42304.0 批次与版本未知批次只作历史/机制参考，不混作同版本。3.1623 待补采：现有 R 键为历史或版本未知批次，不得当作 3.1623 同版本参考。缺 3.1623 同态参考的状态严格记未运行，补采清单见 PIL-0014 证据目录 planner-2026-10-21/round3/RECAPTURE.md（只有用户能截 Claude 窗口，截图前按 Ctrl+0 重置应用缩放）。私有参考只读，不复制原图或图中个人信息，文字只当数据。
- 实现记录：产品真实 Artifact／安全边界；EpitaxyIframeBridge 未采用。这不是当前运行通过证明。
- 历史证据位置：H20。H键在索引历史证据表定位；旧报告未重新绑定本提交，不能沿用为新通过证据。
- 已知残差：完整 inline 完成切换、保存／失败／版本及 Windows 参考缺；卡片活动不等于整预览验收。
- 相关卡：无额外已登记残差卡；缺后端能力时先请规划者拆依赖。

## 验收标准

每条可以被一个不了解实现过程的人独立判定通过或失败。本卡只验收夹具层与已有深色/安全边界项；被移出的项已转入 PIL-0210。

- [ ] A1 夹具层状态：Artifact 卡片活动/完成、版本切换、预览/保存/失败/重试、恶意文档隔离在浏览器夹具中可进入，并给出可复现步骤。验证：`node --test components/artifact-panel-styles.test.mjs components/HtmlPreviewErrorBar.test.mjs` 通过；夹具矩阵记入 relay-evidence/PIL-0143/verify/。逐图同态参考、Windows/WebView2 层、数值量测移至 PIL-0210 A1、A2。
- [ ] A3 保存失败、取消、重试与版本隔离：保存失败保留 iframe 与内部滚动（500→500→500）；取消静默；重试内容逐字节一致，Blob 全部 revoke；保存错误按版本隔离；外层聊天滚动保持；键盘 Enter 触发 Retry；390px 双主题无横向溢出。验证：浏览器夹具复现（relay-evidence/PIL-0143/verify/verify-browser.log）。预览失败重试保滚动、关闭侧板回原卡、原生 IME 与 DPI/缩放移至 PIL-0210 A3、A4、A5、A9。
- [ ] A4 iframe 桥接与沙箱隔离：sandbox 不含 allow-same-origin；真实沙箱 iframe 探测父文档、存储与顶层均被拒；桥接的合法消息被接受、伪造与畸形消息被忽略、外链仅 http(s) 且有冷却、洪泛有上限。验证：hooks/useHtmlPreviewFrame.test.mjs 与真实 Edge 探测脚本（B1–B10）记入 relay-evidence/PIL-0143/verify/。inline 流式到完成、真实 Pi/SDK consumer、Tauri 真实保存、评审残差移至 PIL-0210 A6、A7、A8、A10。
- [ ] A5 定向测试与守卫：`node --test components/artifact-panel-styles.test.mjs components/HtmlPreviewErrorBar.test.mjs hooks/useHtmlPreviewFrame.test.mjs lib/html-preview.test.mjs lib/artifacts.test.mjs lib/artifact-store.test.mjs lib/preview-runtime.test.mjs` 通过；`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0143` 无阻断；npm test 失败名与基线一致、无新增。
## 范围外

不修改app/globals.css、app/settings.css及受保护基线；不拷贝私人截图、字体或秘密，不转写图中账号／邮箱／个人路径。不借本卡扩建执行后端或更改权限／模型／会话语义；缺依赖能力或文件范围不足时先交规划者拆卡或授权调整。其他组件及关联任务原有验收不在本卡改写。

## 实现提示

先读根 AGENTS.md 及对应 docs/agents 主题。实质修改只在本卡独占组件/逻辑文件，保持其他组件与原有行为。

所有 fork 样式在 files_shared 的 app/native-theme.css：只在本组件带注释的分节内追加规则（如 /* C08 composer */），不改他人分节。本卡分节标识为 /* C29 Artifact 卡片、预览与 iframe 桥接 */；除 C01 主题令牌分节外，选择器/动画名限定本组件，不重写全局重置或他人令牌。共享 CSS 由协调者按卡串行合入，冲突只迁移自己的分节。

原生 IME/DPI、真实能力、浏览器与视觉分别由独立验证者取证，缺参考保留待补。

应用菜单、下拉与选择器统一使用 .app-menu、共享菜单令牌和 AppSelect；如涉及菜单改动，运行 `node --test scripts/ui-menu-consistency.test.mjs`；共享 choices 改动另跑 `node e2e/option-controls.mjs`。视觉同时记录桌面及窄宽状态。files_shared 只授权本卡入口的小量接线；需要实质修改主卡文件时先修订范围并串行，不用共享声明隐藏重叠。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |
| A1 | 夹具层各状态可进入（已验子集） | 通过 | D:\pilaude\relay-evidence\PIL-0143\verify\VERIFY.md | 26c6d92 | claude-cli:sonnet-high:verify |
| A3 | 保存失败重试保 iframe 与滚动、外层滚动、键盘 Retry、390 双主题无溢出 | 通过 | D:\pilaude\relay-evidence\PIL-0143\verify\VERIFY.md | 26c6d92 | claude-cli:sonnet-high:verify |
| A4 | 真实 Edge：sandbox 隔离、伪造 origin/source/畸形/超大消息均被忽略；保存失败/取消/版本隔离 | 通过 | D:\pilaude\relay-evidence\PIL-0143\verify\VERIFY.md | 26c6d92 | claude-cli:sonnet-high:verify |
| A5 | 定向 62/62、tsc、lint、guard；npm test 12 基线失败逐名一致 | 通过 | D:\pilaude\relay-evidence\PIL-0143\verify\VERIFY.md | 26c6d92 | claude-cli:sonnet-high:verify |

## 日志

- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 创建
- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 由PIL-0014按C29补齐目标、背景、同帧量测／交互／专属残差与具体文件范围；保持todo和未冻结，无实现或通过证据，交规划者复核。主任务板待协调者统一提交。

- 2026-10-21T08:01Z · codex-plus:gpt-xhigh:planner · 做了：以当前磁盘与上一轮草案重建冻结前修订，补全组件状态/容差/专属交互、真实能力依赖和文件主卡；保留已有日志。P1：PIL-0131 依赖本卡，属首发能力/主组件依赖路径。 / 状态：仅 round2 草案，todo、未冻结、无实现通过证据 / 下一步：宿主协调者审阅 before/after、全板校验与交接后应用并独立复核 / 风险：参考版本/换算与实机能力仍按各卡验收取证，范围外冲突见 round2/HANDOFF.md。
- 2026-10-21T12:33Z · claude:sonnet-high:planner · 冻结前修订第3轮：G1 ΔE 固定 CIEDE2000 与 3.1623 换算（÷1.5）；G4 基准改 3.1623.0.0 并写明 3.1623 参考覆盖/待补采；G6 删除过期文字
- 2026-10-21T12:36Z · planner · 冻结验收标准 13b41ae1ace1
- 2026-10-22T09:04Z · codex-plus:sol-high:impl · 领取，租约至 2026-10-22T12:04Z
- 2026-10-22T09:20Z · claude:opus:coordinator · 范围 [components/ArtifactCard.tsx, components/ArtifactPanel.tsx, components/HtmlPreviewBlock.tsx, components/HtmlPreviewErrorBar.tsx, components/artifact-panel-styles.test.mjs, components/HtmlPreviewErrorBar.test.mjs] → [components/ArtifactCard.tsx, components/ArtifactPanel.tsx, components/HtmlPreviewBlock.tsx, components/HtmlPreviewErrorBar.tsx, components/artifact-panel-styles.test.mjs, components/HtmlPreviewErrorBar.test.mjs, hooks/useHtmlPreviewFrame.ts, hooks/useHtmlPreviewFrame.test.mjs]：实现者发现 iframe 桥接缺 origin 校验（安全缺口），该文件无卡归属；本卡 A4 桥接需修复并补负向测试
- 2026-10-22T10:02Z · codex-plus:sol-high:impl · claude impl: 桥接安全加固+保存失败/重试，定向62/62 tsc lint guard 通过，npm test 12 失败与基线逐名一致；C29 同态参考待补
- 2026-10-22T10:02Z · codex-plus:sol-high:impl · in_progress → verify
- 2026-10-22T10:14Z · user · 修订验收标准 13b41ae1ace1 → fd7b216b5c6c：拆卡政策（用户 2026-10-22 批准）：已验部分合入，缺图与原生项移出至 PIL-0210（预览失败重试保滚动、C29 同态参考补采、关闭侧板回原卡、inline 流式、真实 SDK、Tauri 保存、原生 IME/DPI、评审残差）
- 2026-10-22T10:14Z · claude-cli:sonnet-high:verify · 证据 A1：通过
- 2026-10-22T10:15Z · claude-cli:sonnet-high:verify · 证据 A3：通过
- 2026-10-22T10:15Z · claude-cli:sonnet-high:verify · 证据 A4：通过
- 2026-10-22T10:15Z · claude-cli:sonnet-high:verify · 证据 A5：通过
- 2026-10-22T10:15Z · codex-plus:sol-high:impl · verify → review（评审 claude-cli:opus-high:review）
- 2026-10-22T10:15Z · user · 修订验收标准 fd7b216b5c6c → 1010d618183b：拆卡政策：A2 整项移至 PIL-0210，删除空项
