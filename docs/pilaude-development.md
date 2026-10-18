# Pilaude 开发说明

Pilaude 的公开产品仓库为 [20240610ldx-hub/pilaude](https://github.com/20240610ldx-hub/pilaude)，产品版本为 `0.1.0`。当前处于开发阶段；本次仓库身份迁移不发布安装包，不配置 updater 公钥，也不代表全量测试、界面一致性、正式安装或发行已验收。

## 仓库与 remote 分工

两个 fork 保留各自来源的完整历史，负责跟进作者更新。独立的产品 remote 保存融合开发成果，三者不能混作同一个发行来源。

| 用途 | origin | upstream | 开发边界 |
| --- | --- | --- | --- |
| Pi 桌面 fork | [20240610ldx-hub/pi-agent-desktop](https://github.com/20240610ldx-hub/pi-agent-desktop) | [abcwyc/pi-agent-desktop](https://github.com/abcwyc/pi-agent-desktop) | fork main 跟进桌面作者；产品改造在融合分支验证后采纳 |
| 界面参考 fork | [20240610ldx-hub/open-claude-ui](https://github.com/20240610ldx-hub/open-claude-ui) | [Caho1/open-claude-ui](https://github.com/Caho1/open-claude-ui) | fork main 跟进界面来源；实际采用的代码与资产单独审查 |
| Pilaude 产品 | product remote → [20240610ldx-hub/pilaude](https://github.com/20240610ldx-hub/pilaude) | 经验证采纳上述来源 | 保存并持续推送已验证的 Pilaude 产品提交；产品更新只使用此仓库 |

在现有 Pi fork 克隆中保留 `origin` / `upstream`，通过独立的 `product` remote 推送产品代码。直接克隆 Pilaude 的开发者，其本地 `origin` 自然指向 Pilaude；应按用途识别远程仓库，不能仅凭 remote 名称判断是否是上游同步目标。自动同步 fork main 不等于融合分支或产品分支已经采用更新；采用后仍需处理语义差异并验证。

产品身份由 `lib/branding.ts` 和 `src-tauri/pilaude-package.json` 表达，组件清单中的 `distribution` 与 Tauri updater 端点同步指向 `20240610ldx-hub/pilaude`。`abcwyc/pi-agent-desktop`、`earendil-works/pi`、`agegr/pi-web` 仍是组件来源；上游 npm 包名、版本和版权声明继续保留。updater 的 `pubkey` 为空，在具备签名和正式发行验收之前不启用已签名整包安装。

## 运行与验证

从 Pilaude 仓库根目录执行：

```bash
npm ci
npm run dev
```

浏览器开发入口为 `http://127.0.0.1:30141`。如需原生桌面窗口，停止 Web 开发服务后运行 `npm run desktop:dev`；需要 Rust 及相应平台依赖，Windows 使用 Microsoft C++ Build Tools 和 WebView2。这些命令不生成安装包。开发期间避免直接运行 `next build` / `npm run build`，以免扰动 `.next/`。

每批改动先运行相关测试和 lint，检查差异后再 commit/push 到产品 remote。身份迁移的相关检查可用以下命令，不调用模型或真实发布接口：

```bash
node --test lib/branding.test.mjs lib/app-updates.test.mjs scripts/release-components.test.mjs scripts/bump-pi-agent-desktop-version.test.mjs scripts/release-workflows.test.mjs
npm run lint
git diff --check
```

这些检查通过只证明对应覆盖范围。全量测试、原生安装与 UI 验收状态必须按实际结果分别记录；未运行或失败的项目不能标为通过。commit/push 保存源码进度，不自动表示发布安装包或启用发布工作流。

## 来源记录与私人证据

两份 README 将原 Pi Agent 内容折叠保留为来源记录；其中的下载链接、签名安装说明、发行承诺和上游文档描述的是来源项目，不能作为 Pilaude 已完成或已发布的证明。Pilaude 的本地数据与导入行为见 [本地数据与迁移](./pilaude-data.md)。

私人参考图、用户内容、原始截图、字体取证和完整测试日志放在公开仓库之外的本地 `references/`、`test-results/` 目录。不得加入 Git、公开仓库、发布附件、安装包或打包资源。公开文档只保留必要的来源、许可、可复现步骤和不含私人数据的验证结论；发布前审查暂存区与打包清单。
