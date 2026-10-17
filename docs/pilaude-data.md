# Pilaude 本地数据与迁移

默认数据根为平台应用数据目录下的 `Pilaude/agent`。Windows 使用 `%APPDATA%/Pilaude/agent`，macOS 使用 `~/Library/Application Support/Pilaude/agent`。启动在加载 Pi SDK 服务之前设置独立数据根，不改变 HOME。开发和测试显式指定的 `PI_CODING_AGENT_DIR` 优先。

Windows 提供商 API Key 和 OAuth 凭据存储在 `credentials.json`，磁盘格式为 `{ "format": "pilaude-dpapi-v1", "ciphertext": "…" }`。DPAPI CurrentUser 加密只在后端进行，系统调用隐藏窗口，秘密经 stdin/stdout 传递；命令行和状态响应不包含秘密。文件不能直接复制到另一台电脑或 Windows 账号使用，需要重新登录。其他平台目前支持环境凭据，原生凭据适配尚未完成。

写入持有跨进程锁并通过临时文件原子替换；取消、解密失败和损坏数据不覆盖原文件。自定义提供商的普通 API Key 移到该存储，`models.json` 只保留配置。模型“测试”和“发现”操作的临时配置删除 API Key 和鉴权头，在内存中恢复 Pi 的真实请求参数，结束后删除临时目录。

在“设置 → 常规 → 本地数据”主动预览旧 `~/.pi/agent`。界面显示来源、目标、冲突和跳过项；点击“备份并导入”才复制。预览摘要绑定来源内容及冲突状态，发生变化后需重新预览。

导入规则：

- 原目录只读；已有目标文件保留，不合并、不覆盖。
- 会话只复制 `sessions/**/*.jsonl`，保留字节和未知字段。历史会话可能含用户曾输入的敏感内容，仍只保存在本机。
- `settings.json` 保留普通及未知字段，跳过扩展包、技能、提示词、主题路径、shell 配置、外置 sessionDir、默认信任和工具权限。
- `models.json` 保留模型配置及未知字段，跳过 API Key、headers、OAuth/令牌/客户端秘密，以及带用户信息或查询参数的 base URL。导入后重新连接提供商。
- 不复制 auth、MCP、插件、浏览器登录状态或目录/文件链接；不安装包、不执行旧配置中的命令。

所有候选文件先生成经过上述处理的恢复副本，保存到目标目录的 `import-backups/<id>/`，随后以禁止覆盖的方式发布。`manifest.json` 记录来源、摘要、跳过项、实际已复制项及 `prepared/completed/interrupted` 状态。中断后保留完整恢复副本和已经复制的文件；重新预览将已有文件作为冲突保留。导入的设置在重启应用后加载，运行中的任务不被重放。

当前尚未达到正式发布门槛：持久自定义请求 headers、MCP 凭据等仍需统一加密与脱敏验证；OAuth 真实取消/恢复、完整恢复交互和正式安装环境验证也未完成。此文档记录已实现的数据格式，不代表 Task 3 或公开发行已验收。
