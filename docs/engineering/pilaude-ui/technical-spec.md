# 技术规格与边界

更新日期：2026-10-19。这里描述当前采用的工程合同；验收状态见 [progress.md](progress.md)，未验证能力不得由规格文字推定为通过。

## 章节领域

| 项目 | 合同 |
| --- | --- |
| 创建入口 | 模型直接调用 `mark_chapter({ title: string })`；model-only、sequential，不能由嵌套 codemode 代写 |
| 标题 | 去首尾空白、非空、最多 120 个 UTF-16 code units、单行且无控制字符；作为纯文本输出粗体，不解析 Markdown／HTML |
| 稳定身份 | `chapterId = toolCallId`，同 ID 重试幂等；同名不同 ID 保留独立章节 |
| 保存格式 | SessionManager `custom` entry，`customType: "pi-web:chapter"`，`data: { version: 1, chapterId, title }` |
| 成功条件 | `appendEntry` 后确认当前 branch 有记录，失败／调用前取消不创建假章节；新会话文件 flush 遵循 Pi 既有语义 |
| 历史投影 | 只在所选 branch 祖先链中读取合法记录，生成可见 custom message；章节计入 tail 和 wholeTurns 边界 |
| 实时投影 | 合法 `entry_appended` 转为现有 `message_end` custom 形状；无关自定义存储 entry 不送到浏览器 |
| 客户端 | 章节追加按 ID 去重，单独处理，不能走 assistant completion 的清流／waiting_model 分支 |
| 导航来源 | 仅合法显式章节；禁止从用户消息、普通粗体、Markdown heading、工具输出推断 |
| 正文锚点 | `<strong>` 纯文本标题在过程组之外，`data-conversation-chapter` 绑定稳定 ID，选择定位时安全处理 selector |
| 工具呈现 | 只有匹配合法记录且真实非错误终态的控制调用才能从普通工具卡／数量中隐藏；pending／partial／error 保可达 |
| Session start | 仅最早历史已加载、非空且非 loading 时可用；部分加载的 tail 不能冒充起点 |
| 作用范围 | 普通 coding 会话；Chat-only／subagent 的精确提示词与资源边界保留。模型在有意义的阶段开始前创建章节，不是每条消息自动创建 |

实际消费链：`conversation-chapter-extension → SessionManager.appendEntry → session-reader / agent-event-wire → useAgentSession → getConversationChapters → ChatWindow / MessageView → ConversationNavigator`。

`pi.sendMessage` 在 streaming 时排队且返回 void，不能作为工具已持久化的成功凭据，因此此切片使用 `appendEntry`。章节是 UI 元数据；不伪造 user 消息注入模型 context。

## 中间栏与目录布局

- 正文列与 composer 列继续使用已有内容最大宽度（默认 820px，服从用户阅读宽度设置）。两边 auto margin，以当前左右列之间实际 chat window 为中心，不按整屏中心或固定全局 x 坐标定位。
- 删除强制右对齐和宽屏单侧 89px 留白。左右列拖动、显示或隐藏时，由实际 flex 可用空间重新居中。
- 有导航轨时，正文与 composer 使用对称 64.8px 内边距，维持 `12px + 28.8px hit target + 24px body gap`；没有轨时保留原普通窄窗边距。
- 展开目录固定为 256 CSS px，不随标题伸展；长标题内部 ellipsis，完整纯标题保留在 title／可访问名称。256px 是本轮收窄值，不声称参考图未知 DPI 下的原 CSS。
- 目录空间保护以实际中间栏为界，不只按整个 viewport；导航轨 left 12px／top 24px，正文保持最小间隙。
- 目录打开不劫持正文滚动；方向键／Home／End、原生 Enter／Space、IME／229、Escape 和焦点恢复保留。透明容器不能挡正文点击或影响移开后的菜单关闭。

## 消息、活动与内容

- 思考／正文活动以 indexed start／delta／end 为准；工具以独立 toolCallId 集合跟踪。partial 不是 success。
- 过程／步骤／思考折叠使用现有受控 Grid consumer；领域控制器拥有真实数据、错误和手动选择。章节只分隔显示阶段，`isMessageRunAnchor` 保留真实请求／run 边界；追加章节不能把同批尚未执行的工具误判为已取消。
- 真实新工具事件的一次性 grant 驱动有限 180ms／6px 入场，同批 40ms 错开、120ms 上限；状态 160ms、摘要 150ms。历史、重连和重挂不补播。
- 专用 `isSending` 仅覆盖本地准备至 POST admission ACK；更具体活动优先。取消前置提交恢复一次；已发出且已接受或不明确的请求不自动重放。
- Markdown caret 由已有 sanitizer 后 HAST 注解选择终端文字容器，绝不改变原文／复制。列表／表格／fence 等已有实际证据；Artifact source forwarding 有 renderer 测试，实际 card、math-only、超大 fallback 仍待完成。
- Compact shell 只用于已结束的 exact bash／powershell、唯一 command 字段、无 rich result 的情况；extra fields／running／partial 保完整 inspector。语法沿用 PrismLight，4096 字符以上完整 plain fallback。
- 长用户消息由 `useMeasuredOverflow` 观察自然 Markdown 和裁切 wrapper，字体与隐藏恢复也触发测量。保留 220px＋60px slack、48px fade、手动 expanded、外层 300px 滚动上限与精确复制；coarse disclosure 最小 44px。

## 集成与验收

- 所有 fork CSS 在 `app/native-theme.css`；`globals.css` 和 `settings.css` 保 upstream 字节基线。归属与风险见 `scripts/fork-ownership.json`；基线 `6fcd7d4`，中／高阈值 30／250 不变。
- 33 个 open-claude-ui 源模块当前已记录 1 直接采用／12 局部适配／20 未确认。Prism 和 react-diff-view 为另外署名的成熟库，不增加该计数。
- 实际浏览器测试使用生成数据，拦截 API／SSE／clipboard，禁止真实模型调用、真实第三方操作及截图命令执行。
- 私有原像素证据只在本地忽略路径。原图底层 100%／实现上层 50%，整数平移裁剪，无 resampling；未知 DPI、capture scale 与文字不同分别记录。
- Preview 走已有工具，开发不运行 `next build`。Windows WebView／DPI／原生剪贴板／编辑器启动与完整 npm／terminal E2E 独立验收，不能从浏览器单项通过推定。
