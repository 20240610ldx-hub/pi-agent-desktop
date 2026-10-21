---
id: PIL-0014
title: 把组件复刻基准拆成逐组件任务卡
epic: E2
priority: P1
status: verify
owner: codex-plus:gpt-xhigh:impl
lease_until: 2026-10-21T08:24Z
branch: task/PIL-0014-parity-index
implementers: [claude:sonnet-high:impl, codex-plus:gpt-xhigh:impl]
depends_on: []
files_allowed: [docs/relay/parity-index.md]
files_shared: []
acceptance_sha: 3b883a2b6317
waivers: []
---

## 目标

让界面复刻从一份 108KB 的长文变成可领取、可验收的组件任务。对应 GOALS E2。

## 背景与现状

`docs/pilaude-ui-parity.md`（复刻基准）、`docs/pilaude-component-adoption.md`（open-claude-ui 采用账本）、`docs/pilaude-agent-output-ui.md` 记录了逐组件的参考、残差与证据；私有参考图在工作区 `references/`（不得复制进仓库）。

## 验收标准

- [ ] A1 产出 `docs/relay/parity-index.md`：每个组件一行，列出参考图是否齐全（版本、DPI 是否已知）、当前实现状态、已有证据的位置、已知残差。不复制参考图内容。
- [ ] A2 每个尚未通过复刻验收的组件都有一张 E2 任务卡（可不冻结），卡片验收要求同帧量测（宽高、比例、间距、基线、对齐）与交互核验（适用的输入法、焦点、滚动、缩放、深浅色）。
- [ ] A3 列出缺少参考图的组件清单，交给用户决定是否补采。
- [ ] A4 不修改任何产品代码。

## 范围外

实现任何组件改动。

## 实现提示

先读仓库根 AGENTS.md 中相关 Hard rules 与 Topic Notes。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |
| A1 | 逐行结构脚本核对 62 行；对 20 组 manifest 核对条数与版本/DPI 字段；R11/R12 共 18 张原图宽高与 manifest 逐一相同；抽查 ≥10 行与三份档案和源码一致；22 条 H 路径存在；索引与 62 卡隐私扫描零命中（文档/manifest/源码层，未做像素验证） | 通过 | D:/pilaude/relay-evidence/PIL-0014/verify/verify-log.md | bb32b34 | claude:sonnet-high:verify |

## 日志

