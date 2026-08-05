# AI 接入与制卡调试工具（st-bridge / st-debug / 导入器 / 提示词监听）

> 给**任何 AI 代理（Codex 等）或人**使用的本地 SillyTavern 操作工具。
> 目标：在一个**全新的、什么都没装**的环境里，只靠 Node.js、一个浏览器和一份本指南，
> 就能连接酒馆、读聊天、切角色、发消息、导入角色卡、监听每轮模型请求与回复、测试并清理。
> 本工具**不依赖任何 Codex skill、插件或预设**；依赖只有 Node.js、系统浏览器、
> 运行中的 SillyTavern（含酒馆助手插件）和网络。

**不参与任何版本工程的构建**。

---

## 1. 这是什么（能力总览）

- `st-bridge`：基础接入。状态、聊天、角色、世界书、发送、等待、停止、Slash、eval、截图。
- `st-debug`：制卡调试闭环。导入、放置文件、对话、监听事件/控制台/toast、一键测试并清理、日志。
- `角色卡导入器`：一条命令完成「导入 → 标签 → 世界书 → 酒馆助手脚本 → 正则 → 首次进聊天 → 收尾修复」。
- `角色卡替换器`：把新卡原位写入旧卡头像槽位，完整保留聊天；安全删除旧卡独占绑定的旧世界书，失败自动回滚。
- `配置直读器`：不经过提示词监听，直接读取预设、正则和酒馆助手脚本正文。
- `提示词监听`：每轮捕获**真正发给模型的完整请求负载**（system/预设/世界书/历史/输入）与**模型回复**。

---

## 2. 前置依赖（全新环境清单）

| 依赖 | 要求 | 说明 |
|---|---|---|
| 操作系统 | Windows（本机实测；macOS/Linux 理论可用） | 以下命令以 PowerShell 为例 |
| Node.js | 18+（含 npm） | `node --version` 确认；没有就先装 Node LTS |
| 浏览器 | Microsoft Edge（系统自带）或 Chromium | 无 Edge 时 `npx playwright install chromium` 并设 `ST_CHANNEL=chromium` |
| SillyTavern | 1.17.0+，正在运行 | 默认地址 `http://127.0.0.1:8000`（可在 `config.yaml` 改端口） |
| 酒馆助手 | Tavern Helper 4.8.19+ | 角色卡 MVU/状态栏依赖它；未装时正文可读但状态不持久 |
| 模型 API | 酒馆里已配置并连接（DeepSeek 等） | 无可用 API 时发消息不会成功 |
| 网络 | 首次 `npm install`、以及卡片 CDN 脚本（jsdelivr）可达 | MagVarUpdate / Zod 桥接 / 状态栏都从 CDN 加载 |
| 其他 | 无 | 不依赖任何 skill / 插件 / 预置环境 |

---

## 3. 从零开始（一步步，带成功判据）

### 第 0 步：确认前置

```powershell
node --version        # 必须 >= 18
npm --version         # 随 Node 一起安装
```

启动 SillyTavern（在酒馆目录运行 `node server.js` 或 `Start.bat`），确认浏览器能打开
`http://127.0.0.1:8000`。酒馆里**确认 API 已连接**（OpenAI 面板/连接管理器显示连接成功）。

### 第 1 步：安装依赖

```powershell
cd AI接入酒馆工具
npm install
```

判据：命令结束无报错，目录出现 `node_modules/`。

### 第 2 步：确认环境变量（通常不用改）

默认用户正常安装酒馆时，酒馆数据目录就在 `~/SillyTavern/data/default-user`
（即 `C:\Users\<你的用户名>\SillyTavern\data\default-user`），**与工具默认值一致，无需设置**。
只有酒馆装在自定义位置（例如测试机上的 `C:/jiuguan/SillyTavern/...`）才需要覆盖：

```powershell
# 自定义安装位置时：酒馆数据目录必须指向真实位置！
$env:ST_DATA_DIR = "D:\你的路径\SillyTavern\data\default-user"

# 可选
$env:ST_URL = "http://127.0.0.1:8000"       # 酒馆地址（默认值就是它）
$env:ST_PASSWORD = "你的密码"                 # 酒馆开了白名单密码才需要
$env:ST_CHANNEL = "msedge"                   # msedge / chromium
```

