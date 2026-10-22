---
id: PIL-0209
title: C08 输入器补采与原生验收
epic: E2
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0122]
files_allowed: [components/ChatInput.tsx, components/ChatInput.test.mjs, lib/ime.ts]
files_shared: [lib/i18n/messages/*.ts, app/native-theme.css]
acceptance_sha: 4e77e61de81b
waivers: []
---

## 目标

PIL-0122 拆卡后移出的 C08 输入器状态：补采 3.1623 原生同态参考，完成原生 Windows IME 与三档 DPI／应用缩放核验，并对无参考的状态给出量测或明确的“未运行”记录。完成后 C08 的全部状态都有可判定结论，对应 [GOALS E2](../GOALS.md)。

## 背景与现状

- 拆卡依据：PIL-0122 复验 [VERIFY.md](../../../../relay-evidence/PIL-0122/verify/VERIFY.md) 与 [VERIFY-2.md](../../../../relay-evidence/PIL-0122/verify/VERIFY-2.md)。已验子集（附件态“+”、缩略图描边、发送图标位置、悬停+Escape、暗色附件与提示、发送提示第一行）保留在 PIL-0122。
- 本卡移入的 BLOCKED／待参考项：
  - 原生 Windows IME（组合、选词、组合中 Enter／Escape、229）不误提交：夹具层只做了合成事件，未做原生输入法。
  - 三档 DPI（100／125／150%）与 Claude 应用缩放：未做。
  - 无同态参考、需用户补采的状态：单行、多行、长草稿、窄窗、暗色发送提示、busy/停止、禁用态发送钮、亮色聚焦边框、亮色附件态、亮色缩略图描边。
- 已知残差（夹具层）：字形 ink 宽高、回车图标、边线抗锯齿与参考不同，需逐条给处理结果或保留为残差并附复现操作。
- 不属于本卡：发送提示整体框宽高与第二行“在分叉会话中发送 Ctrl Alt ⏎”、Ctrl+Alt+Enter 分叉发送、分叉相关 i18n 键，全部在 [PIL-0207](PIL-0207-fork-send-ui.md)。麦克风按钮与其 00 号提示首发不做（PIL-0178／PIL-0140 parked）。
- 补采协议：`D:\pilaude\relay-evidence\PIL-0014\planner-2026-10-21\round3\RECAPTURE.md` 中 PIL-0122 一节。只有用户能截 Claude 窗口，截图前在 Claude 中按 Ctrl+0 把应用缩放重置为 100%。3.1623 参考换算：CSS px = 原像素 ÷ 1.5（显示器 150%、AppliedDPI 144）。
- 用户需补采的截图清单（每项一张原生原字节 PNG，浅色与深色各一套，窄窗再补一张双主题；存入 `D:\pilaude\relay-evidence\PIL-0209\capture\`，并附 manifest 登记版本、DPI、应用缩放、主题、语言、客户区与进入步骤）：
  1. 单行草稿（亮、暗）
  2. 多行草稿（亮、暗）
  3. 长草稿，内部滚动（亮、暗）
  4. 窄窗，约 800px 宽（亮、暗）
  5. 暗色发送提示（第一行“发送 ⏎”，悬停）
  6. busy／停止态（有草稿与无草稿各一张）
  7. 禁用态发送钮
  8. 亮色聚焦边框（textarea 聚焦）
  9. 亮色附件态（含缩略图，看“+”底色与缩略图描边）
- 用户需执行的原生步骤（非浏览器）：在 Windows 原生 Claude 中用中文或日文输入法组合、选词，检查组合中 Enter／Escape、229 不误提交；记录输入法名称与 Claude 版本。三档 DPI 与应用缩放（100／125／150%，Ctrl+0 及一档放大）各截一套输入器状态，与同 DPI 参考对比。

## 验收标准

- [ ] A1 补采：用户按上方清单交付截图与 manifest，存入 `relay-evidence/PIL-0209/capture/`。每个状态登记来源、版本、DPI、应用缩放、主题、语言。未交付的状态记未运行，不以 actual、演示数据或夹具代替参考。验证：`relay-evidence/PIL-0209/capture/manifest.md` 存在且逐项有图或“未运行”理由。
- [ ] A2 同态量测：对 A1 中每张参考，在同帧、同状态、同测试数据、相同客户区／DPI／应用缩放下给出参考值、实现值、原像素与 CSS px、差值。容差沿用 PIL-0122 批准标准：盒子宽高与间距 ≤1 CSS px；文字基线 ≤1 CSS px；宽高比 ±1%；圆角 ≤0.5 CSS px；图标中心 ≤1 CSS px；颜色 ΔE ≤2（CIEDE2000，sRGB→CIELAB D65，同一像素采样区中位色）。抗锯齿与字形 ink 单列残差。量测表与差异图存 `relay-evidence/PIL-0209/measure/`。叠图只作整数裁剪／平移。
- [ ] A3 原生 Windows IME：中文或日文组合、选词、组合中 Enter、Escape、keyCode 229 不误提交；草稿与光标保持；未知提交结果不重放。原生结果与浏览器合成事件分层记录。无原生环境或用户未执行的步骤记未运行。验证：`relay-evidence/PIL-0209/native/ime.md` 含输入法名称、Claude 版本、逐步结果。
- [ ] A4 三档 DPI（100／125／150%）与应用缩放（Ctrl+0 及一档放大）下，输入器卡高、文字基线、发送钮位置与对应参考对比，结果按 A2 容差记录。无同 DPI 参考的档位记未运行。Tab 到工具与单一提交控件、粘贴／多行／附件后保持光标、长草稿内部滚动、窄窗无横向溢出，在浏览器层与原生层分别记录。
- [ ] A5 逐项处理 A1 中的状态，并修正超差项（只在 files_allowed 内改动，不改他人分节）。每个状态给出改前改后量测。超差但无法修正的项列为残差，附可复现操作。
- [ ] A6 残差：字形 ink 宽高、回车图标、边线抗锯齿逐条给出处理结果（修正、接受为残差并说明理由，或记未运行）。
- [ ] A7 由独立验证者运行 `node --test components/ChatInput.test.mjs components/ChatInput.automation.test.mjs lib/ime.test.mjs`、`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0209`。期望全部通过，guard 无阻断；不得删减／跳过测试或放宽阈值。逐 A 项记录实际结果、命令、仓库外证据、提交与验证者标签。

## 范围外

- 分叉发送、发送提示第二行、Ctrl+Alt+Enter、分叉 i18n 键：归 PIL-0207。
- 发送提示整体框宽高（参考为两行）：归 PIL-0207。
- 麦克风按钮与其提示：首发不做。
- 不修改 `app/globals.css`、`app/settings.css` 及受保护基线；不拷贝私人截图、字体、账号或个人路径；不改其他卡。

## 实现提示

- 先读 PIL-0122 的 VERIFY-2.md 中 `interaction.json`、`fx.cjs`、`fx2.cjs` 作为夹具量测起点。
- 所有 fork 样式只在 `app/native-theme.css` 的 `/* C08 输入器主框与提交控件 */` 分节内修改。
- 原生 IME 与 DPI 步骤必须在用户的 Windows 真机执行，协调者不得据夹具层结果判为通过。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志
- 2026-10-22T08:30Z · claude-cli:haiku:planner · 创建，拆自 PIL-0122（用户 2026-10-22 拆卡政策）
- 2026-10-22T08:27Z · planner · 冻结验收标准 4e77e61de81b
