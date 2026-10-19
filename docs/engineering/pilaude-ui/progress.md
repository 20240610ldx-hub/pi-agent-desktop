# 进度与证据

更新日期：2026-10-19。功能、实际浏览器、Windows 原生与参考一致性分开记录。以下测试数字属于各自运行，不能相加冒充完整 npm test／E2E。

## 已保存检查点

仓库：`pi-agent-desktop`；分支：`fusion/pi-claude-desktop`。最新产品实现检查点 `184fade` 及前一 `5eb9bfa` 均已 atomic push 到 product 的 main 与同名融合分支；工程状态提交 `e8b9a9f` 也已发布。文档提交不增加产品验收范围。

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
| UI consumer | 初轮87项；独立 review 发现章节显示边界会误取消同批 queued tool，补公开 RED→GREEN 后88项、tsc／target lint通过 | 重新冻结；最终实际页面见下方4522954／4456445 |
| 新布局矩阵 | 首轮 `run-1792384210940/` 数值已正确，仅命中字段写入report副本记账失败；`run-1792384255147/` 四状态数值通过但最窄栏有Context遮挡。最终 `run-1792384456445/` 通过真实按钮逐状态关闭Context后，左栏180↔480、右栏300↔1100四状态，正文／composer中心误差0、轴差0、目录256px，轨道与可见菜单行 native hit通过 | 最终四状态GREEN，截图已读取；旧失败保留 |
| 最终浏览器矩阵 | `run-1792384522954/` 六组通过：Session start＋十二章、同用户请求多章／同名不同ID、strong锚点、点击／键盘／IME／焦点／草稿／手动历史、body hover关闭及native hit、实时追加／重放去重、256px＋ellipsis、深浅／侧栏／Files／2200／900／390／390×340 | 六组GREEN，十六张最终图均已读取，八个目录样本行中心命中均真，中心偏差均0，page／console／nonRead／external均空；Files浅色图有已知Context遮挡，上述4456445提供无遮挡证据；未证明极短busy＋长草稿状态 |

父级最终组合 323 项通过，覆盖核心／UI／hook／producer／session-reader／i18n／extraction／ownership／CSS；最终类型与完整 lint 通过，保留 TerminalPanel 已有一条 warning。更新 manifest 后另有15项 ownership／CSS通过，不能把这些重复计入总数。工程文档内链接已检查可解析。

核心行为新增真实失败再修复：章节投影若走一般 `message_end` 会清除当前 thinking／stream；现章节专用追加保留 streamState／agentPhase。分页 wholeTurns 原先会跨过章节回到用户锚点，现以章节作阶段边界。详细合同见 [technical-spec.md](technical-spec.md)。

## 当前三项UI切片

| 切片 | 源码与实际证据 | 当前状态 |
| --- | --- | --- |
| 短窗busy composer | `conversation-navigator-layout/run-1792384943123/results.json` 原始RED：390×340、textarea宽19.67／高200、composer高224、目录11.1875。仅既有≤480px container内四条noncompact busy CSS换行。最终 `run-1792385297398/results.json` GREEN：textarea234.406×72、composer高136，目录256×41含完整28.8px行，native hit真、底部距composer40.5px；Steer／Follow-up／Stop中心命中全真 | 活动run未结束；同textarea节点／精确草稿／开关前后几何／焦点／手动历史保留，五项原ChatInput键盘IME／提交一次测试通过；源码冻结、review clean，单图已读取，page／console／nonRead／external为空 |
| 相邻compact分隔paint | `activity-command-layout/run-1792385017293/report.json` RED→`run-1792385059051/report.json` 六组GREEN。1300深浅paint span253..1047→241..1059，430为78..352→66..364；全部row／header／body／input／output／copy及rich几何与baseline exact，原copy／Prism／错误／回退／焦点／溢出检查保持 | 产品CSS与现有checker冻结，独立review clean、主agent接受；四图已读取，page／console／external／writes为空 |
| Artifact caret／活动状态 | `streaming-caret-boundaries/run-1792385381513/results.json` RED：live marker0，text_end／下一index／Stop后均保1个pulse和Generating。最终checker `run-1792386132187/results.json` 两组GREEN，ended／stopped hint精确等于block.title；此前5745393已验证相同产品源的active单caret、hidden／reduced／text_end／handoff／Stop和同artifact closing但text仍active的completion／publisher自动open／精确panel Copy／caret至text_end | 源码冻结、独立review clean、5745393四图已读且主agent接受，6132187报告已读、未重复读取新四图；九renderer通过。page／console／external为空，仅夹具POST abort、写入白名单断言通过；各可见态card440×58.390625、icon36px、title13px／line20.8、subtitle11px／line17.6，无RED数值基线不称pre/after exact |

