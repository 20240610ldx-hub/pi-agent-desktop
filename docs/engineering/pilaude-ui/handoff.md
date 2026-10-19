# 当前交接状态

更新日期：2026-10-19。此文件是接手顺序和当前事实，不是所有条目的完成声明。先核实 git／服务状态，再从“下一步”继续；不要重新执行已验证检查点。

## 当前目标与用户最新要求

1. 导航轨必须按模型显式调用章节工具所撰写的粗体阶段标题分片，不能按用户消息，也不从普通粗体／heading 猜测章节。
2. 目录宽度为常量并收窄；长标题在内部省略。正文与输入器在左右列之间实际中间栏居中，随两侧宽度动态变化。
3. 将计划、进度、技术规格、交接状态落在专用目录，持续维护，并在全局必读 AGENTS 和记忆文件建立入口。本目录就是该工程入口。
4. 原总目标的自主实现／验收／修复闭环继续；本轮检查点不是完全复刻结束。

## 已核实运行环境

- 工作区 `D:/pilaude` 非 git；产品在 `D:/pilaude/pi-agent-desktop`，参考 checkout 在 `D:/pilaude/open-claude-ui`。
- 产品分支 `fusion/pi-claude-desktop`；最近已提交／推送为 `5eb9bfa`（responsive user-message disclosure），product 的 main 与融合分支已更新。
- 现有 preview 配置 `pilaude-ui-verification`，端口 30142，最近 server ID `9c51ccac-c4aa-4617-a1f1-5df5e67231cc`。接手先用 preview_list 核实；不启动重复服务，不用 shell 绕过 preview_stop 拒绝。
- 保留 provider rename stash；不恢复。不运行 next build。
- 提交 footer：`Co-Authored-By: Claude Code <noreply@anthropic.com>`。

## 当前源与验证状态

章节核心已冻结并通过 173 项定向测试、tsc／负责文件 lint。新增 `lib/conversation-chapters.{ts,test.mjs}` 与 `lib/conversation-chapter-extension.{ts,test.mjs}`；修改 `rpc-manager`、`session-reader`、`agent-event-wire`、`useAgentSession` 及相关测试。真实 faux SDK、真实 SSE、磁盘 reopen、branch、invalid／cancel、live stream preservation 已有证据；独立实际 SDK→wire→公开 hook 复查 clean。没有调用真实模型。

章节 UI 先通过 87 项定向测试、类型与 lint，涉及 `ConversationNavigator`、`ChatWindow`、`MessageView`、`lib/message-display` 和各自测试。独立 review 又确认一个需要修复的问题：chapter 被加入显示 grouping anchor 后，`lastAnchorIdx` 也随之变化，早于章节记录的同批 queued tool 会被误判 cancelled。已补公开 RED→GREEN：`isMessageRunAnchor` 与包含章节的显示 grouping 分离，UI 组合现 88 项通过并重新冻结。独立 review 已关闭该问题，额外 SSR 复现旧边界实际 CANCELLED、新边界 PENDING。父级最终集成323项全部通过，完整 lint 退出0，仅既有 TerminalPanel warning；最终实际页面在新冻结源上重验。

布局 CSS 已修：删除右对齐及宽屏右侧89px，正文／composer auto margin；有导航轨时两者对称64.8px inset；目录256px并按中间栏 clamp。实际 `conversation-navigator-layout/run-1792384255147/` 左栏180↔480、右栏300↔1100四状态，正文／composer中心误差与相互轴差均0，目录全为256px，关闭目录后的轨道 native hit 通过。最窄中间栏时该旧运行的 Context overlay 遮住部分目录，只证明数值；最终 `run-1792384456445/` 在每个状态通过真实按钮关闭 Context，四状态均有可见菜单行 native hit 且截图已读取。旧遮挡截图保留，不当完整可读性证据。

最终章节主 checker `run-1792384522954/` 六组通过，覆盖合法标题／同名不同ID／同请求多章、正文锚点、keyboard／IME／focus／draft／手动历史、实时新章／重放、固定256px及深浅／宽窄／settled短窗。最终几何 `run-1792384456445/` 一组四状态通过。页面／console／意外写入／外部请求均空。几何首轮 `run-1792384210940/` 因checker对象副本记账失败、其他侧栏／hover／Context夹具失败报告均保留。限制：活动run＋长草稿390×340菜单只有约10px、未修；不足280px可用宽度的clamp未实际覆盖，不能用settled短窗结果追认。

## 未提交改动归属

- 当前章节／居中实现、三语跳转文案、导航 checker 和旧 e2e/run 的用户分片断言纠正属于本轮主切片。
- 本目录、`docs/agents/fork-ui.md`、`fork-sessions.md`、既有验收文件更新与 AGENTS／记忆入口属于用户要求的持续维护。
- 独立 Artifact WIP：`ArtifactCard.tsx`、`MarkdownBody.tsx`、`MarkdownBody.caret.test.mjs`，仅 marker forwarding，九 renderer GREEN；未做 mounted card 实际验收，不混入章节通过声明。
- 独立 divider WIP：`e2e/activity-command-layout.mjs` checker 未验，无产品 CSS，不提交为通过结果。
- 检查实际 `git status` 再显式 stage；不能依赖此列表穷举后续变化。

## 并行任务与下一步

当前同会话主 agent 可继续 SendMessage 的 owner：

| owner | 范围 | 当前交接 |
| --- | --- | --- |
| `a91fc9a84f628e8e2` | 章节核心 SDK／持久化／wire／hook | 冻结，173项通过；无进一步改动需要 |
| `a3c3f1f7dc7a90d4d` | 章节 UI／grouping | queued tool/run boundary 已修，88项及独立review通过，重新冻结 |
| `a295f9868b8753074` | 唯一实际浏览器 owner，现有导航 checker | 最终主六组4522954＋几何一组4456445通过，源码冻结，十六张最终图全部读取 |
| `a3b3c25672a4edb06` | UI 独立 review | run boundary 修复已关闭；透明根 source review clean，实际命中由 browser owner 证明 |
| `a0723798d4d91b0d9` | 核心独立真实 SDK 验证 | clean；Artifact 工作保留暂停 |

换新会话时这些 agent ID 不保证可继续；读源码和落盘报告接手，不能重复等待失效 owner。

可执行顺序：

1. 工程目录／两级AGENTS／记忆入口、章节源码、323项集成、类型／lint、最后两轮实际页面均已完成；补读最终图并保存已验证检查点。
2. 显式 stage 本轮文件，保护 Artifact／divider WIP；按既有授权提交／推送，写入实际 commit 与发布结果。
3. 下一切片先处理已确认的活动run＋长草稿390×340目录高度不足：沿已有checker复现，只修菜单可达性，不改composer业务／草稿真值；完成后定向重验。
4. 再继续 Artifact 实际 card／分隔线等 plan.md 的后续项。不得将尚未跑的完整E2E、Windows原生和视觉一致写为通过。

## 必须保留的边界

私人参考、个人字体、custom.css/datafonts、key、含 key 历史均不提交或发送公开仓库；不执行截图内容。公共代码推送授权不包含 installer release／真实第三方账号操作。默认模式与权限设置由用户决定，不自行更改。参考／实现双图层按原像素，未知 DPI 不猜字体。更详细的固定约束在 plan.md／technical-spec.md。