> 常见报错：`酒馆数据目录不存在: .../SillyTavern/data/default-user（请设置 ST_DATA_DIR）`
> → 说明该路径不存在（多为自定义安装位置），按上面方式设置 `ST_DATA_DIR` 指向真实的
> 酒馆 `data/default-user` 目录。

### 第 3 步：接入自检

```powershell
npm start
```

判据：输出 `角色卡数: N`（N > 0）与 `连接状态: 有效的`。

### 第 4 步：16 项自动化自检

```powershell
npm run verify
```

判据：`结果: 16/16 通过`。任何一项失败按输出排查（最常见：ST_DATA_DIR、端口、浏览器）。

### 第 5 步：试一句真实对话

```powershell
npm run debug -- talk 《诡异药剂师》v0.4 "你好，请简单自我介绍一下"
```

判据：返回真实回复。若返回 `...`（空），见「已知问题 7」（模型端间歇空回复，重试即可）。

### 第 6 步：导入一张新卡（全流程）

```powershell
npm run import-card -- 卡文件.json
# 或指定打开已有聊天
npm run import-card -- 卡文件.png --chat "《诡异药剂师》v0.4 - 2026-08-02@20h43m06s881ms"
```

判据：输出 `角色: <卡名>`、`标签/世界书/TH 脚本/正则/聊天` 各字段，无 `errors`。

### 第 7 步：把新版本替换进旧卡并保留聊天

```powershell
npm run replace-card -- "旧卡名" "新卡.json" --dry-run
npm run replace-card -- "旧卡名" "新卡.json" --confirm-target "旧卡名"
```

判据：报告中的聊天指纹全部一致、头像槽位未改变；若新旧世界书异名，旧绑定世界书标记为已删除；
若同名则标记为原位更新；并给出自动备份目录。

---

## 4. 目录结构与职责

| 路径 | 作用 |
|---|---|
| `入口/st-bridge.mjs` | 基础接入 CLI：status/chat/characters/switch/send/exec/eval 等 |
| `入口/st-debug.mjs` | 制卡调试闭环 CLI：import/place/talk/listen/test/cleanup/log 等（含 `--capture`） |
| `角色卡导入器/import-card.mjs` | 全流程导入 CLI（详细见 `角色卡导入器/README.md`） |
| `角色卡替换器/replace-card.mjs` | 保留聊天的原位替换 CLI（详细见 `角色卡替换器/README.md`） |
| `入口/st-config.mjs` | 预设、正则、酒馆助手脚本的独立只读查询 CLI |
| `提示词监听/prompt-capture.mjs` | 每轮问答全量监听（详细见 `提示词监听/README.md`） |
| `核心/tavern-session.mjs` | 共享会话逻辑：连接、登录、自动连 API、发送、等待生成、导入、删除 |
| `tools/probe.mjs` | 运行时探测：输出当前酒馆真实 API 表面（酒馆升级后重跑校对） |
| `tools/verify.mjs` | 16 项自检（只读 + dry-run；含配置直读、删除/重生成、角色替换预检） |
| `tools/verify-replace-card.mjs` | 只使用唯一临时卡的连续两次角色替换写入型测试 |
| `测试卡样例/` | 闭环演练用测试卡与世界书 |
| `大脑/AI接入指南.md` | 给 AI 代理的行为规范与写卡工作流 |
| `手册/` | 酒馆运行时速查（实测）、调试闭环说明、三件套整理说明 |
| `三件套原件/` | 玉藻前入口 / 明月秋青大脑 / 写卡知识库 的原始文件备份（不改） |
| `screenshots/`、`提示词监听/captures/` | 运行时生成目录（已 gitignore，自动重建） |

---

## 5. 命令总表

通用选项：`--url <地址>`、`--json`、`--timeout <毫秒>`、`--dry-run`、`--headed`、
`--channel <msedge|chromium>`。写操作可用 `--character <角色名>` 与 `--chat-id <聊天ID>`
在同一命令内定位目标聊天；只给 `--chat-id` 会被拒绝。

