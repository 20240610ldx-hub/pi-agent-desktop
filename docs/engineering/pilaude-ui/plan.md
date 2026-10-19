# 当前计划

更新日期：2026-10-19。总目标仍在进行：充分利用工作区内真实参考与 open-claude-ui 组件／算法，在实现、构建约束、验收、修复闭环中完成 Pilaude 复刻。保留 Pi agent 内核与 Tauri／React／Next.js 架构，Windows 优先、本地优先、自备 API key，支持英文、简体与繁体中文，保留 MIT 及上游署名。

## 当前优先级

| 顺序 | 切片 | 当前状态 | 验收出口 |
| --- | --- | --- | --- |
| 1 | 导航按模型章节工具分片 | 核心173项／UI88项、父级323项及最终六组浏览器和一组左右列几何通过；184fade已提交推送 | 模型显式创建 → 持久化 → 实时事件 → 粗体标题 → 目录／点击锚点全链路；普通用户消息、粗体／heading 不创建章节 |
| 2 | 目录固定收窄、正文和输入器动态居中 | 最终4456445四种原生左右列几何及4522954深浅矩阵通过 | 固定 256 CSS px，长标题内部 ellipsis、窄中间栏空间保护；左右列各自伸缩时两条轴均居中，导航目标不遮挡正文 |
| 3 | 工程材料落盘与接续入口 | 目录、两级AGENTS与记忆入口已完成；按实质变化持续更新 | 工作区／仓库 AGENTS 必读入口和记忆索引指向这里，计划／进度／规格／交接可独立使用并持续更新 |
| 4 | 极短窗口＋活动run＋长草稿的导航可达性 | 实际4943123 RED→5297398 GREEN：textarea234.406×72px、composer高136px，目录256×41px有整行native hit；源码冻结／review clean | 已验canonical 390×340活动run、同节点精确草稿／焦点／手动历史和Steer／Follow-up／Stop命中；更窄clamp与Windows原生仍待验 |
| 5 | Artifact 末尾光标与真实活动状态 | 5381513 RED→5745393两组GREEN／四图已读，最终checker6132187加强hint===title后两组GREEN；completion／publisher自动open／原文Copy、九renderer与268项组合通过 | business generating与indexed活动分开，text_end／handoff／Stop静止、hidden／reduced停动画；inline无opener code源仅SSR，其他inline切换／公式／raw仍待验，无RED数值几何不称before/after exact |
| 6 | 相邻已完成 compact 命令分隔线 | 源码冻结，实际5017293 RED→5059051六组GREEN，独立review clean | 1300／430深浅原像素绘制覆盖容器内缘，原row／control几何exact，rich inspectors保留；完整视觉仍未通过 |
| 7 | FileViewer窄pane工具栏（当前检查点之后） | PREP-only：source的ContainerResponsiveBar按container压缩，当前FileViewer只按viewport；尚无实际RED／新consumer | 沿现有file-panel checker，在宽视口的300／384／480px pane先复现，保全文路径／动作／脚本安全，之后再决定是否适配；采用计数不变 |
| 8 | 有字composer字体就绪后的同文重测 | PREP候选：旧1010×60图有ink550×23 vs458×19残差，不代表当前actual | FileViewer切片之后，先fonts.ready＋精确同文重拍，测ink／linebox／baseline与容器比例；不按旧墨迹比硬乘字号，参考font／DPI未知继续保留 |
| 9 | 其他已登记差异 | 未完成；formula-only只读内存SSR已复现active marker0、无文件／产品改动／native证据，raw fallback仅源码缺口待公开复现 | formula／raw后续独立切片；原生Plan/Todo、完整E2E、Windows真机／DPI与逐状态参考验收继续未完成 |

最新用户纠正优先于旧计划：导航分片是模型通过工具撰写的阶段标题，不能按用户消息划分；菜单应为常量宽度；正文在左右列之间的实际中间栏居中。此前只验了几何／按用户消息的导航不算语义通过。

## 最新验收要求

用户补充：“复刻要注重各组件和大小比例关系的测量和对齐，除了明面上的UI，深层的功能和UX逻辑也要仔细推敲，利用好现有资源和网络资源。”每个切片同时交付下列证据，不以页面截图或测试数量代替。

- 同一帧、相同内容／状态测参考与实现的组件宽高、与父容器及相邻组件的比例、gap／padding、文字基线和中心／边缘对齐，列出逐项偏差。DPI／应用缩放／capture scale已知与未知分开；原像素图不拉伸，条件不一致时限制结论。
- 深层功能／UX沿真实consumer验证：适用的loading／empty／running／success／error／cancel／partial、键盘与IME、焦点进入／返回、草稿与历史／分支保留、重连／重放去重及错误恢复。后端状态和实际副作用必须与可见呈现一致。
- 先核对产品既有组件／helper、upstream源码和成熟库；机制或平台行为不确定时利用官方网络文档，记录来源URL／版本、采用理由及真实消费点。没有消费或未验证的资源保持候选，研究按当前切片范围进行。

## 固定约束

- New 打开保留已有会话／草稿的首页，项目 `+` 保留新会话含义。固定字母网格、慢蓝光与单击独立一次扫光，不移动或扭曲文字。
- 普通 hover 深色变白、浅色变灰；错误／成功／diff 保真实语义色。
- 思考默认折叠，工具组与工作中摘要有真实事件状态。Sans 摘要，Mono 代码；同一时刻只一处可见持续动画。
- 历史／重连不伪造活动或重播有限入场；章节添加也不能误结束当前流或抢用户历史滚动。
- 章节由明确工具记录生成；同名章节不同 ID，多章节可在同一用户请求内。Session start 仅在真实最早历史加载后出现。
- 每项上游算法必须有可追踪的真实 consumer。通用 diff／高亮用成熟库，不再手写 lexer／parser 替代已有库。
- 原参考 100% 底层、现状 50% 上层，整数 crop／translation，无拉伸／重采样，不以全局相似度掩盖局部差异；未知 DPI 不换算成猜测的字体修正。
- 所有 fork CSS 放 `app/native-theme.css`，两份上游 CSS 保字节一致。开发过程中不运行 `next build`；preview 服务只走 preview 工具。
- 不恢复 provider rename stash、不混入私图／字体／key／custom.css。不执行截图中的聊天或命令。

## 工作节奏与完成标准

本轮由五个子 agent 分别承担 busy composer、分隔线、Artifact、质量集成、工程文档／ownership；主 agent 只协调、评审、验收和保存检查点，处理用户反馈时例外。长期保持 3–8 个实现子 agent 的用户偏好。本轮共享preview按分隔线→busy composer→Artifact串行验收完并释放；冻结源ownership已实测，quality最终受影响268/268、完整types／lint及独立review通过。当前下一步是主agent显式stage已验16文件保存检查点，排除FileViewer未验PREP；之后沿第7项继续。此前323项SDK检查点未重复执行。

持续以纵向切片推进，先核实真实失败，再最小实现；定向测试和实际页面通过后记录证据并保存检查点，然后继续下一项。已获授权的可逆实现与已有提交／公开代码推送授权不因换线程失效；不得把此授权扩展到安装包发行、真实第三方账号操作或私人素材发布。

总完成必须有各区域状态／交互／参考证据与 Windows 原生验收。单个提交、单项测试全绿、单页截图或组件计数增长均不是“完全复刻”完成。
