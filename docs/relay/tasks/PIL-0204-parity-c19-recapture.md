---
id: PIL-0204
title: C19 模型菜单补采与原生验收
epic: E2
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0133]
files_allowed: [components/ModelSelector.tsx, components/SelectorRow.tsx, components/ModelSelector.test.mjs]
files_shared: [app/native-theme.css]
acceptance_sha: 2ec0bdf7ebba
waivers: []
---

## 目标

PIL-0133 拆出的 C19 模型切换菜单剩余状态，在用户补采 3.1623 原生参考并在有已认证模型的 Windows 环境完成原生验收后，完成量测与修正。对应 [GOALS](../GOALS.md) E2。

## 背景与现状

用户 2026-10-22 拆卡决定：已验部分合入 PIL-0133，缺图状态转补采卡。PIL-0133 复验报告：relay-evidence/PIL-0133/verify/VERIFY-2.md（A2 深色有参考项与 A5 通过；夹具层 A1/A3/A4 通过；真实 Pi 链、WebView2 原生 IME、三档 DPI、缺同态参考的状态 BLOCKED）。补采协议见 relay-evidence/PIL-0014/planner-2026-10-21/round3/RECAPTURE.md（只有用户能截 Claude 窗口，截图前按 Ctrl+0 重置应用缩放）。

**需要用户补采的 3.1623 截图清单**（深浅色、zh-CN，显示器 150%、应用缩放 100%）：
1. 浅色模型菜单（含当前项对勾）；
2. 提供商/模型分组（多提供商）；
3. 搜索框已输入有结果；
4. 搜索无结果；
5. 含不可用/未登录模型项；
6. 长模型名（截断/换行）；
7. 错误或加载失败菜单；
8. 模型行 hover 框与星按钮（含已星标行的对勾避让）。
缺哪张，对应状态继续记未运行，不用夹具或演示数据代替。

**需要用户或有认证环境的原生步骤**：在已登录至少两个模型的 Windows 桌面应用中（a）真实切换模型并确认会话生效；（b）制造切换失败/取消并确认恢复；（c）WebView2 原生输入法在搜索框组合输入，Enter 不选中项；（d）系统 DPI 100%/125%/150% 与 Claude 应用缩放各打开菜单；（e）窄窗避让。

已知残差：浅色对勾色现用系统 #0075ff（待浅色参考确认）；星标行对勾因星按钮左移无同态参考；文字行内垂直基线缺同态行框；公开字体回退栈与 Anthropic 字体的字宽 ink 差异。

## 验收标准

- [ ] A1 补采后逐图登记来源、版本、Windows/WebView2、客户区、系统 DPI、应用缩放、主题/语言，覆盖补采清单 1–8 的每个状态（浅色菜单；分组、搜索、无结果、不可用、长名、错误；星按钮行）；每个状态给可复现进入步骤。缺图状态继续记未运行，不用 actual/演示数据代参考。
- [ ] A2 对 A1 已有参考的状态，在同帧/同状态/同数据、相同客户区/系统 DPI/应用缩放下给出参考值、实现值、原像素与 CSS px、差值和残差（3.1623 原生 CSS px = 原像素 ÷ 1.5）。容差：盒宽高与间距 ≤1 CSS px；文字基线 ≤1；宽高比 ±1%；圆角 ≤0.5；图标中心 ≤1；颜色 CIEDE2000 ΔE ≤2（sRGB→Lab D65，同一像素采样区取中位色）。须含浅色菜单背景/边框/文字/hover 与浅色对勾色，星按钮行的对勾与星位置。叠图只做整数裁剪/平移，不插值；字形 ink 差单列残差，不以残差替代数值达标。量测表与差异图存 relay-evidence/PIL-0204/。
- [ ] A3 真实 Pi 与 WebView2 原生层：在有已认证模型的环境用 Tab/方向/Home/End 访问分组与当前项，Escape 只关本层并回触发点；搜索框 WebView2 原生 IME 组合 Enter 不选中；长列表滚动保当前项；窄窗避让、100%/125%/150% DPI、应用缩放、双主题核验。菜单走 DOM `.app-menu`，`NATIVE_POPUP_MENUS_ENABLED` 保持 false，不弹系统原生菜单。原生与浏览器合成事件分层记录。
- [ ] A4 真实模型切换成功、失败、取消、恢复与可见反馈一致，模型值来自 Pi，不硬编码演示模型；A1 各状态（分组、不可用、长名、错误、搜索无结果）在真实数据下逐态核验；已知残差逐条给出处理结果与可复现操作，浅色对勾色按浅色参考修正。
- [ ] A5 由独立验证者运行 `node --test components/ModelSelector.test.mjs`、`node --test scripts/ui-menu-consistency.test.mjs`、`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0204`，全部通过、guard 无阻断；不删减/跳过测试或放宽阈值。逐 A 项记录实际结果、步骤/命令、仓库外证据、提交与验证者标签；夹具、真实 SDK/进程、浏览器、Windows 原生与视觉证据分层。

## 范围外

PIL-0133 已验收的夹具层行为与深色有参考项（除非补采显示回归）；不修改 app/globals.css、app/settings.css 与受保护基线；不拷贝私人截图、字体或秘密，不转写图中账号/邮箱/个人路径；不扩建执行后端或改变权限/模型/会话语义。

## 实现提示

先读根 AGENTS.md 与 docs/agents/models.md、fork-models.md。样式只在 app/native-theme.css 的 `/* C19 模型切换菜单 */` 分节内改。复用 relay-evidence/PIL-0133/verify/ 中的量测脚本（vmeasure2.cjs、de2.py、chk2.py、impl_ink2.py）。菜单改动后跑 `node --test scripts/ui-menu-consistency.test.mjs`。本卡须等用户补采截图与提供认证环境后才可领取。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志
- 2026-10-22T03:42Z · planner · 创建
- 2026-10-22T03:55Z · claude-cli:sonnet-high:planner · 用户 2026-10-22 拆卡决定：由 PIL-0133 移入浅色菜单、分组/搜索/无结果/不可用/长名/错误/星按钮行同态参考，真实 Pi 切换与失败恢复，WebView2 IME，三档 DPI，浅色对勾色。
- 2026-10-22T03:42Z · planner · 冻结验收标准 2ec0bdf7ebba
