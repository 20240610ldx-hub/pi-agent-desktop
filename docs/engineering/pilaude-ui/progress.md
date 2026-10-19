# 进度与证据

更新日期：2026-10-19。功能、实际浏览器、Windows 原生与参考一致性分开记录。以下测试数字属于各自运行，不能相加冒充完整 npm test／E2E。

## 已保存检查点

仓库：`pi-agent-desktop`；分支：`fusion/pi-claude-desktop`。最新产品实现检查点 `184fade` 及前一 `5eb9bfa` 均已 atomic push 到 product 的 main 与同名融合分支。后续工程记录同步提交以实际 HEAD 为准，不增加产品验收范围。

| 提交 | 已验证结果 | 限制 |
| --- | --- | --- |
| `c97b994` | 事件证明的有限步骤动效、重连快照来源、长工具名与输出边界 | Windows 视觉／OS 仍未通过 |
| `c2c518e` | Compact shell、真实 Sending、复杂 Markdown 末尾光标、触控 Copy | formula／Artifact／超大 fallback 与完整回归仍待验 |
| `8ceff57` | 既有 PrismLight 的 bounded shell consumer，精确复制与完整 plain fallback | 原像素绿色／未知 scale 仍有残差 |
| `5eb9bfa` | 长消息同文本宽度／字体重排、隐藏返回、手动展开、ARIA／触控、精确复制；六 hook 测试、十二实际页面检查、类型与 lint | ChatMessageBubbles 仅局部采用，不是完整组件或原生视觉通过 |
| `184fade` | 模型显式章节工具／持久化／实时与历史／粗体锚点、256px目录、动态居中、工程文档和AGENTS入口；323项组合与最终六组＋一组实际页面通过 | 极短busy＋长草稿导航空间、Windows原生与完整视觉仍未通过 |

`5eb9bfa` 最终证据：`test-results/pilaude/user-message-overflow/run-1792383262052/results.json`。同一节点自然高 224→537px，窄窗正确 cap220；字体固定宽度 224↔282px；coarse target 49.39×44px。父级相关回归 117 项通过，最终 ownership／CSS 15 项通过；完整 lint 保留 TerminalPanel 已有一条 ARIA warning。原始 RED `run-1792382339554` 与中间失败记录保留。

## 当前章节与布局修正

| 边界 | 当前证据 | 状态 |
| --- | --- | --- |
| 导航来源 RED | `conversation-navigator-layout/run-1792383704804/`：已有十二个合法章节，目录仍列三十六条用户问题 | 旧语义验收撤回 |
| 布局 RED | `run-1792383819453/`：2000px 视口、左栏最窄时正文／composer 中心偏右238px，最宽时88px；Files 下两轴另差16.4px；目录固定278.39px | 原始报告／图保留 |
| 核心工具链 | `conversation-chapter-extension` 真实 faux model → append → createAgentEventStream → disk reopen → session-reader；173 项定向组合、tsc／target lint／diff通过 | 源码冻结 |
| 核心独立复查 | 实际 SDK 切分支 A/B→C→返回，显式 leaf 只得对应章节；实际 wire→公开 hook 双次 replay、后续工具完成／正文继续、重连一次记录均通过 | 未发现确认问题；无真实模型／外网 |
| UI consumer | 初轮87项；独立 review 发现章节显示边界会误取消同批 queued tool，补公开 RED→GREEN 后88项、tsc／target lint通过 | 重新冻结，实际页面待最终记录 |
| 新布局矩阵 | 首轮 `run-1792384210940/` 数值已正确，仅命中字段写入report副本记账失败；`run-1792384255147/` 四状态数值通过但最窄栏有Context遮挡。最终 `run-1792384456445/` 通过真实按钮逐状态关闭Context后，左栏180↔480、右栏300↔1100四状态，正文／composer中心误差0、轴差0、目录256px，轨道与可见菜单行 native hit通过 | 最终四状态GREEN，截图已读取；旧失败保留 |
| 最终浏览器矩阵 | `run-1792384522954/` 六组通过：Session start＋十二章、同用户请求多章／同名不同ID、strong锚点、点击／键盘／IME／焦点／草稿／手动历史、body hover关闭及native hit、实时追加／重放去重、256px＋ellipsis、深浅／侧栏／Files／2200／900／390／390×340 | 六组GREEN，十六张最终图均已读取，八个目录样本行中心命中均真，中心偏差均0，page／console／nonRead／external均空；Files浅色图有已知Context遮挡，上述4456445提供无遮挡证据；未证明极短busy＋长草稿状态 |

父级最终组合 323 项通过，覆盖核心／UI／hook／producer／session-reader／i18n／extraction／ownership／CSS；最终类型与完整 lint 通过，保留 TerminalPanel 已有一条 warning。更新 manifest 后另有15项 ownership／CSS通过，不能把这些重复计入总数。工程文档内链接已检查可解析。

核心行为新增真实失败再修复：章节投影若走一般 `message_end` 会清除当前 thinking／stream；现章节专用追加保留 streamState／agentPhase。分页 wholeTurns 原先会跨过章节回到用户锚点，现以章节作阶段边界。详细合同见 [technical-spec.md](technical-spec.md)。

## 保留的未提交独立切片

| 文件／范围 | 状态 | 接续动作 |
| --- | --- | --- |
| `components/ArtifactCard.tsx`、`MarkdownBody.tsx`、`MarkdownBody.caret.test.mjs` 的 optional marker forwarding | 九 renderer GREEN、tsc／target lint、独立 review clean；未实际 browser card 验证 | 不把此修改混入章节通过声明；之后验证 inline source／mounted opener card 生命周期 |
| `e2e/activity-command-layout.mjs` 的 divider 扩展 | 未验证 checker WIP，未开始该轮 RED，无对应产品 CSS 修改 | 章节优先级结束后恢复一次真实 RED→最小分隔 paint→GREEN |
| provider rename stash | `stash@{0}` 已存在、未恢复 | 保持原样，不与当前任务混用 |

## 仍未完成

- 导航／布局本轮源码与常规／settled实际页面已通过，184fade检查点已保存并推送；整体复刻仍继续。
- 已确认极短390×340＋活动run＋长草稿时目录仅约10px，未修；最终短窗通过不包含该组合。小于280px可用宽度的目录clamp也未实际覆盖。
- 章节只有当前加载历史范围的数据；不存在全会话章节索引服务，不能把未加载尾部称作真实 Session start。
- Artifact card／formula-only／超大 raw fallback caret 的完整活动和清理。
- 原生结构化 Plan/Todo。可选扩展的 ANSI widget 不是该能力。
- Windows 真机 GUI、WebView／DPI、原生 clipboard／Code.exe 启动以及完整 npm／terminal E2E。
- 完整逐状态视觉一致性；已接入／测试通过／某张图可读不等于完全复刻。

所有实际 browser 夹具使用生成文字并拦截 API／SSE／clipboard，不执行参考图命令或真实模型。私有参考与衍生叠图仅存在本地忽略路径。
