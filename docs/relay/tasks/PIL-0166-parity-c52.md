---
id: PIL-0166
title: 复刻验收：C52 托盘、系统通知与关窗状态
epic: E2
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0014, PIL-0090, PIL-0111]
files_allowed: [components/desktop/DesktopAppSection.tsx, lib/desktop-notify.ts, components/desktop/DesktopAppSection.test.mjs, src-tauri/src/shell/platform_tray.rs, lib/desktop-notify.test.mjs, src-tauri/src/notification_activation.rs]
files_shared: [src-tauri/src/lib.rs, src-tauri/Cargo.toml, src-tauri/Cargo.lock, app/native-theme.css]
acceptance_sha: 2e430448ed9f
waivers: []
---

## 目标

完成 C52「托盘、系统通知与关窗状态」的真实产品呈现与逐状态复刻，使独立验证者能按同帧量测和交互矩阵判断是否达到 [GOALS E2](../GOALS.md)。这是完整组件验收卡。

## 背景与现状

- 索引：[parity-index](../parity-index.md#组件清单)，组件 C52。
- 参考覆盖：不齐：tray-light／2026-10-21 已补 Windows 托盘右键菜单；完成通知用户指定为 Windows 原生 toast，深色/隐藏/失败等全态仍缺。R 键与目录名见索引；只读 manifest，不复制原图、账号、邮箱或个人路径。参考目标 Windows Claude Desktop 3.1623.0.0（GOALS，用户 2026-10-21 决定）；2.42304.0 与版本未知批次只作历史/机制参考，不混作同版本。上述已补各图均为聊天附件（见下条），未补状态为 3.1623 待补采；缺 3.1623 同态原生参考的状态严格记未运行，补采清单见 PIL-0014 证据目录 planner-2026-10-21/round3/RECAPTURE.md（只有用户能截 Claude 窗口，截图前按 Ctrl+0 重置应用缩放）。
- 实现记录：Tauri系统能力保留；生命周期独立验收任务。这不是当前运行通过证明。
- 历史证据位置：H00。H键在索引历史证据表定位；旧报告未重新绑定本提交，不能沿用为新通过证据。
- 已知残差：已有托盘菜单与等待输入通知局部；隐藏/退出/权限失败与点击恢复等全状态原生实测仍缺。
- 相关卡：PIL-0090、PIL-0111；相关卡只处理其原定功能／残差，不抵本组件完整复刻验收。
- 拟新增（当前分支不存在）：`components/desktop/DesktopAppSection.test.mjs`。列名用于明确草案范围，不表示已有consumer。
- 2026-10-21 新参考：tray-light／2026-10-21。用户自报 Windows Claude 3.1623.0.0、2560×1600、150%，浅色/zh-CN；manifest 标记该批为聊天附件（可能重编码/降采样，缩放未知），只登记机制，不当原生像素量测；A2 数值项待同状态 3.1623 原生补采，否则记未运行。不与 2.42304.0 批次混作同版本；未有新运行/视觉通过证据。

- 新增参考：tray-light/2026-10-21/01-windows-toast-waiting-for-input.png，登记“等待用户输入”的 Windows 原生 toast，由系统绘制，非应用 DOM；与完成通知分别测试。图像仅作内容层级与触发机制参照，不复制私有项目名或 toast 图片。

## 验收标准

- [ ] A1 建立托盘菜单显示应用/真实用量/退出、主窗隐藏/恢复，以及完成和等待用户输入两类 Windows 原生通知的状态矩阵。逐项记录真实事件、前台/隐藏状态、通知权限、内容模板、会话标识和点击目标；用公开测试名称与正文，不采用图中私人内容。托盘/应用设置按各自参考批次登记版本、系统 DPI、应用缩放和主题；系统 toast 不作 DOM 像素复刻。
- [ ] A2 在同帧/同状态/同测试数据、相同客户区/系统 DPI/应用缩放下给出参考值、实现值、原像素与 CSS px、差值和残差。采用用户 2026-10-21 批准容差：同 DPI 下盒子宽高与间距 ≤1 CSS px；文字基线 ≤1 CSS px；宽高比 ±1%；圆角 ≤0.5 CSS px；图标中心对齐 ≤1 CSS px；颜色 ΔE ≤2（CIEDE2000，sRGB→CIELAB D65，在同一像素采样区取中位色；不得改用较宽松算法）。抗锯齿与字形 ink 差异单列为残差，不计入几何容差。参考值换算：3.1623 原生截图按 SAMPLING 记录（显示器 150%、AppliedDPI 144；Claude 应用缩放 100%，用户 2026-10-21 确认），CSS px = 原像素 ÷ 1.5；聊天附件（manifest 标注可能降采样/重编码）、macOS 及版本/缩放未知的批次只登记机制，不由图宽或嵌入 DPI 反推 CSS px，其数值项记未运行并待 3.1623 原生补采。验证方法：量测表与差异图存 relay-evidence/PIL-0166/。叠图只作整数裁剪/平移，不对原图插值重采样；不以残差登记替代数值达标。 原生表面按同一 Windows build/系统主题/记录 DPI 取证；DOM 入口与 OS 表面分开量测，不以网页截图代系统结果。 本条几何与颜色容差只用于应用绘制的设置控件；Windows 原生 toast 的系统字体、边框、圆角、位置与抗锯齿不纳入像素复刻，按 A3/A4 验通知内容、触发和点击行为。托盘系统菜单记录 OS/DPI/主题条件及项目顺序/文字/可达性，不强套 DOM 尺寸。
- [ ] A3 在本机 Windows 11 实机（用 ver/winver 记录 build 号；Windows 10 归 E11/PIL-0111，不在本卡）操作托盘显示/退出，隐藏主窗后任务继续，恢复后焦点正确；分别令公开测试会话完成、进入等待用户输入，检查应用名、状态文案与可用的会话提示准确。前台抑制、通知关闭/权限拒绝、同一事件去重、切换会话与退出后的迟到事件逐项验证；点击 toast 激活正确窗口和会话且不自动批准/提交答案/重发任务。原生激活回调与系统通知中心实测，API 调用成功或 mock 不算点击通过。IME 和 DOM 列表滚动不适用于托盘/toast，应用设置焦点与缩放仍需验证。 点击激活的验收构建必须写明是开发版还是安装版（WinRT toast 点击回调通常只在有开始菜单快捷方式与 AppUserModelID 的安装版成立）；tauri-plugin-notification 在 Windows 桌面端没有可靠点击回调时，允许在本卡内新增原生激活模块 src-tauri/src/notification_activation.rs（WinRT toast + AUMID + 激活回调），并按需追加 src-tauri/Cargo.toml/Cargo.lock 依赖（均已列入范围）；该路径在开发版上无法激活时，点击跳转项记未运行，不得以插件调用成功代替。
- [ ] A4 按 tray-light/2026-10-21 核对托盘显示应用、用量状态与退出机制，未知用量据实显示 unknown；01-windows-toast-waiting-for-input.png 只补等待输入通知机制。完成及等待输入均使用 Windows 原生 toast，验收通知内容/触发条件/权限失败/去重/点击跳转及退出清理，不复刻系统 toast 外观或创建 DOM 仿制卡。验证者用两条不同会话公开标记核对通知与点击目标，记录 Windows build、通知设置、系统主题和实际结果。
- [ ] A5 由独立验证者运行受影响定向测试：`node --test components/desktop/DesktopAppSection.test.mjs lib/desktop-notify.test.mjs`；`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0166`。期望：测试、类型检查和 lint 全部通过，guard 无阻断；不得删减/跳过测试或放宽阈值。逐 A 项记录实际结果、步骤/命令、仓库外证据、对应提交和验证者标签；单元/夹具、真实 SDK/进程、浏览器、Windows 原生及视觉证据分层，缺条件记未运行，不能据此称产品验收通过。

## 范围外

不修改app/globals.css、app/settings.css及受保护基线；不拷贝私人截图、字体或秘密，不转写图中账号／邮箱／个人路径。不借本卡扩建执行后端或更改权限／模型／会话语义；缺依赖能力或文件范围不足时先交规划者拆卡或授权调整。其他组件及关联任务原有验收不在本卡改写。

## 实现提示

先读根 AGENTS.md 及对应 docs/agents 主题。platform_tray/DesktopAppSection/desktop-notify 承接托盘与 toast；lib.rs 仅注册/调用模块，不改窗口命令。

所有 fork 样式在 files_shared 的 app/native-theme.css：只在本组件带注释的分节内追加规则（如 /* C08 composer */），不改他人分节。本卡分节标识为 /* C52 托盘、系统通知与关窗状态 */；除 C01 主题令牌分节外，选择器/动画名限定本组件，不重写全局重置或他人令牌。共享 CSS 由协调者按卡串行合入，冲突只迁移自己的分节。

重复文件主卡：`src-tauri/src/lib.rs` → PIL-0146。files_shared 中这些壳层只允许引入/导出、注册、props/回调或挂载的少量追加，实质改动留在上述子组件；大改需求须先由规划者修订范围。共享的既有定向测试只运行、不改写，新增用例放本卡独占测试，不删减原断言。

拟新增（当前分支不存在，不表示已有 consumer）：`components/desktop/DesktopAppSection.test.mjs`。接线完成后必须验证真实 consumer，不能保留假功能占位。

原生 IME/DPI、真实能力、浏览器与视觉分别由独立验证者取证，缺参考保留待补。

lib/desktop-notify.ts 负责两类通知及激活路由，原生事件注册可在 files_shared 的 src-tauri/src/lib.rs 少量追加；业务路由留在独占通知模块。普通通知到达不能自动触发权限决定或模型发送。

应用菜单、下拉与选择器统一使用 .app-menu、共享菜单令牌和 AppSelect；如涉及菜单改动，运行 `node --test scripts/ui-menu-consistency.test.mjs`；共享 choices 改动另跑 `node e2e/option-controls.mjs`。视觉同时记录桌面及窄宽状态。files_shared 只授权本卡入口的小量接线；需要实质修改主卡文件时先修订范围并串行，不用共享声明隐藏重叠。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 创建
- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 由PIL-0014按C52补齐目标、背景、同帧量测／交互／专属残差与具体文件范围；保持todo和未冻结，无实现或通过证据，交规划者复核。主任务板待协调者统一提交。
- 2026-10-21T07:13Z · claude:opus-medium:coord · 新增参考：references/claude-desktop/tray-light/2026-10-21（托盘右键菜单：显示应用、套餐、用量百分比、退出）。用户 2026-10-21 确认：完成通知是 Windows 原生 toast，不做应用内卡片，验收以系统通知为准。浅色、zh-CN，Claude 3.1623.0.0，2560×1600@150%（聊天附件，可能经缩放，见 manifest）。冻结前由规划者据此补全 A4。

- 2026-10-21T08:01Z · codex-plus:gpt-xhigh:planner · 做了：以当前磁盘与上一轮草案重建冻结前修订，补全组件状态/容差/专属交互、真实能力依赖和文件主卡；保留已有日志。P2：首发必需，当前无其他卡依赖，不占 P1。 / 状态：仅 round2 草案，todo、未冻结、无实现通过证据 / 下一步：宿主协调者审阅 before/after、全板校验与交接后应用并独立复核 / 风险：参考版本/换算与实机能力仍按各卡验收取证，范围外冲突见 round2/HANDOFF.md。
- 2026-10-21T12:33Z · claude:sonnet-high:planner · 冻结前修订第3轮：G1 ΔE 固定 CIEDE2000 与 3.1623 换算（÷1.5）；G4 基准改 3.1623.0.0 并写明 3.1623 参考覆盖/待补采；G6 删除过期文字；G4 补写 3.1623 基准与待补采；A3 写明验收机器为本机 Windows 11（记录 build 号）；点击 toast 跳转若插件不可靠允许新增原生激活模块（files_allowed 加 notification_activation.rs，files_shared 加 Cargo.toml/Cargo.lock）
- 2026-10-21T12:38Z · planner · 冻结验收标准 2e430448ed9f
