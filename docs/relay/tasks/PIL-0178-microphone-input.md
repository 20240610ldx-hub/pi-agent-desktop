---
id: PIL-0178
title: 真实麦克风采集、活动采样与资源释放
epic: E2
priority: P1
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: []
files_allowed: [lib/microphone-input.ts, lib/microphone-input.test.mjs, hooks/useMicrophoneInput.ts]
files_shared: []
acceptance_sha:
waivers: []
---

## 目标

为 C26 提供由真实 Windows 麦克风驱动的采样/电平与可取消资源生命周期；界面可以据实显示输入活动，不再只有随机条形动画。对应 GOALS E2。

## 背景与现状

C26 当前无真实音频输入 consumer。用户 2026-10-21 要求先建能力卡，再实现界面；本卡只提供采集能力与状态契约，PIL-0140 消费，样式另验。拟新增所列文件，优先级 P1：PIL-0140 依赖。

## 验收标准

- [ ] A1 在 Windows WebView2 真设备由显式 start 发起一次麦克风授权；允许后拿到活动音轨及非空连续采样，口述/静音产生可观测不同电平，记录设备/采样率/帧时间。验证：实机操作日志和原始数值摘要；无模型调用，不用随机/固定值代采样。
- [ ] A2 拒绝权限、无设备、设备被占用/拔除分别返回可区分错误，未获许可时无采样与后台重试；恢复权限或更换设备后可再次显式 start。验证：实机逐路径步骤，状态与音轨数记录。
- [ ] A3 stop、AbortSignal、组件卸载与退出停止所有 tracks、断开节点/关闭 AudioContext；连续 start/stop 五轮无多余轨道/监听器，陈旧授权回调不能重新启用设备。验证：真实设备资源计数 + lib/microphone-input.test.mjs 的并发/迟到事件夹具。
- [ ] A4 hook 导出 idle/requesting/active/denied/error 与真实采样数据，单一 consumer 可订阅/解绑；默认不上传、不保存录音，不改变全局输入设备。验证：浏览器网络/文件观察及 hook consumer 临时验证入口，入口不进入发行产品。
- [ ] A5 由独立验证者运行受影响定向测试：`node --test lib/microphone-input.test.mjs`；`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0178`。期望：测试、类型检查和 lint 全部通过，guard 无阻断；不得删减/跳过测试或放宽阈值。逐 A 项记录实际结果、步骤/命令、仓库外证据、对应提交和验证者标签；单元/夹具、真实 SDK/进程、浏览器、Windows 原生及视觉证据分层，缺条件记未运行，不能据此称产品验收通过。

## 范围外

语音转写、语音合成、云录音服务、视觉活动条及默认开启录音。

## 实现提示

先读 docs/agents/client-platform.md；新能力模块不得依赖组件。getUserMedia/采样细节由实现者查询当前文档；默认只在用户操作后启动。

所列新文件为拟新增能力入口；只在这些后端/服务文件实现，UI 归对应 E2 卡。files_shared 仅少量类型/桥接/模块注册，不转移实质逻辑；不绕过现有授权与生命周期。保持 todo 和空 acceptance_sha；本轮不实现、不 freeze，也不记录通过证据。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-21T07:22Z · codex-plus:gpt-xhigh:planner · 创建
- 2026-10-21T07:37Z · codex-plus:gpt-xhigh:planner · 做了：创建能力卡编号并完成仓库外待应用规划草案，尚未填写本卡模板 / 状态：原组件卡 PIL-0115 写入经文件接口、apply_patch、独立 Node 三次均 EPERM，按规则停止；本卡仍未冻结，不可领取，P1 为对应界面/能力依赖路径的拟定优先级 / 下一步：宿主修复既有任务文件写权限后，协调者从 planner-2026-10-21/draft-card-changes.json 核对差异与当前 tip，再由规划者应用和复核，勿直接当完成卡 / 风险：62 原卡及 parity-index 尚未修订，重叠和依赖问题未解决；未改 ACL、未运行 Git 写命令或产品测试。

- 2026-10-21T08:01Z · codex-plus:gpt-xhigh:planner · 做了：以当前磁盘与上一轮草案重建冻结前修订，补全组件状态/容差/专属交互、真实能力依赖和文件主卡；保留已有日志。P1：PIL-0140 依赖本卡，属首发能力/主组件依赖路径。 / 状态：仅 round2 草案，todo、未冻结、无实现通过证据 / 下一步：宿主协调者审阅 before/after、全板校验与交接后应用并独立复核 / 风险：参考版本/换算与实机能力仍按各卡验收取证，范围外冲突见 round2/HANDOFF.md。

