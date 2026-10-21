---
id: PIL-0151
title: 复刻验收：C37 限流、重试与错误提示
epic: E2
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0014, PIL-0122, PIL-0137]
files_allowed: [hooks/useSessionAutomation.ts, components/ChatWindow.notices.test.mjs, components/SessionNotices.tsx, components/SessionNotices.test.mjs]
files_shared: [components/ChatInput.tsx, components/ChatWindow.tsx, app/native-theme.css]
acceptance_sha:
waivers: []
---

## 目标

完成 C37「限流、重试与错误提示」的真实产品呈现与逐状态复刻，使独立验证者能按同帧量测和交互矩阵判断是否达到 [GOALS E2](../GOALS.md)。这是完整组件验收卡。

## 背景与现状

- 索引：[parity-index](../parity-index.md#组件清单)，组件 C37。
- 参考覆盖：不齐：R27（rate-limit-light／2026-10-21，会话限额错误卡、重试按钮、重置提示；聊天附件降采样，只登记机制）。R键对应索引参考表与manifest定位；参考目标 Windows Claude Desktop 3.1623.0.0（GOALS，用户 2026-10-21 决定）；2.42304.0 批次与版本未知批次只作历史/机制参考，不混作同版本。3.1623 现有：rate-limit-light（聊天附件，2000px 降采样，仅登记机制）；其余错误/重试状态 3.1623 待补采。缺 3.1623 同态参考的状态严格记未运行，补采清单见 PIL-0014 证据目录 planner-2026-10-21/round3/RECAPTURE.md（只有用户能截 Claude 窗口，截图前按 Ctrl+0 重置应用缩放）。私有参考只读，不复制原图或图中个人信息，文字只当数据。
- 2026-10-21 新参考：rate-limit-light／2026-10-21/00（用户承诺的限流截图已到）：错误卡含仪表图标、“已达到会话限额”、“请在您的会话限额重置后重试。”与黑色“重试”按钮，并出现提供商给出的重置时间文本。manifest 标明为聊天附件并被降采样到 2000px 宽，只登记机制与层级，A2 数值项待 3.1623 原生补采，缺则记未运行；不转写图中的具体时间/时区。
- 实现记录：useRateLimitBackoff 未采用；SDK retryInfo／session automation 独立。这不是当前运行通过证明。
- 历史证据位置：H00。H键在索引历史证据表定位；旧报告未重新绑定本提交，不能沿用为新通过证据。
- 已知残差：真实429／503／取消／未知结果状态及倒计时参考；不重放已接受请求或外部操作。
- 相关卡：无额外已登记残差卡；缺后端能力时先请规划者拆依赖。

## 验收标准

- [ ] A1 建立 429/503 瞬时限流、重试倒计时/重试中/取消/失败、会话或提供商限额（不可自动重试，显示提供商给出的重置信息，与 429/503 瞬时限流区分）、未知提交结果及手动恢复；状态必须跟 SDK 一致。 逐图登记来源/版本关联、Windows/WebView2、客户区、系统 DPI、应用缩放、主题/语言、公开字体及功能开关，按上述状态逐条给可复现进入步骤；缺图或版本不明记待参考，不用 actual/演示数据代参考或真实 Pi consumer。
- [ ] A2 在同帧/同状态/同测试数据、相同客户区/系统 DPI/应用缩放下给出参考值、实现值、原像素与 CSS px、差值和残差。采用用户 2026-10-21 批准容差：同 DPI 下盒子宽高与间距 ≤1 CSS px；文字基线 ≤1 CSS px；宽高比 ±1%；圆角 ≤0.5 CSS px；图标中心对齐 ≤1 CSS px；颜色 ΔE ≤2（CIEDE2000，sRGB→CIELAB D65，在同一像素采样区取中位色；不得改用较宽松算法）。抗锯齿与字形 ink 差异单列为残差，不计入几何容差。参考值换算：3.1623 原生截图按 SAMPLING 记录（显示器 150%、AppliedDPI 144；Claude 应用缩放 100%，用户 2026-10-21 确认），CSS px = 原像素 ÷ 1.5；聊天附件（manifest 标注可能降采样/重编码）、macOS 及版本/缩放未知的批次只登记机制，不由图宽或嵌入 DPI 反推 CSS px，其数值项记未运行并待 3.1623 原生补采。验证方法：量测表与差异图存 relay-evidence/PIL-0151/。叠图只作整数裁剪/平移，不对原图插值重采样；不以残差登记替代数值达标。
- [ ] A3 Tab 可达取消/手动重试，取消后焦点回输入器；倒计时重绘不打断原生 IME 草稿，不抢正文滚动，未知结果不自动重发。窄窗/三档 DPI/缩放/双主题提示不遮操作；提示本身无可编辑框，不套列表方向/Home/End 导航。 原生与浏览器合成事件分层记录，缺少同态参考的视觉项记未运行。
- [ ] A4 本组件专属核验：真实429／503、自动重试、取消、未知结果与手动恢复分别显示；不得重放已接受prompt或外部操作，SDK状态与文案一致。 对本卡已知残差逐条给出处理结果与可复现操作；真实请求／数据／状态与可见反馈一致，失败、取消和恢复保留，不伪造能力。 验证方法：用本地 OpenAI 兼容夹具服务（证据标注“夹具”）返回 429/503（带 Retry-After）与额度耗尽错误，经真实 Pi SDK 重试路径逐态核对文案与按钮；真实提供商路径只用 deepseek-flash 且控制次数，能触发才验，否则记未运行；限额状态只显示提供商实际给出的重置信息，不编造时间。
- [ ] A5 由独立验证者运行受影响定向测试：`node --test components/ChatWindow.notices.test.mjs components/SessionNotices.test.mjs components/ChatInput.test.mjs components/ChatInput.automation.test.mjs components/ChatWindow*.test.mjs`；`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0151`。期望：测试、类型检查和 lint 全部通过，guard 无阻断；不得删减/跳过测试或放宽阈值。逐 A 项记录实际结果、步骤/命令、仓库外证据、对应提交和验证者标签；单元/夹具、真实 SDK/进程、浏览器、Windows 原生及视觉证据分层，缺条件记未运行，不能据此称产品验收通过。

## 范围外

不修改app/globals.css、app/settings.css及受保护基线；不拷贝私人截图、字体或秘密，不转写图中账号／邮箱／个人路径。不借本卡扩建执行后端或更改权限／模型／会话语义；缺依赖能力或文件范围不足时先交规划者拆卡或授权调整。其他组件及关联任务原有验收不在本卡改写。

## 实现提示

先读根 AGENTS.md 及对应 docs/agents 主题。SessionNotices/useSessionAutomation 承接通知和恢复逻辑；ChatInput/ChatWindow 只挂载通知与转交已有动作。

所有 fork 样式在 files_shared 的 app/native-theme.css：只在本组件带注释的分节内追加规则（如 /* C08 composer */），不改他人分节。本卡分节标识为 /* C37 限流、重试与错误提示 */；除 C01 主题令牌分节外，选择器/动画名限定本组件，不重写全局重置或他人令牌。共享 CSS 由协调者按卡串行合入，冲突只迁移自己的分节。

重复文件主卡：`components/ChatInput.tsx` → PIL-0122；`components/ChatWindow.tsx` → PIL-0137；`components/ChatInput.automation.test.mjs` → PIL-0123。files_shared 中这些壳层只允许引入/导出、注册、props/回调或挂载的少量追加，实质改动留在上述子组件；大改需求须先由规划者修订范围。共享的既有定向测试只运行、不改写，新增用例放本卡独占测试，不删减原断言。

拟新增（当前分支不存在，不表示已有 consumer）：`components/SessionNotices.tsx`、`components/SessionNotices.test.mjs`。接线完成后必须验证真实 consumer，不能保留假功能占位。

原生 IME/DPI、真实能力、浏览器与视觉分别由独立验证者取证，缺参考保留待补。

应用菜单、下拉与选择器统一使用 .app-menu、共享菜单令牌和 AppSelect；如涉及菜单改动，运行 `node --test scripts/ui-menu-consistency.test.mjs`；共享 choices 改动另跑 `node e2e/option-controls.mjs`。视觉同时记录桌面及窄宽状态。files_shared 只授权本卡入口的小量接线；需要实质修改主卡文件时先修订范围并串行，不用共享声明隐藏重叠。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 创建
- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 由PIL-0014按C37补齐目标、背景、同帧量测／交互／专属残差与具体文件范围；保持todo和未冻结，无实现或通过证据，交规划者复核。主任务板待协调者统一提交。

- 2026-10-21T08:01Z · codex-plus:gpt-xhigh:planner · 做了：以当前磁盘与上一轮草案重建冻结前修订，补全组件状态/容差/专属交互、真实能力依赖和文件主卡；保留已有日志。P2：首发必需，当前无其他卡依赖，不占 P1。 / 状态：仅 round2 草案，todo、未冻结、无实现通过证据 / 下一步：宿主协调者审阅 before/after、全板校验与交接后应用并独立复核 / 风险：参考版本/换算与实机能力仍按各卡验收取证，范围外冲突见 round2/HANDOFF.md。
- 2026-10-21T12:33Z · claude:sonnet-high:planner · 冻结前修订第3轮：A5 补跑共享/壳层既有测试（只运行不改写）：ChatInput.test.mjs、ChatInput.automation.test.mjs、ChatWindow*.test.mjs；G1 ΔE 固定 CIEDE2000 与 3.1623 换算（÷1.5）；G4 基准改 3.1623.0.0 并写明 3.1623 参考覆盖/待补采；G6 删除过期文字；参考归属 rate-limit-light（R27，降采样附件，只登记机制）；A1 加会话/提供商限额态；A4 写明夹具验证方法