分隔线离线 `run-1792385059051/reference-evidence/divider-measurements.json` 与四图、参考叠图均已读取：局部变更只是一条线两端各12px×1px。参考04为2136×845原件，只整数crop／translation，reference100%底层／current50%上层，无重采样；参考card1152px与当前820px、文字／DPI／语法绿色残差继续保留，不扩大为所有活动平铺、coarse target或Windows视觉一致。

Artifact保留5381513原始RED、5610382旧hint中间GREEN和5714557 checker误把高亮行号1当source的失败；5745393改用真实Copy seam并读取四图。最后只将ended／stopped hint从“不等于Generating”加强为“等于真实title”，同冻结产品复验6132187两组GREEN，报告已读，不追认新四图已读；无产品变化，不重复268项／types。无opener inline code源仅SSR，其他HTML／Mermaid／Markdown inline完成切换、公式／huge raw和Windows原生继续未验。

本轮三项源码和文档冻结，浏览器按divider→busy composer→Artifact串行完成并释放；quality owner最终受影响15文件268/268通过，完整types／lint退出0，独立review clean。此前323项SDK检查点未重跑、不能相加冒充完整npm／E2E。主agent只协调／评审／验收／检查点，下一步显式stage已验16文件保存检查点，排除未验`e2e/file-panel.mjs`与`e2e/chat-appearance.mjs` PREP；`stash@{0}` provider rename仍保留。

ownership用既有classifier实测：6fcd7d4的MarkdownBody206 total／204 structural、medium与汇总2238 cosmetic／12749 structural不变。ArtifactCard不在6fcd7d4，真实upstream remote为abcwyc/pi-agent-desktop，创建提交d9548cd在upstream/main祖先；固定`upstream/main@3b6a87771267bb884c41df65537156820f23b41d`有blob d898e43。按此实际上游测21 total／17 structural、low，新增post-baseline共享entry，不使用产品origin推定归属。post-baseline数值与旧基线汇总分开；阈值30／250与采用计数1／12／20保持。

## 可复现验证命令

以下命令均在产品根目录执行，属于紧邻说明的源码冻结版本；后续结果不得追认到不同源码。旧章节检查点323项实际由dot log计数确认，不是343；日志为本机临时任务 `bxfscyfb9.output`，持久结果范围以本节及184fade为准。

```bash
node --experimental-strip-types --test --test-reporter=dot lib/conversation-chapter-extension.test.mjs lib/conversation-chapters.test.mjs lib/session-reader.test.mjs lib/agent-event-wire.test.mjs lib/agent-event-stream.test.mjs lib/rpc-manager.test.mjs hooks/useAgentSession.test.mjs components/ConversationNavigator.test.mjs components/MessageView.test.mjs components/ChatWindow.render-cache.test.mjs lib/message-display.test.mjs components/fork-extractions.test.mjs scripts/fork-ownership.test.mjs scripts/upstream-css-baseline.test.mjs lib/i18n/registry.test.mjs
```

```bash
node_modules/.bin/tsc --noEmit --incremental false
```

```bash
npm run lint
```

以上184fade冻结源为323 pass，保留历史证据而未重跑。本轮最终冻结源的受影响15文件组合如下，实际268/268、0fail／skipped／cancelled、exit0：

```bash
node --experimental-strip-types --test --test-reporter=tap components/ConversationNavigator.test.mjs components/MessageView.test.mjs components/ChatWindow.render-cache.test.mjs components/MarkdownBody.test.mjs components/MarkdownBody.caret.test.mjs components/ChatInput.test.mjs components/ChatInput.dormancy.test.mjs components/ChatInput.mobile-thinking-menu.test.mjs components/ChatInput.compaction.test.mjs components/ChatInput.streaming-thinking.test.mjs components/ChatInput.automation.test.mjs lib/message-display.test.mjs components/fork-extractions.test.mjs scripts/fork-ownership.test.mjs scripts/upstream-css-baseline.test.mjs
```

