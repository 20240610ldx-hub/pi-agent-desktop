---
id: PIL-0210
title: C29 Artifact 预览补采、重试保滚动与原生验收
epic: E2
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0143]
files_allowed: [components/ArtifactCard.tsx, components/ArtifactPanel.tsx, components/HtmlPreviewBlock.tsx, components/HtmlPreviewErrorBar.tsx, components/artifact-panel-styles.test.mjs, components/HtmlPreviewErrorBar.test.mjs, hooks/useHtmlPreviewFrame.ts, hooks/useHtmlPreviewFrame.test.mjs, lib/html-preview.ts, lib/html-preview.test.mjs]
files_shared: [app/native-theme.css]
acceptance_sha: 33158ce7ce25
waivers: []
---

## 目标

把 PIL-0143 移出的 C29 项补齐：预览失败重试后保留 iframe 内部滚动与当前文档，并用真实 Windows 参考与原生路径完成 C29 的同态量测和验收，使 Artifact 卡片与预览达到 [GOALS E2](../GOALS.md)。

## 背景与现状

- 索引：[parity-index](../parity-index.md#组件清单)，组件 C29；前序卡 [PIL-0143](PIL-0143-parity-c29.md)（夹具层与安全边界已验）。
- 参考覆盖：C29 无专门同态图，3.1623 参考尚未补采，逐图来源与数值项记未运行，直至补采完成（补采清单见 PIL-0014 证据目录 planner-2026-10-21/round3/RECAPTURE.md，只有用户能截 Claude 窗口，截图前按 Ctrl+0 重置应用缩放）。私有参考只读，不复制原图或图中个人信息。
- 残差来源：D:\pilaude\relay-evidence\PIL-0143\verify\VERIFY.md。预览失败 Retry 通过改 key 重建 iframe，内部滚动 500→0 丢失；重试后焦点落到 body；两个 Retry 按钮读屏不可区分；无测试断言重试会重载 iframe。
- 滚动修复入口：`lib/html-preview.ts` 的 in-frame 脚本上报滚动位置；`hooks/useHtmlPreviewFrame.ts` 保存并恢复；桥接消息 schema 与安全测试须同步更新（畸形、伪造消息仍须被忽略）。

## 验收标准

每条可以被一个不了解实现过程的人独立判定通过或失败。

- [ ] A1 C29 参考补采（需用户执行）：按 RECAPTURE.md 的 C29 清单，在 Windows Claude Desktop 3.1623.0.0 中截取 Artifact 卡片活动/完成、inline/侧板、版本切换、预览/保存、加载失败/重试、恶意文档隔离各状态；Claude 应用缩放 100%；登记来源、版本、DPI（100/125/150%）、主题、语言。验证：`D:\pilaude\relay-evidence\PIL-0210\reference\manifest.md` 逐图列出来源与状态；未补采的状态记“未运行”，不用演示数据代替。
- [ ] A2 同态量测：参考到位后，同帧同状态下给出参考值、实现值、原像素与 CSS px、差值与残差，按用户批准容差（盒子宽高与间距 ≤1 CSS px；文字基线 ≤1 CSS px；宽高比 ±1%；圆角 ≤0.5 CSS px；图标中心 ≤1 CSS px；颜色 ΔE ≤2，CIEDE2000，中位色）。3.1623 换算 CSS px = 原像素 ÷1.5。验证：量测表与差异图存 `D:\pilaude\relay-evidence\PIL-0210\measure\`；超差项必须修正或在证据中标“失败”，不得以残差替代数值达标。
- [ ] A3 预览失败 Retry 保滚动与当前文档：失败前 iframe 内部 scrollTop 为 Y，点击或键盘 Retry 后仍为 Y（±1 CSS px），文档内容不变；iframe 重建后的恢复经受限消息完成。验证：`node --test hooks/useHtmlPreviewFrame.test.mjs lib/html-preview.test.mjs` 通过；浏览器夹具前后滚动值记入 `D:\pilaude\relay-evidence\PIL-0210\browser\`。
- [ ] A4 桥接安全不退化：新增滚动消息与原有消息一样，伪造来源、畸形载荷（非数字、NaN、负数、超大值、额外字段、原型链字段）被忽略；`sandbox` 不含 allow-same-origin 与 allow-scripts 同时存在。验证：`node --test hooks/useHtmlPreviewFrame.test.mjs lib/html-preview.test.mjs` 中的桥接矩阵通过，且不删减已有用例。
- [ ] A5 关闭侧板回原卡：键盘打开 Artifact 侧板、关闭后焦点回到触发它的卡片；焦点可以从 iframe 退出到外层并回到聊天。若需修改 `components/AppShell.tsx`，先经 `relay scope` 授权，未授权前记“未运行”。验证：浏览器键盘步骤与结果记入证据。
- [ ] A6 inline 流式到完成：真实会话中 Artifact 卡片由活动态切换为完成态，预览随完成内容更新。验证：真实 Pi 进程运行一次产生 Artifact 的请求（需用户的 provider 凭据）；无凭据则记“未运行”。
- [ ] A7 真实 Pi/SDK consumer：由 SDK 产生的多个版本在卡片与版本切换中正确显示。验证：同 A6 运行记录；未运行则记“未运行”。
- [ ] A8 Tauri 真实保存：桌面版保存成功文件字节一致，保存失败显示错误条，取消静默。验证：用户在 Windows 桌面版手动执行，记录文件路径与 SHA-256；未执行则记“未运行”。
- [ ] A9 原生输入与显示：Windows 原生 100/125/150% DPI 与 Claude 应用缩放层下卡片、预览、错误条无溢出；预览文档内实际输入字段的 WebView2/Windows IME 组合输入正确提交，且不触发外层快捷键。验证：用户手动步骤与截图；未执行则记“未运行”。
- [ ] A10 评审残差：(a) 预览与保存重试后焦点落到确定目标（错误条标题或内容区），不落到 body，由测试断言 `document.activeElement`；(b) 两个 Retry 按钮的可访问名称可区分（含“预览”或“下载文件”及文件名）；(c) 新增测试断言预览失败 Retry 会重建 iframe 并保留滚动（A3）。验证：`node --test components/HtmlPreviewErrorBar.test.mjs hooks/useHtmlPreviewFrame.test.mjs`。
- [ ] A11 `npm run lint`、`node_modules/.bin/tsc --noEmit`、`node --test components/artifact-panel-styles.test.mjs components/HtmlPreviewErrorBar.test.mjs hooks/useHtmlPreviewFrame.test.mjs lib/html-preview.test.mjs` 通过；`node scripts/relay.mjs guard --task PIL-0210` 无阻断项；`npm test` 失败名与基线逐名一致、无新增。不得删减、跳过测试或放宽阈值。

## 范围外

- 不改 PIL-0143 已验收的保存失败/取消/重试与版本隔离行为，除非为 A3/A10 必需且有测试覆盖。
- 不改 `app/globals.css`、`app/settings.css` 及受保护基线。
- 不写入私人截图、字体、账号或个人路径。
- 超出 files_allowed 的修改（如 `components/AppShell.tsx`）须先 `relay scope` 授权。

## 实现提示

- 先读 `docs/agents/artifacts.md` 与 `docs/agents/fork-files-security.md`（sandbox 与桥接规则）。
- 滚动上报只能走已有桥接通道的新消息类型，不新增 `allow-same-origin`。
- 视觉与原生项由独立验证者分层取证，缺参考保留“未运行”。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志
- 2026-10-22T10:13Z · planner · 创建
- 2026-10-22T10:30Z · claude-cli:haiku:planner · 由 PIL-0143 拆出（拆卡政策，用户 2026-10-22 批准）：补全被移出的全部项（参考补采、同态量测、滚动重试、侧板回原卡、inline 流式、真实 SDK、Tauri 保存、原生 IME/DPI、评审残差）；files_allowed 同 PIL-0143 并加 lib/html-preview.ts 与其测试 lib/html-preview.test.mjs（grep 无其他卡归属）；依赖 PIL-0143。
- 2026-10-22T10:14Z · planner · 冻结验收标准 33158ce7ce25
