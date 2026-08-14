# 备用方案：从酒馆服务端日志读取完整提示词与回复（README2）


## 一、前提：用“带日志”的方式启动酒馆

酒馆必须用下面命令启动，输出才会同时写入日志文件；普通 `node server.js` 启动没有日志文件。

### Windows（PowerShell）

```powershell
cd <你的酒馆安装目录>          # 例如：cd C:\SillyTavern
node server.js 2>&1 | Tee-Object -FilePath $env:TEMP\tavern.log
```

### macOS / Linux（bash）

```bash
cd <你的酒馆安装目录>          # 例如：cd ~/SillyTavern
node server.js 2>&1 | tee /tmp/tavern.log
```

> 日志路径可自行指定（比如 `$env:TEMP\tavern.log` / `/tmp/tavern.log`），
> 只要之后读日志时用同一个路径即可；不需要任何特定目录或用户名。

## 二、日志里能看到什么

ST 的 DeepSeek 后端会为每轮请求/响应输出：

```text
DeepSeek request: {
  messages: [ { role: 'system', content: '...' }, { role: 'user', content: '...' }, ... ],
  model: 'deepseek-v4-flash', temperature: 1, max_tokens: 30000, stream: true, ...
}
DeepSeek response: { ... content: '...', usage: { ... }, finish_reason: 'stop' }
Streaming request finished
```

- `messages` 数组 = 这轮**真正发给模型的一切**（含预设注入与世界书）；
- `DeepSeek response` / `Streaming request finished` = 模型回复与结束状态。

## 三、怎么读

### Windows（PowerShell）

```powershell
# 看最新 200 行
Get-Content $env:TEMP\tavern.log -Tail 200

# 只定位关键行
Select-String -Path $env:TEMP\tavern.log -Pattern 'DeepSeek request|DeepSeek response|Streaming request finished'
```

### macOS / Linux（bash）

```bash
tail -n 200 /tmp/tavern.log
grep -nE "DeepSeek request|DeepSeek response|Streaming request finished" /tmp/tavern.log
```

## 四、注意

- 只有用第一节的命令启动酒馆，日志文件才会持续更新；换回普通启动后文件不再增长。
- 日志会**非常大**，且包含完整提示词（可能含敏感内容）：只保存在本机，不要外发。
- 日志文件编码可能与读取端不一致，中文偶尔显示乱码——不影响定位请求/响应结构。
- 排查“没发请求”还是“模型返回空”：
  - 日志里**没有** `DeepSeek request` → 请求没发出去（查 API 连接/连接管理器档案）；
  - 日志里**有** request 但 response 为空/`...` → 模型端空回复（重试即可）。