### 基础接入（`npm run bridge -- <命令>`）

| 命令 | 说明 |
|---|---|
| `status` | 酒馆/助手版本、当前角色、聊天与连接状态 |
| `chat [条数]` | 读取最近聊天（`--raw` 全文） |
| `characters` | 列出全部角色卡 |
| `switch <角色名>` | 切换到指定角色 |
| `send <文本>` | 发送并触发生成（`--wait` 等待结束） |
| `delete [数量]` | 删除末尾 N 条消息（默认 1）；`--dry-run` 预览；触发原生 `MESSAGE_DELETED` |
| `regenerate` | 使用酒馆内置重新生成并等待替代回复；`--dry-run` 仅检查 |
| `wait` / `stop` | 等待生成结束 / 停止生成 |
| `worldbooks` / `worldbook <名称>` | 世界书列表 / 读条目（`--full`） |
| `exec <slash>` | 执行 Slash 命令（如 `/echo hi`） |
| `eval <JS>` | 在页面执行 JS（`ctx`、`TH` 已注入） |
| `screenshot [路径]` | 保存页面截图 |

### 配置直读器（`npm run config -- <命令>`）

这是独立的只读程序 [st-config.mjs](入口/st-config.mjs)，直接读取酒馆保存的配置对象，不使用提示词
监听，也不会触发生成。摘要模式只列名称、状态和长度；加 `--full` 才返回完整正文。所有输出都会自动
遮蔽疑似 API Key、密码、令牌和 Cookie 字段。

| 命令 | 说明 |
|---|---|
| `preset [预设名]` | 读取当前加载预设或指定预设；`--list` 列出预设，`--full` 返回设置和提示词全文 |
| `regex` | 读取正则；支持 `--scope global\|character\|all`、`--character <角色名>`、`--state` |
| `scripts` | 读取酒馆助手脚本；范围和状态选项与 `regex` 相同 |

```powershell
npm run config -- preset --json
npm run config -- preset --full --json
npm run config -- regex --character "《诡异药剂师》v0.4" --full --json
npm run config -- scripts --scope all --character "《诡异药剂师》v0.4" --full --json
```

未提供 `--scope` 时：带 `--character` 默认读该角色；不带则默认读全局。`all` 必须同时提供角色名，
这样独立浏览器停在系统欢迎页时也不会误读错误角色。

删除/重新生成建议先预览并显式指定目标：

```powershell
npm run bridge -- delete 1 --dry-run --character 《诡异药剂师》v0.4 --chat-id 聊天ID
npm run bridge -- delete 1 --character 《诡异药剂师》v0.4 --chat-id 聊天ID
npm run bridge -- regenerate --character 《诡异药剂师》v0.4 --chat-id 聊天ID
```

### 制卡调试闭环（`npm run debug -- <命令>`）

| 命令 | 说明 |
|---|---|
| `talk <角色名> <文本>` | 切换角色、发送并等待回复（聊天保留）；`--capture` 捕获本轮全量负载 |
| `send <文本> --wait --capture` | 发送并等待；`--capture` 捕获本轮 |
| `delete [数量]` | 删除末尾 N 条消息；保留酒馆/MVU 原生回退事件链 |
| `regenerate [--capture]` | 重新生成末条助手回复；可捕获本轮完整请求与回复 |
| `import <文件...>` | 自动导入角色卡/世界书（JSON/PNG/YAML/charx/byaf） |
| `place <文件> <目标>` | 放置文件到酒馆数据目录白名单位置（覆盖前自动备份） |
| `listen [--timeout ms]` | 监听事件/控制台/toast（JSONL） |
| `test <卡文件> [--prompt 文本] [--keep] [--capture]` | 一键闭环：导入→切换→发送→监听→报告→清理 |
| `cleanup <角色名>` | 删除角色卡（删除前自动备份聊天目录到 `backups/`） |
| `log [行数]` | 读取酒馆服务端日志尾部 |

