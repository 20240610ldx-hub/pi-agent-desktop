# Windows 定向回归隔离与进程清理

2026-10-18。将独立诊断工作树的测试修复按差异迁入 Pilaude 融合分支，保留加密凭据和既有队列回归。没有合并该工作树的上游基线，也没有改产品权限策略。

## 修复范围

- `app/api/cwd/status/route.test.mjs`：在导入前隔离 agent/home，避免真实会话 cwd 成为测试的 allowed root；Windows 使用 junction 验证链接逃逸。
- `app/api/mcp/{test,sign-in}/route.test.mjs` 和 `lib/__fixtures__/mcp-marker-command.mjs`：用 Node marker 替代 Unix `touch`，路径带空格；验证未授权 `!command` 不执行。需要改变 home 的用例同时设置并恢复 `HOME` 与 `USERPROFILE`。
- `lib/codemode-settings.test.mjs`：POSIX `0600` 检查继续在非 Windows 平台执行。Windows 的 `stat.mode` 不提供同等 ACL 证据。
- `lib/{builtin-extensions,mcp-host,mcp-read-only-policy}.integration.test.mjs`：删除临时 cwd 前等待 `wrapper.shutdown()`，让 stdio 子进程和管道退出。
- MCP host 的 Stop/idle 用例额外等待该 fixture 的实际 PID 退出，最多 5 秒，超时明确失败。idle unregister 会先移除 connection 再异步关闭，单独等 session shutdown 不能覆盖已经从连接表移除的子进程。

`hooks/useAgentSession.test.mjs` 在产品前一批已具备等价属性顺序修复，因此没有覆盖或复制该文件；新增队列测试保留。sign-in/host 测试仍使用 Pilaude 的加密凭据路径。

## 当前产品分支验证

| 定向范围 | 结果 |
| --- | ---: |
| cwd、Code mode、完整 useAgentSession、file-access | 70 pass |
| MCP Test/sign-in 路由 | 19 pass |
| builtin、host、readonly MCP 集成 | 19 pass |
| 相关安全回归 | 83 pass / 1 既有 Windows skip |
| 合计 | **191 pass / 0 fail / 1 skip** |

各组均自然退出，无 watchdog 超时；只运行本地 faux provider、fixture stdio/HTTP，没有真实模型调用。依赖检查、TypeScript、标准 lint、branding 3 项和 whitespace 检查通过；lint 保留现有 TerminalPanel 的一条 `aria-description` 警告。

补跑先复现了 Stop 清理 `EBUSY`，最终由上述 PID 退出屏障解决。另一次 fresh-trust 断言失败来自诊断 runner 将假 HOME 与系统 TMP 混用，使真实用户的 `.agents/skills` 成为祖先项目资源；诊断 scratch 改到受控目录后通过，正常 HOME 下该测试也通过。未放宽信任断言或禁用产品资源发现来使测试变绿。

来源工作树的 188 pass / 1 skip 与本产品分支的 191 pass / 1 skip 是不同验证记录，不能相加。原始失败和成功日志仅在被忽略的本机 `test-results/pilaude/` 保存。没有重新运行完整 `npm test`，以上结果不代表全量套件通过。
