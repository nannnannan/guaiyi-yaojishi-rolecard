# 提示词监听（prompt-capture）

给 `st-debug` 的 `talk / send / test` 增加「每轮问答全量监听」：
不仅看到你输入的文字和 AI 输出的文字，还能看到**实际发给模型的完整负载**
（system 提示、预设注入、世界书、正则处理后的历史、你的输入）与模型返回内容。

这是「提示词透视镜 PromptScope」的 CLI 版：PromptScope 用酒馆助手事件快照
`messages`；本模块直接挂钩酒馆的模型代理接口
`/api/backends/chat-completions/generate`，拿到的是**真正发出请求的那份 body**
与**完整流式响应**（含 usage / finish_reason），更接近“AI 实际看到的东西”。

## 用法

```powershell
cd AI接入酒馆工具

# 对话并捕获本轮全量负载
npm run debug -- talk 《诡异药剂师》v0.4 "林恩听到了门外的动静。" --capture

# 发送并等待（也支持）
npm run debug -- send "继续" --wait --capture

# 一键测试新卡并捕获
npm run debug -- test 卡.json --capture
```

每次命令结束会在输出里打印捕获摘要（模型、消息条数/角色、提示 token 估算、
回复字符数、世界书命中数）与文件路径。

## 产物

- `提示词监听/captures/<角色>-<时间戳>.json`
  —— 本轮完整记录：`messages`（role+content 全量）、`request`（模型/参数）、
  `worldbook`（名称+命中启发式）、`preset`、`reply`（AI 回复全文）、
  `response`（status/usage/finishReason/原始长度）、`reasoning`。
- `提示词监听/captures/prompt-scope-viewer.json`
  —— 追加式导出，兼容 `00-Shared/提示词透视镜/viewer.html`，浏览器打开查看器
  加载此文件即可浏览每一轮（发给 AI / AI 回复 / 世界书命中 / 预设）。

## 说明与限制

- 捕获不读 API Key / 请求头，只记录接口 body 与响应文本，保存在本地。
- 世界书命中是启发式（条目长行与 messages 文本比对），精确归因请用
  ST 自带 Prompt Itemization。
- `send` 不带 `--wait` 时生成在后台继续，捕获最多等 8 秒，可能拿不到（建议 `--wait`）。
- token 数为字符估算（约 1.5 字符/token），非模型真实 token。

## 备用方案：酒馆服务端日志（仅当 --capture 不可用时使用）

`--capture` 因版本/环境原因捕获不到时，可改从酒馆服务端日志读取完整请求与回复
（`DeepSeek request` / `DeepSeek response` / `Streaming request finished`）。
完整、跨平台（Windows/macOS/Linux）的命令与说明见 **`README2.md`**；
`--capture` 结构化记录始终优先，日志只是兜底。