`place` 可用目录：`characters`、`worlds`、`chats`、`group chats`、`QuickReplies`、
`backgrounds`、`user`、`extensions`、`instruct`、`sysprompt`、`themes`、
`OpenAI Settings`、`TextGen Settings`。

### 角色卡导入（`npm run import-card -- <卡文件> [选项]`）

```powershell
npm run import-card -- 诡异药剂师_MVU_v0.4/dist/诡异药剂师_v0.4.json
npm run import-card -- 卡.png --chat "角色名 - 2026-08-02@20h43m06s881ms"
```

选项：`--tags all|existing|none`、`--worldbook yes|no`、`--scripts yes|no`、
`--regex yes|no`、`--chat <聊天文件名>`、`--keep-dialog-settings`。

### 角色卡替换（`npm run replace-card -- <旧角色名> <新卡> [选项]`）

```powershell
npm run replace-card -- "《诡异药剂师》v0.4" "诡异药剂师_v0.5.json" --dry-run --json
npm run replace-card -- "《诡异药剂师》v0.4" "诡异药剂师_v0.5.json" `
  --confirm-target "《诡异药剂师》v0.4"
```

替换器保留旧头像文件槽位及其所有聊天；新卡名、正文、开场白、世界书绑定、正则和助手脚本改为新版。
新卡内嵌世界书会创建或更新；新旧世界书异名时，只删除旧卡实际绑定且未被其他角色卡共享的旧世界书。
同名时原位更新；检测到共享绑定或绑定名/内嵌名冲突时，在写入前拒绝。实际覆盖前固定生成可恢复备份，
并在写入后重连验证。
详见 `角色卡替换器/README.md`。

### 提示词监听（挂在 debug 命令上）

```powershell
npm run debug -- talk 《诡异药剂师》v0.4 "继续" --capture
npm run debug -- test 卡.json --capture
```

产物：`提示词监听/captures/<角色>-<时间戳>.json`（完整记录）+ `prompt-scope-viewer.json`
（兼容 `00-Shared/提示词透视镜/viewer.html` 打开）。

> 兜底：如果 `--capture` 因版本/环境原因捕获不到，可改用酒馆服务端日志查看完整请求/响应
> （`node server.js 2>&1 | Tee-Object -FilePath C:\tmp\tavern.log` 启动酒馆后读该文件），
> 详见 `提示词监听/README.md`「备用方案」一节。

### 探测与自检

```powershell
npm run probe      # 输出酒馆真实 API 表面（版本/事件/TH 接口）
npm run verify     # 16 项只读/dry-run 自检
npm run verify-replace  # 写入型测试；只创建并清理唯一临时卡
```

---

## 6. 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `ST_URL` | `http://127.0.0.1:8000` | 酒馆地址 |
| `ST_DATA_DIR` | `~/SillyTavern/data/default-user` | 酒馆数据目录（默认用户正常安装时即此路径，无需设置；自定义安装位置才覆盖） |
| `ST_PASSWORD` | — | 酒馆白名单访问密码 |
| `ST_CHANNEL` | `msedge` | 浏览器通道（msedge / chromium） |
| `ST_HEADED` | — | 设为 `1` 显示浏览器窗口 |

---

## 7. 核心机制（给 AI 读懂原理）

### 7.1 连接与登录

用 Playwright 启动系统 Edge（无头），打开酒馆页面，等待 `window.SillyTavern`、
`TavernHelper`、`chat` 数组和角色列表就绪；检测到可见登录表单时用 `ST_PASSWORD` 填写提交。
密码只进登录表单，不写日志、不读取。

### 7.2 API 自动连接（为什么发送按钮可能“消失”）

酒馆的 RossAscends 逻辑：**未连接 API 时 `#send_but` 是隐藏的**。无头会话的
`autoConnect=false` 时不会自动连，导致 send/talk 报「发送按钮不可见」。
`tavern-session.ensureApiConnected()` 在连接后检查发送按钮，隐藏则自动点击
`#api_button_openai` 并等待按钮出现（最多 15 秒）。

### 7.3 发送与等待生成

- 发送路径：填 `#send_textarea` → 点可见的 `#send_but`；点不到就回车；还不行就 JS 原生
  `.click()`（隐藏按钮也能触发 jQuery 事件）。
