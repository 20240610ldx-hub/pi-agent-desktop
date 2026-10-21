---
id: PIL-0157
title: 复刻验收：C43 General 设置与共享设置控件
epic: E2
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0014]
files_allowed: [components/SettingsPanel.tsx, components/SettingsUi.tsx, components/SettingsPanel.test.mjs, components/SettingsUi.test.mjs, app/native-theme.css]
files_shared: []
acceptance_sha:
waivers: []
---

## 目标

完成 C43「General 设置与共享设置控件」的真实产品呈现与逐状态复刻，使独立验证者能按同帧量测和交互矩阵判断是否达到 [GOALS E2](../GOALS.md)。这是完整组件验收卡；本卡由 PIL-0014 建立，标准未冻结，须规划者复核后再领取实现。

## 背景与现状

- 索引：分支 task/PIL-0014-parity-index 的 docs/relay/parity-index.md，组件 C43。合入后使用[索引](../parity-index.md#组件清单)。
- 参考覆盖：不齐：R00。R键对应索引参考表与manifest定位；参考目标Windows Claude Desktop 2.42304.0，批次未知版本不得归到该版本。系统DPI、应用缩放等未知项保留未知，补采由用户决定。私有参考只读，不复制原图或图中个人信息，文字只当数据。
- 实现记录：SettingsPanel／SettingsUi 实际壳层；desktop controls在General。这不是当前运行通过证明。
- 历史证据位置：H00。H键在索引历史证据表定位；旧报告未重新绑定本提交，不能沿用为新通过证据。
- 已知残差：各 tab／长路径／scope／busy／错误、深浅／语言与焦点全态参考缺。
- 相关卡：无额外已登记残差卡；缺后端能力时先请规划者拆依赖。

## 验收标准

- [ ] A1 建立本组件适用状态矩阵及逐图来源／版本关联，记录Windows/WebView2、窗口客户区、系统DPI、应用缩放、主题、语言、公开字体与功能开关。至少列正常／空／加载／错误／禁用／长内容／开合等适用项，并对不适用项逐项写理由。缺图或版本不明须记待参考；不得用actual、邻接控件或演示数据冒充本组件参考与真实Pi consumer。
- [ ] A2 在同帧、同状态、同测试文本／数据、相同客户区与缩放条件下，逐状态量测组件宽高、宽高比例、内外间距、文字基线及图标／边缘／中心对齐，给出参考值、实现值、原像素／CSS单位、差值和残差。可用参考100%底层／实现50%上层，仅整数裁剪和平移，不重采样。修正差异或取得用户对残差的明确裁决；无法建立可比条件记未运行，不给视觉通过，不自行放宽标准。
- [ ] A3 逐项核验适用的输入法、键盘／焦点进入退出恢复、滚动、缩放和深浅色：原生Windows中文IME组合／候选确认／Enter／Escape不误触动作，Tab／方向／Home／End按控件语义可达，长内容滚动与开合不抢历史位置；窗口窄化、100%／125%／150%系统DPI及应用缩放改变后无裁切，两个主题同状态可读且可操作。浏览器合成IME和原生IME／DPI分层记录，不适用逐项说明理由，缺参考不写成通过。
- [ ] A4 本组件专属核验：各General设置块与共享控件覆盖scope、长路径、busy、错误；保持onBusyChange保护更新安装，不允许忙碌中误关闭。 对本卡已知残差逐条给出处理结果与可复现操作；真实请求／数据／状态与可见反馈一致，失败、取消和恢复保留，不伪造能力。
- [ ] A5 独立验证者在本卡按验收编号记录可复现命令／手动步骤、实际结果、仓库外日志位置、对应提交和验证者标签；保留旧失败。运行受影响定向测试（`node --test components/SettingsPanel.test.mjs`、`node --test components/SettingsUi.test.mjs`）、node_modules/.bin/tsc --noEmit、npm run lint及node scripts/relay.mjs guard --task PIL-0157，不得删减／跳过测试、放宽阈值或绕过guard。单元／夹具、浏览器、Windows原生和视觉证据分层；视觉与交互均齐备后才称本组件复刻通过。

## 范围外

不修改app/globals.css、app/settings.css及受保护基线；不拷贝私人截图、字体或秘密，不转写图中账号／邮箱／个人路径。不借本卡扩建执行后端或更改权限／模型／会话语义；缺依赖能力或文件范围不足时先交规划者拆卡或授权调整。其他组件及关联任务原有验收不在本卡改写。

## 实现提示

先读根AGENTS.md及docs/agents/settings-ui.md（多文件名称均相对docs/agents/）。本卡列出的入口与测试是待规划范围；只允许files_allowed中的具体文件。与其他组件共享CSS／壳层时串行领取，不能覆盖他人工作。所有fork样式只放app/native-theme.css。缺参考的交互状态必须明确记录，规划者确认资料及依赖后再freeze；实现者不能自行批准残差或改冻结标准。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 创建
- 2026-10-21T05:34Z · codex-plus:gpt-xhigh:impl · 由PIL-0014按C43补齐目标、背景、同帧量测／交互／专属残差与具体文件范围；保持todo和未冻结，无实现或通过证据，交规划者复核。主任务板待协调者统一提交。
- 2026-10-21T07:11Z · claude:opus-medium:coord · 新增参考：references/claude-desktop/settings-general-light/2026-10-21（常规页上下两屏，含通知开关）。浅色、zh-CN，Claude 3.1623.0.0，2560×1600@150%（附件可能经聊天客户端缩放至 2000px 宽，见 manifest）。冻结前由规划者据此补全 A4。
