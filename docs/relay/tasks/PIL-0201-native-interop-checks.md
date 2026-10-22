---
id: PIL-0201
title: Windows 原生互操作检查：剪贴板、外部编辑器、托盘菜单驱动
epic: E11
priority: P2
status: todo
owner:
lease_until:
branch:
implementers: []
depends_on: [PIL-0111]
files_allowed: [e2e/native-interop.mjs, e2e/native-interop.test.mjs, e2e/native-tray-driver.ps1]
files_shared: []
acceptance_sha: ec02513470fd
waivers: []
---

## 目标

在 Windows 开发构建上自动检查三类与系统交互的行为：复制到系统剪贴板并读回、用外部编辑器（VS Code）打开项目、通过托盘菜单显示／隐藏／退出主窗口。结果可重复、失败路径可复现。对应 [GOALS E11 与 E2](../GOALS.md)，补全 PIL-0111 清单里的 N5、N6、N7。

## 背景与现状

审计日期 2026-10-22。

- 剪贴板：`lib/clipboard.ts copyText()` 在桌面端走 `@tauri-apps/plugin-clipboard-manager` 的 `writeText`，浏览器端走 `navigator.clipboard`。目前只有模拟 IPC 的单元检查，没有“写入后由系统读回”的原生验证。
- 外部编辑器：Rust `src-tauri/src/project_editor.rs` 在 Windows 按 `LOCALAPPDATA`、`ProgramFiles`、`ProgramFiles(x86)` 与 PATH 中的 `Code.exe` 找候选，只启动 exe，不经 `cmd.exe`；TS 侧 `openProjectInVSCode(cwd)` 与 `getConversationDestinations()` 的 `vsCode.supported/reason`（`not-installed`、`desktop-only`、`unavailable`）有模拟 IPC 合同（`e2e/native-conversation-destinations.mjs`）。本机审计时 `%LOCALAPPDATA%\Programs\Microsoft VS Code\Code.exe` 与 `Program Files` 路径下**都没有** VS Code，所以“未安装”分支可自动验证，“已安装并成功启动”分支需要用户先装 VS Code。
- 托盘与退出：PIL-0197（已完成）在 `D:/pilaude/relay-evidence/PIL-0197/impl/repro-tray-quit.ps1` 里用 Win32 消息驱动托盘（找 message-only 的 `tray_icon_app` 窗口、投递托盘消息弹菜单、按菜单项 ID 投递 `WM_COMMAND`、`-WhileMenuOpen` 模拟菜单仍处于模态循环时选 Quit、`-Hide` 先向主窗发 `WM_CLOSE` 模拟关窗进托盘、`-Mouse` 用真实鼠标点菜单），并以日志偏移判定是否写入 `exit`、以进程列表判定是否退出。Quit 时 keep-awake 释放的 `powercfg /requests` 前后对照已由用户在管理员终端完成并记入 PIL-0197，本卡不重复。
- 底座：启动、接入、进程卫生、证据写入由 PIL-0111 提供；本卡不自带启动代码。

## 验收标准