- 等待生成（`waitForGeneration`）：监听 `GENERATION_STARTED / GENERATION_ENDED`，
  同时轮询 `#stop_generating`。**必须等 `GENERATION_ENDED`，或停止按钮消失后稳定 1.5 秒**，
  否则会把生成开始时的 `...` 占位消息误判成“已结束”（真机踩过的坑）。

### 7.4 删除消息与重新生成

- **来源**：二者都是 SillyTavern 1.17.0 自带 `script.js` 的宿主功能，不是角色卡、世界书或
  Tavern Helper 私有按钮。运行时核对到 `ctx.deleteMessage`、`ctx.generate` 与
  `#option_regenerate`。
- **删除**：`delete [数量]` 从聊天末尾逐条调用宿主 `ctx.deleteMessage`，等待
  `MESSAGE_DELETED`，最后显式保存聊天。旧的 `ctx.deleteLastMessage` 只改内存与 DOM、没有保存，
  因此不再作为工具删除路径。
- **重新生成**：工具点击宿主 `#option_regenerate`，让原生处理器设置生成锁、处理群聊/连接参数并
  调用 `Generate('regenerate')`。当末条是助手消息时，酒馆先删除旧回复、发出
  `MESSAGE_DELETED`，再生成替代回复；末条是用户消息时则追加新的助手回复。
- **MVU**：工具不直接改 `stat_data`。回退依赖酒馆删除事件和已安装 MVU 的监听器，与页面按钮
  使用同一生命周期。
- **世界书**：删除/重新生成不会主动改写世界书文件或条目；世界书是否参与下一轮提示词由删除后的
  聊天历史、变量与正常扫描重新计算。
- **目标定位**：每条 CLI 命令都会创建新的临时浏览器上下文，不继承上一条 `switch`。因此
  `send/delete/regenerate` 支持 `--character`/`--chat-id`，在当前命令里完成角色切换和聊天打开；
  未显式定位时若仍在系统欢迎页，删除与重新生成会安全拒绝。

### 7.5 弹窗处理（导入流程）

酒馆弹窗容器是 `.popup`，按钮有 `.popup-button-ok / -cancel / -close / -custom`。
导入器按顺序自动判定：

1. 标签弹窗：自定义按钮 `Import All / Import Existing / Import None`（按 `--tags` 选择）；
2. 世界书确认框：文案可能是「确定要导入 'X' 吗？」+ 确定/否，或英文
   `This character has an embedded World/Lorebook...`（`--worldbook yes` 点确定/是）；
3. 酒馆助手脚本弹窗：含复选框 → 全部勾选后点确认（`--scripts no` 则跳过）；
4. 其余含复选框弹窗：默认勾选并确认。

### 7.6 角色卡导入器机制

1. **原生导入通道**：`#character_import_file` 触发 ST 自己的导入逻辑（不用手改数据目录）；
2. **等待导入结果**：按“新头像文件”判定（同名卡会生成 `同名1.png`），并校验新卡名与源卡一致，
   否则继续等待/中止（安全闸，防误操作其他卡）；
3. **世界书**：通过角色编辑面板触发 `checkEmbeddedWorld`，确认后把卡内世界书导入为全局世界书
   并关联（`worlds/<名>.json`）；弹窗没出现则从「更多 → 导入卡内世界书」兜底；
4. **TH 脚本 / 正则**：TH 弹窗勾选启用；正则把头像加入 `character_allowed_regex`；
5. **首次进聊天**：导入后自动点进角色聊天（或 `--chat` 指定已有聊天）；
6. **收尾重建文件**：页面保存角色时若只持有浅层数据，会把 `data.character_book` 剥掉。
   导入器最后用源卡重建角色 PNG（**chara+ccv3 双文本块、必须写在 IEND 之前**，与酒馆自身
   写入格式一致），把世界书/脚本/正则/聊天绑定全部写回，并先备份原文件。

### 7.7 提示词监听机制