最终完整types与lint使用上方各自单命令，均退出0；lint为0errors／1条既有`TerminalPanel.tsx:217 jsx-a11y/role-supports-aria-props`警告，内含branding3/3。`git diff --check`退出0，仅CRLF提示；独立最终production／manifest provenance review clean。

本机日志根 `C:/Users/xx/AppData/Local/Temp/claude/D--pilaude/239be14d-35c5-4a69-bfb7-d700e95e6fd8/tasks/` 下，268项为`b0uruyam6.output`、完整types为`b8s3785tu.output`、lint为`bppjc6z4v.output`。日志可清理，持久事实保留在本表及最终源码；本轮未重跑完整npm／terminal E2E。lint解析下一阶段FileViewer PREP夹具只证明语法，不表示其行为验收。

分隔线两次均默认 `http://127.0.0.1:30142`，`E2E_COMMAND_CAPTURE_ONLY`未设置；RED运行第一条，GREEN唯一新增env是已保留的baseline报告。Bash命令如下；Windows PowerShell用同名`$env:`设置再运行node。

```bash
node e2e/activity-command-layout.mjs
```

```bash
E2E_COMMAND_BASELINE_REPORT="D:/pilaude/pi-agent-desktop/test-results/pilaude/activity-command-layout/run-1792385017293/report.json" node e2e/activity-command-layout.mjs
```

实际RED5017293、GREEN5059051及六组结果见上表。busy专项实际Windows PowerShell命令如下，使用已有30142 preview；5297398只覆盖一组canonical busy状态，没有重跑原4522954完整导航矩阵。

```powershell
$env:E2E_NAV_BUSY_SHORT = '1'; node "D:/pilaude/pi-agent-desktop/e2e/conversation-navigator-layout.mjs"
```

同一冻结源的既有ChatInput键盘／IME／提交一次匹配测试5/5通过（任务log `bowubsg5o.output`）；checker ESLint通过。

```bash
node --test --test-name-pattern="follow-up shortcuts|follow-up shortcut|Enter|IME" components/ChatInput.test.mjs
```

```bash
node node_modules/eslint/bin/eslint.js e2e/conversation-navigator-layout.mjs
```

Artifact最终checker6132187两组及前轮5745393使用同一Bash命令，默认已有preview `http://127.0.0.1:30142`；6132187报告已读、5745393四图已读，browser已释放，不重复把新四图写为已读。

```bash
E2E_CARET_ARTIFACT_ONLY=1 node e2e/streaming-caret-boundaries.mjs
```

九renderer（含无opener inline code source）命令如下，9pass；目标文件lint通过。

```bash
node --experimental-strip-types --test components/MarkdownBody.caret.test.mjs
```

```bash
node_modules/.bin/eslint components/ArtifactCard.tsx components/MarkdownBody.tsx e2e/streaming-caret-boundaries.mjs
```

ownership旧基线实测命令如下，exit0；post-baseline ArtifactCard另对固定真实upstream/main SHA用同一脚本的COSMETIC分类器测量，21／17与旧汇总分开记录，不改基线／阈值。

```bash
node scripts/measure-fork-drift.mjs 6fcd7d4
```

## 仍未完成

- 导航／布局本轮源码与常规／settled实际页面已通过，184fade检查点已保存并推送；整体复刻仍继续。
- canonical 390×340＋活动run＋长草稿已在5297398实际通过；其他窗口／长草稿组合、小于280px可用宽度的目录clamp和Windows原生仍未覆盖，不能扩大单组结论。
- 章节只有当前加载历史范围的数据；不存在全会话章节索引服务，不能把未加载尾部称作真实 Session start。
- Mounted Artifact card限定路径已通过；无opener inline code只有SSR，其他HTML／Mermaid／Markdown inline完成切换、formula-only／超大raw fallback仍待验。
- 原生结构化 Plan/Todo。可选扩展的 ANSI widget 不是该能力。
- Windows 真机 GUI、WebView／DPI、原生 clipboard／Code.exe 启动以及完整 npm／terminal E2E。
- 完整逐状态视觉一致性；已接入／测试通过／某张图可读不等于完全复刻。

所有实际 browser 夹具使用生成文字并拦截 API／SSE／clipboard，不执行参考图命令或真实模型。私有参考与衍生叠图仅存在本地忽略路径。
