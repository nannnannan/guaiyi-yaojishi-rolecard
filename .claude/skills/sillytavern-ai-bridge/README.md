# SillyTavern AI Bridge Skill

让 Codex 通过本地浏览器连接 SillyTavern，直接读取聊天、角色卡、世界书、预设、正则与 Tavern Helper 脚本，并执行受控的调试、导入和角色卡原位替换操作。

## 所需依赖

| 依赖 | 要求 | 用途 |
|---|---|---|
| Codex | 支持本地 Skills | 加载 `SKILL.md` 并调用打包脚本 |
| Node.js | **20 或更高版本**，附带 npm | Playwright `1.62.x` 的运行要求；执行全部 `.mjs` 程序 |
| SillyTavern | 本地已安装 | 提供要读取或操作的宿主页面；可由 `start` 启动 |
| Tavern Helper / JS-Slash-Runner | 在 SillyTavern 中启用 | 提供角色、世界书、预设、正则、脚本和 Slash 接口 |
| Playwright | `^1.62.0`，已锁定在 `package-lock.json` | 启动浏览器并连接宿主页面 |
| 浏览器 | Microsoft Edge，或 Playwright 管理的 Chromium | 默认通道是 `msedge` |

不需要额外的 Codex 插件、MCP 服务、云端数据库或远程部署平台。

## 按功能需要的可选依赖

- **模型 API 连接**：只有发送消息、重新生成或真实对话测试时需要；读取配置不消耗模型额度。
- **网络连接**：首次安装 npm 依赖，或单独安装 Chromium 时需要。依赖完成后，连接本地 SillyTavern 的基础操作无需外网。
- **Chromium**：没有 Edge 时，在 `scripts/runtime` 中运行 `npx playwright install chromium`，并设置 `ST_CHANNEL=chromium`。
- **SillyTavern 用户数据目录访问**：只有文件放置、日志读取和本地聊天备份等操作需要，通过 `ST_DATA_DIR` 指定。

## 安装

把完整的 `sillytavern-ai-bridge` 文件夹复制到 Codex Skills 目录：

```text
Windows: %USERPROFILE%\.codex\skills\sillytavern-ai-bridge
macOS/Linux: ~/.codex/skills/sillytavern-ai-bridge
```

安装锁定依赖：

```text
node <skill-dir>/scripts/bridge-runner.mjs setup
```

安装器执行 `npm ci --ignore-scripts`，跳过浏览器下载，并使用系统临时 npm 缓存，不会把缓存写进 Skill 包。

## 环境变量

| 变量 | 是否必需 | 说明 |
|---|---|---|
| `ST_URL` | 否 | SillyTavern 地址，默认 `http://127.0.0.1:8000` |
| `ST_PASSWORD` | 条件必需 | 出现本地登录表单时使用；不得写入文件或日志 |
| `ST_CHANNEL` | 否 | `msedge`（默认）或 `chromium` |
| `ST_HEADED` | 否 | 设为 `1` 时显示浏览器窗口 |
| `ST_DATA_DIR` | 条件必需 | 非默认 SillyTavern 用户数据目录 |
| `ST_ROOT` | 条件必需 | SillyTavern 安装目录（含 `server.js`）；`start` 无法从数据目录反推时使用 |
| `ST_LOG_DIR` | 否 | `start` 保存 stdout/stderr 的目录；默认 `<ST_DATA_DIR>/bridge-logs` |
| `ST_OUTPUT_DIR` | 否 | 截图和角色卡替换备份的父目录 |
| `ST_CAPTURE_DIR` | 条件必需 | 用户明确要求提示词捕获时使用的私密目录 |
| `ST_SKILL_PRIVACY_DENYLIST` | 否 | 发布校验时附加的项目专用拒绝词，以 `|` 分隔 |

## 最小检查

```text
node <skill-dir>/scripts/bridge-runner.mjs verify
node <skill-dir>/scripts/bridge-runner.mjs start --json
node <skill-dir>/scripts/bridge-runner.mjs bridge status --json
```

`start` 在服务离线时后台启动 SillyTavern，并把终端标准输出、标准错误分别追加到日志文件。读取方式：

```text
node <skill-dir>/scripts/bridge-runner.mjs debug terminal-log 200
```

这属于“通过日志文件间接查看终端输出”，不是截取终端窗口画面。SillyTavern 自身的 `content.log` 仍通过 `debug log 200` 读取。

`bridge send` 和 `debug send` 现在默认在同一进程内等生成结束。只有明确需要入队即退出时才用 `--no-wait`；新的 CLI 进程不能可靠续接上一进程的 `wait/stop`。

直接读取存储配置，不使用提示词透视：

```text
node <skill-dir>/scripts/bridge-runner.mjs config preset --full --json
node <skill-dir>/scripts/bridge-runner.mjs config regex --character "Example Character" --full --json
node <skill-dir>/scripts/bridge-runner.mjs config scripts --character "Example Character" --full --json
```

详细安装说明见 `references/setup.md`，完整命令见 `references/command-reference.md`，写操作和隐私边界见 `references/privacy-and-safety.md`。

## 隐私说明

发布包不包含运行日志、截图、提示词捕获、角色卡备份、聊天 ID、用户角色名、世界书正文、绝对用户路径或宿主测试快照。运行时读取到的内容仍可能敏感；不需要正文时不要使用 `--full`，也不要把运行输出重新打进 Skill 包。
