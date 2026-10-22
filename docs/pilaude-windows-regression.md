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

## Windows 原生验收基线

2026-10-22，PIL-0111。真实 Windows 顶层窗口、WebView2、DPI、进程这几类事实不能由浏览器 e2e 或模拟 IPC 证明，因此由一套共用底座采集：`e2e/native-harness.mjs`（启动、接入、探针、清理、证据）、`e2e/native-baseline.mjs`（命令行）、`e2e/native-window-probe.ps1`（Win32 枚举、截图、移动、`WM_CLOSE`）。后续原生检查卡复用它，不再各写一套。`e2e/native-conversation-destinations.mjs` 是“真实 AppShell + 模拟 IPC”，不启动原生 WebView，不属于本基线。

### 检查项

`node e2e/native-baseline.mjs --list` 输出的检查 ID 与下表一致（有测试逐行核对）。

| ID | 检查项 | 采集方式 | DPI 组合 | 需要用户操作 | 归属 |
| --- | --- | --- | --- | --- | --- |
| N1 | WebView2／Tauri 启动与 CDP 接入 | `--check launch`：启动已构建的 dev 壳，一次性 `WEBVIEW2_USER_DATA_FOLDER`、随机回环 CDP 端口，Playwright `connectOverCDP`，读 `window.__TAURI_INTERNALS__` 与窗口 label `main`，`realApiRequests` 必须为 0 | 当前档 | 否 | PIL-0111（自动） |
| N2 | 顶层窗口、装饰与 DPI 截图 | `--check window`：探针枚举可见顶层窗口，记录句柄、矩形、`GetDpiForWindow`、标题栏／系统菜单／可缩放边框／最大化最小化按钮，`PrintWindow` 截图并核对像素尺寸与方差 | 100 / 125 / 150 / 175%，各档分别运行 | 切换档位需要（设置 → 系统 → 屏幕 → 缩放） | PIL-0111（自动，换档需用户） |
| N3 | 进程树与退出卫生 | `--check hygiene`：运行前后进程表，只终止自己启动的进程树，5 秒内无残余，`desktop.log` 只读本次新增部分，含 `startup` 不含 `panic` | 不涉及 | 否 | PIL-0111（自动） |
| N4 | Changes 独立窗口 | 复用底座：开窗 IPC、OS 窗口 1→2→1、移动、关闭 | 150%，必要时其他档 | 否 | PIL-0200（自动） |
| N5 | 剪贴板读回 | 复用底座驱动并读回 | 不涉及 | 否 | PIL-0201（自动） |
| N6 | 外部编辑器 | 复用底座启动并核对进程 | 不涉及 | 否 | PIL-0201（自动） |
| N7 | 托盘菜单驱动 | Win32 消息驱动托盘，核对退出；托盘 Quit 后 keep-awake 的 `powercfg /requests` 需管理员终端 | 不涉及 | `powercfg /requests` 需要用户在管理员终端运行 | PIL-0201（自动 + 用户一步） |
| N8 | 原生文件对话框 | 系统对话框，不由底座自动化 | 不涉及 | 是 | PIL-0167 |
| N9 | 系统通知 toast | 系统通知，不由底座自动化 | 不涉及 | 是 | PIL-0166 |

### 运行前提

- 交互式桌面会话，未锁屏，不最小化 RDP；不需要管理员权限。
- 已构建 dev 壳：`cargo build --manifest-path src-tauri/Cargo.toml --no-default-features`（底座不编译，缺失时退出码 2 并给出这条命令）。壳读取运行期环境变量 `PILAUDE_DEV_URL`（仅非 `custom-protocol` 构建，且必须是裸 `http://127.0.0.1:<port>` 回环 origin，带凭据、路径、查询的值被拒绝），因此无需为换端口重编。
- 已有 dev server：`node node_modules/next/dist/bin/next dev --webpack -p <port>`，其 origin 作为 `--base`；底座在它前面放一个回环反向代理，非 `/api` 透传（含 HMR），`/api` 与 SSE 由夹具应答，所以真实 API 不会被访问，与 CDP 接入时序无关。不运行 `next build`。
- 每个 worktree 自己启动 dev server；共享预览用 `node scripts/relay.mjs lock preview` 串行。

### 命令

```
node e2e/native-baseline.mjs --check launch|window|hygiene --base http://127.0.0.1:<port> --out <证据目录> [--label dpi100|dpi125|dpi150|dpi175]
```

退出码：0 通过，1 检查失败，2 前提缺失（exe 或 dev server），3 `--label` 与实测缩放不符，64 参数错误。`--label` 只在实测缩放一致时接受，防止把 150% 的结果贴成别的档位。报告 `results.json` 记录 WebView2 运行时版本、Windows build、exe 构建时间与 SHA-256、窗口 DPI、显示器缩放、`devicePixelRatio`、页面缩放、运行前后进程表，不含环境变量值。

### 证据与“未运行”

证据放在仓库外 `D:/pilaude/relay-evidence/PIL-xxxx/`，不进 git。每个检查项、每个 DPI 档位各有结果：通过、失败或**未运行**。**未运行不等于通过**；没有实测过的档位必须写“未运行”，不得补写。