酒馆把「最终发给模型的完整负载」通过代理接口 `/api/backends/chat-completions/generate`
转发给模型。监听模块在页面挂钩 `fetch`，捕获该接口的**请求 body**（含全部 messages：
system 提示、预设注入、世界书、正则处理后的历史、玩家输入）与**完整流式响应**
（SSE 按 `data:` 行解析，得到 AI 回复全文、usage、finish_reason、reasoning）。
不读 API Key / 请求头。每轮写一个完整 JSON + 一份 viewer 兼容导出。

### 7.8 状态栏前端交互（无头会话的渲染差异）

角色卡状态栏由正则把 `<StatusPlaceHolderImpl/>` 替换成 ` ```html ` 代码围栏。
**用户浏览器**里酒馆助手会把它渲染成可执行界面；**无头会话**里 ST 的 markdown 只渲染成
高亮代码块（DOM 里只有 `hljs-*`），没有 `.wa-panel`、没有按钮——**这不是卡坏了**。

需要真实点击状态栏按钮时：

```js
const statusHtml = readFileSync('诡异药剂师_MVU_v0.4/src/ui/status.html', 'utf8');
await page.evaluate((html) => {
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  const host = document.createElement('div');
  host.innerHTML = html.replace(/<script>[\s\S]*?<\/script>/, '');
  document.querySelector('#chat')?.appendChild(host);
  if (scriptMatch) {
    const script = document.createElement('script');
    script.textContent = scriptMatch[1];
    document.head.appendChild(script);
  }
}, statusHtml);
// 等 bootstrap 找到 window.Mvu（卡的 TH 脚本从 CDN 加载 MagVarUpdate，最多约 15 秒）
```

「推进」按钮逻辑：`findReadyPair`（前件 完成/变形/取消 或 活跃且收尾=true，后件 未触发）→
`advanceCurrentEvent()`（前件活跃→完成、后件→预兆、写近期预兆与事件通知）→
`Mvu.replaceMvuData({type:'message', message_id:'latest'})`。
验证以**聊天文件最后一条消息的 `variables[0].stat_data`** 为准。

---

## 8. 已知问题与踩坑记录（真机实测汇总）

1. **无头会话看不到状态栏按钮**：` ```html ` 围栏渲染成代码块，不是卡坏；按 7.8 注入。
2. **手工改角色 PNG 会“变没”**：chara/ccv3 块必须在 IEND 之前，否则酒馆列表不显示该角色；
   导入器收尾已按此格式，不要手改 `characters/` 下的卡文件。
3. **页面保存剥掉世界书**：ST 保存浅层角色会把 `data.character_book` 写没；
   改卡后用导入器收尾重建即可。
4. **同名卡导入生成 `同名1.png`**：按新头像文件判定 + 卡名安全闸。
5. **世界书确认框是本地化文案**：「确定要导入 'X' 吗？」+ 确定/否，导入器已覆盖。
6. **cleanup 会连聊天一起删**：`TavernHelper.deleteCharacter` 与 `--purge-chats` 无关，
    删除前工具已自动备份 `chats/<角色名>` 到 `<ST_DATA_DIR>/backups/chat-<角色名>-<时间戳>`。
7. **DeepSeek 间歇空回复**：偶发只回 1 个 token 思考（如「吾」）且正文为空，重试 1-2 次即成功；
   `--capture` 可区分“没发请求”与“模型返回空”。
8. **无头会话不会自动连 API**：`autoConnect=false` 时发送按钮隐藏；已内置自动连接。
9. **`send` 不带 `--wait` 时捕获可能拿不到**：生成在后台继续，监听最多等 8 秒；请用 `--wait`。
10. **标签弹窗设置可能不生效**：`tag_import_setting` 通过 UI 设置受版本影响；
    以“标签是否导入成功”为准。
11. **连接管理器档案未选中 → 不发请求**：`status` 正常但生成 1 秒内结束且回复空时，
    检查酒馆顶部「连接管理器」是否选中了档案（无档案且源设置无 Key 时不会发模型请求）。
12. **改模型不生效**：实际模型取自连接档案 `preset` 对应的预设文件
    （`OpenAI Settings/<预设名>.json`）里的 `deepseek_model` / `openai_model`，
    不是档案的 `model` 字段。

---

