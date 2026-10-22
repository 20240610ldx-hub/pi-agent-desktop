---
id: PIL-0206
title: C13 代码块补采与原生验收
epic: E2
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0127]
files_allowed: [components/MarkdownBody.tsx, components/CodeCopyButton.tsx, components/MermaidBlock.tsx, components/MarkdownBody.test.mjs, components/MermaidBlock.test.mjs]
files_shared: [app/native-theme.css]
acceptance_sha: ce9bf9f72f43
waivers: []
---

## 目标

PIL-0127 拆出的 C13 代码块、Mermaid source 与复制反馈剩余状态，在用户补采 3.1623 原生参考并在 Windows 桌面应用完成原生验收后，完成量测与修正。对应 [GOALS](../GOALS.md) E2。

## 背景与现状

用户 2026-10-22 拆卡决定：已验部分合入 PIL-0127，缺图状态转补采卡。PIL-0127 复验报告：relay-evidence/PIL-0127/verify/VERIFY-2.md（A2 仅参考 main-window-native/2026-10-22/07 覆盖的深色 hover＋tooltip 态通过；A3/A4 浏览器层通过；A5 不稳定用例已在 4c6d136 修复；其余状态与原生层 BLOCKED）。补采协议见 relay-evidence/PIL-0014/planner-2026-10-21/round3/RECAPTURE.md（只有用户能截 Claude 窗口，截图前按 Ctrl+0 重置应用缩放）。

**需要用户补采的 3.1623 截图清单**（显示器 150%、应用缩放 100%、zh-CN；原生截图，非聊天附件）：
1. 深色：复制 pending（加载态图标与「Loading…」类提示，若官方有）；
2. 深色：复制成功（对勾＋「已复制」tooltip）；
3. 深色：复制失败／重试（失败提示文案与图标）；
4. 浅色：代码块 hover 工具栏＋复制 tooltip（原生，替代 code-copy-light 聊天附件）；
5. 浅色：复制成功对勾；
6. Mermaid「源码」视图：块本体＋工具栏（hover 与空闲）；
7. 长单行横向滚动态（含滚动后按钮背景与右侧内容的遮挡关系）；
8. 空闲态（无悬停无焦点）：多代码块消息，工具栏是否隐藏；
9. 普通 fence 与 Mermaid source 各一张含语言标签／无语言标签的对照（若官方有标签）。
缺哪张，对应状态继续记未运行，不用夹具或演示数据代替。

**需要用户或 Windows 桌面环境的原生步骤**：在 Windows Tauri/WebView2 桌面应用中（a）对普通 fence 与 Mermaid source 点复制，在记事本粘贴核对与原文逐字一致（含多行换行与末尾换行）；（b）Tab 到复制键、Enter／Space 触发，确认 WebView2 键盘事件与焦点保持，tooltip 出现；（c）制造复制失败（如拒绝剪贴板权限）并确认失败提示、焦点与重试；（d）系统 DPI 100%/125%/150%（及 200% 若可）与 Claude 应用缩放各查看代码块与工具栏；（e）窄窗下长代码横滚与外层纵滚分离。

已知观察项：长单行横滚后按钮底色仅 24px，其右侧露出 `padding-right:108px` 区域下的残字（VERIFY-2 的 s-failed.png、mx-light-390.png）；待横滚参考（清单 7）后判定是否偏离并修正。

## 验收标准

- [ ] A1 补采后逐图登记来源、版本、Windows/WebView2、客户区、系统 DPI、应用缩放、主题/语言、公开字体与功能开关，覆盖补采清单 1–9 的每个状态（深色 pending／成功／失败重试；浅色 hover／成功；Mermaid source；横滚；空闲态）；每个状态给可复现进入步骤。缺图状态继续记未运行，不用 actual／演示数据代参考。
- [ ] A2 对 A1 已有参考的状态，在同帧／同状态／同测试数据、相同客户区／系统 DPI／应用缩放下给出参考值、实现值、原像素与 CSS px、差值和残差（3.1623 原生 CSS px = 原像素 ÷ 1.5）。容差：盒宽高与间距 ≤1 CSS px；文字基线 ≤1；宽高比 ±1%；圆角 ≤0.5；图标中心 ≤1；颜色 CIEDE2000 ΔE ≤2（sRGB→Lab D65，同一像素采样区取中位色）。须含深色 pending／成功／失败的图标与浮签、浅色代码块背景／边框／文字／按钮 hover 与浮签、Mermaid source 块、空闲态工具栏显隐。叠图只做整数裁剪／平移，不插值；字形 ink 差单列残差，不以残差替代数值达标。量测表与差异图存 relay-evidence/PIL-0206/。
- [ ] A3 Windows Tauri/WebView2 原生层：Tab／Enter／Space 触发复制与 tooltip，成功／失败反馈保焦点，长代码横滚与正文纵滚分离；物理 100%/125%/150% DPI（及 200% 若可）、Claude 应用缩放、窄窗、双主题核验。原生与浏览器合成事件分层记录，缺同态参考的视觉项记未运行。
- [ ] A4 Windows 原生剪贴板独立证明普通 fence 与 Mermaid source 复制保原文（含多行换行）；原生下 pending／成功／失败／重试／重复点击及陈旧回调清理与可见反馈一致；横滚后按钮右侧残字观察项按横滚参考处理并给出结果与可复现操作；不因参考中的运行入口新增未经授权的执行。
- [ ] A5 由独立验证者运行 `node --test components/MarkdownBody.test.mjs components/MermaidBlock.test.mjs components/MarkdownBody.caret.test.mjs`、`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0206`，全部通过、guard 无阻断；不删减／跳过测试或放宽阈值。逐 A 项记录实际结果、步骤／命令、仓库外证据、提交与验证者标签；夹具、浏览器、Windows 原生与视觉证据分层。

## 范围外

PIL-0127 已验收的夹具层行为与深色 hover＋tooltip 有参考项（除非补采显示回归）；不修改 app/globals.css、app/settings.css 与受保护基线；不拷贝私人截图、字体或秘密，不转写图中账号／邮箱／个人路径；不扩建执行后端或改变权限／模型／会话语义。

## 实现提示

先读根 AGENTS.md 与 docs/agents/artifacts.md（若涉及预览）。样式只在 app/native-theme.css 的 `/* C13 代码块、Mermaid source 与复制反馈 */` 分节内改。复用 relay-evidence/PIL-0127/verify/ 中的量测脚本（vcap3.mjs、vint3.mjs、vmatrix.mjs、cmp3.py、cmp4.py、color2.py、btn.py、radius.py；脚本内 `root` 需改指向带完整 node_modules 的 checkout）。本卡须等用户补采截图并在 Windows 桌面环境配合原生步骤后才可领取。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志
- 2026-10-22T04:27Z · planner · 创建
- 2026-10-22T04:40Z · claude-cli:sonnet-high:planner · 填写验收：PIL-0127 拆卡（用户 2026-10-22 决定），承接全部 BLOCKED 项
- 2026-10-22T04:27Z · planner · 冻结验收标准 ce9bf9f72f43
