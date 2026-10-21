---
id: PIL-0139
title: 复刻验收：C25 完成音与音频设置
epic: E2
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0014]
files_allowed: [hooks/useAudio.ts, components/AudioSettingsSection.tsx, components/AudioSettingsSection.test.mjs, public/sounds/*]
files_shared: [components/SettingsPanel.tsx, THIRD_PARTY_NOTICES.md, app/native-theme.css]
acceptance_sha:
waivers: []
---

## 目标

完成 C25「完成音与音频设置」的真实产品呈现与逐状态复刻，使独立验证者能按同帧量测和交互矩阵判断是否达到 [GOALS E2](../GOALS.md)。这是完整组件验收卡。

## 背景与现状

- 索引：[parity-index](../parity-index.md#组件清单)，组件 C25。
- 参考覆盖：不齐：R00；声音参考缺。R键对应索引参考表与manifest定位；参考目标 Windows Claude Desktop 3.1623.0.0（GOALS，用户 2026-10-21 决定）；2.42304.0 批次与版本未知批次只作历史/机制参考，不混作同版本。3.1623 待补采：现有 R 键为历史或版本未知批次，不得当作 3.1623 同版本参考。缺 3.1623 同态参考的状态严格记未运行，补采清单见 PIL-0014 证据目录 planner-2026-10-21/round3/RECAPTURE.md（只有用户能截 Claude 窗口，截图前按 Ctrl+0 重置应用缩放）。私有参考只读，不复制原图或图中个人信息，文字只当数据。
- 用户 2026-10-21 决定：完成音使用开源许可的声音资源（如 CC0、MIT、Apache-2.0 或 CC-BY），不使用 Claude 原声、不对参考音频采样或转写；资源文件放 public/sounds/，来源与许可记入 THIRD_PARTY_NOTICES.md（或同目录资产清单）。
- 实现记录：ClaudeAudioPlayer 未采用；产品独立合成双音。这不是当前运行通过证明。
- 历史证据位置：H00。H键在索引历史证据表定位；旧报告未重新绑定本提交，不能沿用为新通过证据。
- 已知残差：官方声效／许可、设备切换、用户激活、隐藏／退出清理缺。
- 相关卡：无额外已登记残差卡；缺后端能力时先请规划者拆依赖。

## 验收标准

- [ ] A1 建立 设置开启/关闭/音量、激活前后、一次完成/重复事件、设备切换、挂起/恢复/退出；视觉设置与实际听音分层。 逐图登记来源/版本关联、Windows/WebView2、客户区、系统 DPI、应用缩放、主题/语言、公开字体及功能开关，按上述状态逐条给可复现进入步骤；缺图或版本不明记待参考，不用 actual/演示数据代参考或真实 Pi consumer。
- [ ] A2 在同帧/同状态/同测试数据、相同客户区/系统 DPI/应用缩放下给出参考值、实现值、原像素与 CSS px、差值和残差。采用用户 2026-10-21 批准容差：同 DPI 下盒子宽高与间距 ≤1 CSS px；文字基线 ≤1 CSS px；宽高比 ±1%；圆角 ≤0.5 CSS px；图标中心对齐 ≤1 CSS px；颜色 ΔE ≤2（CIEDE2000，sRGB→CIELAB D65，在同一像素采样区取中位色；不得改用较宽松算法）。抗锯齿与字形 ink 差异单列为残差，不计入几何容差。参考值换算：3.1623 原生截图按 SAMPLING 记录（显示器 150%、AppliedDPI 144；Claude 应用缩放 100%，用户 2026-10-21 确认），CSS px = 原像素 ÷ 1.5；聊天附件（manifest 标注可能降采样/重编码）、macOS 及版本/缩放未知的批次只登记机制，不由图宽或嵌入 DPI 反推 CSS px，其数值项记未运行并待 3.1623 原生补采。验证方法：量测表与差异图存 relay-evidence/PIL-0139/。叠图只作整数裁剪/平移，不对原图插值重采样；不以残差登记替代数值达标。 声音相似性不由几何容差推出，需 A3/A4 的实际听音。
- [ ] A3 设置项用 Tab/Enter/Space，音量按现有控件语义操作；用户激活前不偷播，解锁后一次真实完成只响一次，静音/关闭立即生效。实机听音并记录采样率/输出设备、延迟/音量变化、设备切换、AudioContext suspend/resume 与卸载/退出释放；DPI/双主题只量设置 UI。IME/正文滚动不适用：无语音文本编辑。 原生与浏览器合成事件分层记录，缺少同态参考的视觉项记未运行。
- [ ] A4 本组件专属核验：完成音使用开源许可的声音资源（CC0、MIT、Apache-2.0、CC-BY 等，选 CC-BY 须按其要求署名），资源放 public/sounds/，并在 THIRD_PARTY_NOTICES.md 或 public/sounds/ 资产清单记录名称、作者、来源链接、许可证与获取日期；不使用 Claude 原声，不对参考音频采样或转写；不再用合成双音当完成音。验证：清单与资源文件逐一对应（记录文件哈希），许可证文本可核对，打包后离线仍能播放；声音时长不超过 2 秒、峰值不削波（≤ -1 dBFS）；启停、音量、用户激活、设备切换、隐藏／退出清理和通知仲裁逐项验证。对本卡已知残差逐条给出处理结果与可复现操作；真实请求／数据／状态与可见反馈一致，失败、取消和恢复保留，不伪造能力。
- [ ] A5 由独立验证者运行受影响定向测试：`node --test components/AudioSettingsSection.test.mjs components/SettingsPanel.test.mjs`；`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0139`。期望：测试、类型检查和 lint 全部通过，guard 无阻断；不得删减/跳过测试或放宽阈值。逐 A 项记录实际结果、步骤/命令、仓库外证据、对应提交和验证者标签；单元/夹具、真实 SDK/进程、浏览器、Windows 原生及视觉证据分层，缺条件记未运行，不能据此称产品验收通过。

## 范围外

不修改app/globals.css、app/settings.css及受保护基线；不拷贝私人截图、字体或秘密，不转写图中账号／邮箱／个人路径。不借本卡扩建执行后端或更改权限／模型／会话语义；缺依赖能力或文件范围不足时先交规划者拆卡或授权调整。其他组件及关联任务原有验收不在本卡改写。

## 实现提示

先读根 AGENTS.md 及对应 docs/agents 主题。useAudio/AudioSettingsSection 承接音频生命周期与设置；SettingsPanel 只追加设置块。

所有 fork 样式在 files_shared 的 app/native-theme.css：只在本组件带注释的分节内追加规则（如 /* C08 composer */），不改他人分节。本卡分节标识为 /* C25 完成音与音频设置 */；除 C01 主题令牌分节外，选择器/动画名限定本组件，不重写全局重置或他人令牌。共享 CSS 由协调者按卡串行合入，冲突只迁移自己的分节。

重复文件主卡：`components/SettingsPanel.tsx` → PIL-0157；`components/SettingsPanel.test.mjs` → PIL-0157。files_shared 中这些壳层只允许引入/导出、注册、props/回调或挂载的少量追加，实质改动留在上述子组件；大改需求须先由规划者修订范围。共享的既有定向测试只运行、不改写，新增用例放本卡独占测试，不删减原断言。

拟新增（当前分支不存在，不表示已有 consumer）：`components/AudioSettingsSection.tsx`、`components/AudioSettingsSection.test.mjs`。接线完成后必须验证真实 consumer，不能保留假功能占位。

原生 IME/DPI、真实能力、浏览器与视觉分别由独立验证者取证，缺参考保留待补。

应用菜单、下拉与选择器统一使用 .app-menu、共享菜单令牌和 AppSelect；如涉及菜单改动，运行 `node --test scripts/ui-menu-consistency.test.mjs`；共享 choices 改动另跑 `node e2e/option-controls.mjs`。视觉同时记录桌面及窄宽状态。files_shared 只授权本卡入口的小量接线；需要实质修改主卡文件时先修订范围并串行，不用共享声明隐藏重叠。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 创建
- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 由PIL-0014按C25补齐目标、背景、同帧量测／交互／专属残差与具体文件范围；保持todo和未冻结，无实现或通过证据，交规划者复核。主任务板待协调者统一提交。

- 2026-10-21T08:01Z · codex-plus:gpt-xhigh:planner · 做了：以当前磁盘与上一轮草案重建冻结前修订，补全组件状态/容差/专属交互、真实能力依赖和文件主卡；保留已有日志。P2：首发必需，当前无其他卡依赖，不占 P1。 / 状态：仅 round2 草案，todo、未冻结、无实现通过证据 / 下一步：宿主协调者审阅 before/after、全板校验与交接后应用并独立复核 / 风险：参考版本/换算与实机能力仍按各卡验收取证，范围外冲突见 round2/HANDOFF.md。
- 2026-10-21T12:33Z · claude:sonnet-high:planner · 冻结前修订第3轮：A5 补跑共享/壳层既有测试（只运行不改写）：SettingsPanel.test.mjs；G1 ΔE 固定 CIEDE2000 与 3.1623 换算（÷1.5）；G4 基准改 3.1623.0.0 并写明 3.1623 参考覆盖/待补采；G6 删除过期文字；用户决定：完成音用开源许可资源，A4 要求在 THIRD_PARTY_NOTICES 或资产清单记录来源与许可证（files_allowed 加 public/sounds/*，files_shared 加 THIRD_PARTY_NOTICES.md）