- [ ] A1 剪贴板读回：在原生壳里通过真实 UI 复制入口（例如代码块复制按钮）复制含中文、emoji、`\r\n` 换行、约 1 MB 长文本的内容，随后用 PowerShell `Get-Clipboard -Raw` 或 Win32 读回，内容逐字一致；失败路径：另一进程持有剪贴板（`OpenClipboard` 未释放）时，应用显示复制失败的可见状态、不崩溃、不卡死，释放后重试成功。验证：`node e2e/native-interop.mjs --check clipboard`，报告含各用例的写入哈希与读回哈希；层级标注“Windows 原生”。
- [ ] A2 外部编辑器：`--check editor` 在没有 VS Code 的当前机器上，界面显示该目的地不可用与原因 `not-installed`，点击入口没有启动任何新进程（前后进程列表差集为空）；传入非法 cwd（相对路径、含换行、空）时，经主窗口直接 invoke `open_project_in_vscode` 返回 Rust `validate_project_cwd` 的错误且未启动新进程；若用户已安装 VS Code，则项目含空格和中文的路径能启动 `Code.exe`，其命令行含该目录，主应用仍响应，关闭编辑器后无残余。已安装分支在本机未安装时必须在证据里写“未运行”，不得由模拟 IPC 结果代替。验证：命令输出与进程快照；用户步骤见实现提示。
- [ ] A3 托盘驱动：`e2e/native-tray-driver.ps1` 提供 `-Action hide|show|quit`，并保留 `-WhileMenuOpen`、`-Mouse`、直接 `WM_COMMAND` 三种投递方式。依次验证：hide 后进程存活、无可见主窗口、托盘窗口存在；show 后主窗口重新可见并获得前景焦点（`GetForegroundWindow` 属于本进程）；quit 后进程 5 秒内退出，`desktop.log` 本次新增部分含 `exit` 行（强制路径含 `exit (forced)`），无 `panic`，无 `msedgewebview2` 残余。失败路径：找不到托盘窗口时退出码非 0 并说明；在已经退出的进程上调用不报“成功”。验证：`node e2e/native-interop.mjs --check tray` 退出码 0，并附进程列表前后对照与日志摘录；`-Mouse` 方式需交互式桌面，作为附加记录，无法运行时写“未运行”。
- [ ] A4 底座集成与卫生：三个检查都经 PIL-0111 的 harness 启动，结束后本次进程树无残余，运行前已存在的进程不受影响；报告写入 `D:/pilaude/relay-evidence/PIL-0201/` 且不含环境变量值；`node --test e2e/native-interop.test.mjs` 覆盖参数校验、哈希比较、读回失败判定与退出码映射的纯逻辑用例，并通过。
- [ ] A5 收尾：`node --test e2e/native-interop.test.mjs`、`node_modules/.bin/tsc --noEmit`、`npm run lint`、`node scripts/relay.mjs guard --task PIL-0201` 通过，guard 无未豁免阻断项；脚本不含硬编码用户名、密钥与私有路径。

## 范围外

托盘 Quit 后 keep-awake 的 `powercfg /requests` 对照（PIL-0197 已由用户完成，PIL-0180 另有证据）；系统通知 toast 的内容与点击跳转（PIL-0166）；原生文件对话框（PIL-0167）；托盘菜单视觉复刻（PIL-0166）；修改 Rust 产品代码（发现缺陷请另建任务或请协调者扩范围）。

## 实现提示

- 托盘部分以 PIL-0197 的 `repro-tray-quit.ps1` 为蓝本整理成可复用脚本（该文件在仓库外，按内容重写入仓库，不要引用私有路径；默认 exe 路径改为参数）。托盘窗口是 message-only 窗口，`EnumWindows` 看不到，要用 `FindWindowEx(HWND_MESSAGE, …)` 枚举。
- 剪贴板被占用的失败用例可由一个测试内启动的辅助进程调用 `OpenClipboard` 后保持不放。
- 需要用户的步骤（最少）：（1）要覆盖 A2 的“已安装”分支，需用户先安装 VS Code（`winget install Microsoft.VisualStudioCode` 或官网安装包，用户级安装即可，无需管理员），装好后通知协调者；不装则该分支保持“未运行”。（2）要附带 `-Mouse` 真实点击托盘菜单，需用户保持桌面解锁并不要动鼠标约 30 秒。（3）本卡不需要管理员终端。

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-22T00:00Z · claude:sonnet-high:planner · 做了：由 PIL-0111 的原生检查清单拆出本卡，写入剪贴板、外部编辑器、托盘驱动三项。状态：未冻结。下一步：协调者审阅后 freeze；PIL-0166 如要复用托盘驱动，需把本卡加入其 depends_on。风险：本机无 VS Code，已安装分支需要用户先装。
- 2026-10-22T03:34Z · planner · 冻结验收标准 ec02513470fd