## 9. 备忘纪要（给任何接手 AI 的行为守则）

### 身份与心态

- 你是在操作一个真实酒馆：聊天、角色卡、世界书都是用户数据。只读优先，写操作三思。
- 失败即报告：命令失败把错误原样输出，不要假装成功、不要编造“已修复”。
- 不确定的接口：先看 `手册/酒馆运行时速查.md`，没有就 `npm run probe` 实测，不要凭记忆写 API。

### 命令纪律

- 读：`status / chat / characters / worldbooks / worldbook / log` 随便用。
- 写：`send / talk / switch / import / place / exec / eval` 会改变酒馆状态，先说明影响再执行。
- 测试卡：用 `test` 闭环（默认自动清理）；不要拿用户正式角色的当前聊天做测试。
- 删除：`cleanup` 只删明确指定的卡，删除前会自动备份聊天；不要 `rm` 酒馆数据目录。
- 密钥：绝不 eval 读取 API Key / 扩展密钥；密码只经登录表单，不进日志。

### 项目约定（仓库级）

- `dist/` 是构建产物，不手改；版本工程源码改动后必须跑该版本目录的 `npm run check`，
  并同步 `host_acceptance.json`、README、AGENTS.md 中的基线（字节/SHA-256）。
- 旧版本目录（v0.1–v0.3.3.1）保持不动。
- 本工具目录与版本工程相互独立，不参与版本构建。

### 常见误区

- “无头看不到状态栏” ≠ 状态栏坏了（见 7.8）。
- “列表里没有某卡” ≠ 卡被删了：先看 `characters/` 下文件是否还在、能否被酒馆解析
  （chara 块位置、ccv3 是否在）。
- “回复是空的” ≠ 工具坏了：先用 `--capture` 确认请求是否发出，再判断是连接问题还是模型空回复。

---

## 10. 安全与数据保护

- 只读命令放心用；写操作想清楚影响。
- 不绕过认证；`ST_PASSWORD` 只用于登录表单。
- 不读取/记录 API Key、扩展密钥；提示词监听只记录接口 body 与响应，均保存在本地。
- `test` 默认自动删除测试卡与聊天；`cleanup` 只删指定卡并先备份聊天。

---

## 11. 验证与测试

- `npm run verify`：16 项自检（基础读取、三个配置直读命令、只读 Slash、写操作 dry-run、角色替换
  dry-run、截图），
  全过即环境就绪。
- `npm run verify-replace`：连续两次原位替换的真实写入验收，只操作并清理带时间戳的临时卡和临时世界书。
- `npm run probe`：输出酒馆真实 API 表面（版本、事件、TH 接口），酒馆升级后重跑并校对手册。
- `测试卡样例/调试测试卡.json`：闭环演练卡，`test` 自动导入并清理。

---

## 12. 三件套来源与手册

本工具是对三件配套制卡工具的整理与再实现：玉藻前一键写卡器（入口）、明月秋青预设（大脑）、
写卡知识库（手册）。原件在 `三件套原件/` 保持不改；整理说明见
`手册/三件套整理说明.md`；酒馆接口速查见 `手册/酒馆运行时速查.md`（实机探测，优先以
`npm run probe` 结果为准）。

---

## 13. 维护记录

- 2026-08-03：落地 st-bridge/st-debug；加入 `角色卡导入器`（全流程 + 收尾重建 PNG +
  安全闸）；加入 `提示词监听`（完整请求/回复捕获，viewer 兼容）；修复 cleanup 误删聊天
  （删除前自动备份）、无头自动连接 API、等待生成竞态；清理本机路径与测试痕迹；
  整理为本文档。
- 2026-08-04：依据本机 SillyTavern 1.17.0 运行时源码与真实页面探针，加入末尾消息删除与
  原生重新生成命令；删除路径保留 `MESSAGE_DELETED`/保存链，重新生成复用内置按钮；加入预设、
  正则、酒馆助手脚本配置直读器，以及保留聊天、精准轮换绑定世界书的角色卡原位替换器；自检扩为
  16 项，并增加只操作唯一临时卡的共享引用保护与连续升级写入验收。