- 2026-10-19T09:50Z · claude:opus-medium:coord · 迁移：由接力治理初始化从旧 handoff / plan / 扩展矩阵转写。
- 2026-10-19T09:50Z · claude:opus-medium:coord · 验收标准取自用户确认过的验收出口，迁移时冻结；请用户抽查。
- 2026-10-19T14:09Z · claude:sonnet-high:impl · 领取，租约至 2026-10-19T17:09Z
- 2026-10-19T14:10Z · claude:sonnet-high:impl · 复述：目标是把历史复刻基准整理为逐组件可领取索引；A1 逐行列组件、参考覆盖和版本/DPI已知性、实现状态、历史证据位置及残差，并将历史记录与当前验收分开；A2 在仓库外evidence生成每个未验组件的E2建卡建议，协调者串行建卡及规划者补标准后回填实际ID，未建卡不宣称完成；A3 单列缺参考组件和需用户补采决定；A4 用提交文件清单证明只改docs/relay/parity-index.md。自测仅文档结构及范围检查，不运行产品测试、preview或构建，不写自己的通过证据。
- 2026-10-19T14:18Z · claude:sonnet-high:impl · 做了：仅新增docs\relay\parity-index.md，54项组件逐行列参考覆盖\版本与DPI未知性\历史实现\证据定位\残差，附33源模块映射及缺参考补采清单；仓库外D;C:\Program Files\Git\pilaude\relay-evidence\PIL-0014\component-card-proposals.json有54份E2-C01..54逐卡建议，含同帧宽高\比例\间距\基线\对齐和输入法\焦点\滚动\缩放\深浅色标准。 \ 状态：task\PIL-0014-parity-index最后提交f178fa6530da47b008c5721429f6fa9003b8cce1，工作树干净；A1\A3\A4文档自测完成，A2未完成，实际逐组件卡片未创建且actual_task_id均null，不进入verify；初始索引缺失RED和13项结构\范围自测保存initial-red.json、document-selfcheck.json；guard-result.json记录完整guard退出0、1文件、无finding。 \ 下一步：按用户本轮收尾暂停，协调者保存本条日志并交还租约；后续获得继续指示后由协调者串行建卡、规划者补标准\冻结并回填真实ID，A2齐备再独立验证，不把本轮实现者自测写成通过证据。 \ 风险：历史报告\截图未重新读取或核存在及提交对应，旧证据不绑定本提交；所有组件Windows完整一致性未通过，多批参考版本与所有OS DPI等元数据未知\不齐，缺参考及公开素材方案需用户决定；未读取复制私人图文\字体，未改产品代码，未跑产品测试\preview\构建，未修改其他任务卡。
- 2026-10-19T14:19Z · codex:gpt:coord · in_progress → todo：用户要求本批收尾暂停；54组件索引已保存task分支f178fa6，54项建卡建议尚无实际卡号，A2未完成，未独立验收或合入
- 2026-10-19T14:19Z · codex:gpt:coord · 路径校正：实现者上一条交接的Git Bash路径展开有误。组件索引实际在D:/pilaude/wt/PIL-0014/docs/relay/parity-index.md，建卡建议为D:/pilaude/relay-evidence/PIL-0014/component-card-proposals.json，结构自测与guard分别为document-selfcheck.json、guard-result.json。实际分支task/PIL-0014-parity-index、提交f178fa6530da47b008c5721429f6fa9003b8cce1，已只读确认；本条不新增验收或改变A2未完成状态。
- 2026-10-21T04:44Z · codex-plus:gpt-xhigh:impl · 领取，租约至 2026-10-21T07:44Z
- 2026-10-21T05:26Z · codex-plus:gpt-xhigh:impl · 复述：从f178fa6的54项索引继续；A1核对三份档案与只读manifest并补2026-10-20浅色组件及版本/DPI、状态、证据、残差；A2逐个未通过组件串行relay new --no-commit并填完整量测、交互验收和具体文件范围，保持未冻结；A3索引末尾列缺图补采项；A4只提交索引文档。只在当前worktree提交，不push，不写自身通过证据；全板check当前另报PIL-0113验收哈希异常，留协调者处理。
- 2026-10-21T05:35Z · codex-plus:gpt-xhigh:impl · 做了：已串行创建并填写62张E2组件草案卡 / 状态：全部todo且acceptance_sha为空，主任务板未提交；索引待回填实际ID / 下一步：核对组件与卡片一一对应、具体范围及交互量测标准 / 风险：Git任务元数据目录拒写，提交仍待宿主修复；参考版本/DPI未知项保留，不记录自身通过证据。
- 2026-10-21T05:37Z · codex-plus:gpt-xhigh:impl · 做了：从f178fa6继续补成62项索引，核对20组manifest并登记两组新增浅色18图的机制与原图尺寸；已创建PIL-0115至PIL-0176共62张E2草案并回填卡号，每卡有具体文件范围、同帧量测和适用交互验收；缺参考清单在索引末尾，未改产品代码 / 状态：分支tip仍为f178fa6530da47b008c5721429f6fa9003b8cce1，索引未提交；文档自测、guard和全板check已实际执行且未发现问题，不是独立验收；新卡全部todo且未冻结，主任务板未由本实现者提交；Git add、commit及最后add三次因任务Git元数据index.lock拒写未能提交 / 下一步：由宿主修复D:/pilaude/pi-agent-desktop/.git/worktrees/PIL-0014写权限后接手，在本worktree提交索引并附Codex co-author，再guard、写日志并set verify；协调者统一提交主任务板卡片 / 风险：本环境已列写根但操作系统ACL拒写，未更改ACL或绕过沙箱；补丁已保存D:/pilaude/relay-evidence/PIL-0014/parity-index-from-f178fa6.patch，卡号映射created-component-cards.json，文档自测document-selfcheck-20261021.json及guard-selfcheck-20261021.json均仅供验证者参考；所有组件参考全状态／版本／DPI仍不齐，不写自身通过证据，不push、不构建。
- 2026-10-21T05:37Z · codex-plus:gpt-xhigh:impl · in_progress → blocked：Git任务元数据目录ACL拒写，git add/commit及最后add共三次无法创建index.lock；索引和62张草案卡已备，需宿主修复权限后在任务worktree提交才能送verify。
- 2026-10-21T06:42Z · codex-plus:gpt-xhigh:impl · blocked → in_progress：协调者代为提交 bb32b34（Codex 沙箱无法写 index.lock）与 62 张卡
- 2026-10-21T06:42Z · codex-plus:gpt-xhigh:impl · in_progress → verify
- 2026-10-21T06:46Z · claude:sonnet-high:verify · 证据 A1：通过
