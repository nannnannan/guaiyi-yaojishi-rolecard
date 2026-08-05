# AI 制卡调试闭环（st-debug）

> 定位：打通「制卡 → 导入酒馆 → 亲手测试 → 监听输出 → 修复 → 再测」的闭环，
> 让 Codex 不再只停留在写文件，而是能亲自在用户电脑的酒馆上测试新卡。

## 命令速查

```text
node 入口/st-debug.mjs import <卡文件...>      自动导入角色卡/世界书
node 入口/st-debug.mjs place <文件> <目标>      放置文件到酒馆数据目录指定位置
node 入口/st-debug.mjs switch <角色名>         切换到目标卡
node 入口/st-debug.mjs send <文本> --wait      发送测试消息并等待生成
node 入口/st-debug.mjs talk <角色名> <文本>    一次连接内切换+发送+等待回复（聊天保留）
node 入口/st-debug.mjs delete [数量]           删除末尾消息（--dry-run 预览）
node 入口/st-debug.mjs regenerate              原生重新生成（可加 --capture）
node 入口/st-debug.mjs listen --timeout 30000  监听事件/控制台/toast（JSONL）
node 入口/st-debug.mjs test <卡文件>           一键闭环：导入→切换→发送→监听→报告→清理
node 入口/st-debug.mjs cleanup <角色名>        删除测试卡（--purge-chats 连聊天目录）
node 入口/st-debug.mjs log [行数]              读取酒馆服务端日志
```

通用选项：`--url`、`--json`、`--timeout`、`--headed`、`--dry-run`。
`send/delete/regenerate` 可加 `--character <角色名> --chat-id <聊天ID>`，因为每条 CLI
命令使用新的临时浏览器，不会继承上一条命令的角色选择。

## Codex 推荐工作流

### 测试一张新卡（test 一键闭环）

```powershell
node 入口/st-debug.mjs test 诡异药剂师_MVU_v0.4/dist/诡异药剂师_v0.4.json --json
```

`test` 会自动：导入卡 → 切换到该卡 → 发送测试消息并等待生成 → 同时监听
事件/控制台错误/toast → 读取新消息 → 删除测试卡（`--keep` 可保留以便人工检查）。
报告包含：导入名、新消息数、生成是否结束、监听事件数、错误列表、最后一条回复。

### 手动调试流程

1. `status` / `characters`：确认酒馆状态与现有角色。
2. `import 卡.json`：把新卡导入酒馆（走酒馆真实导入通道，自动打开新卡）。
3. `send "测试指令" --wait`：亲自发消息触发生成。
4. 生成异常时用 `listen --timeout 60000` 重放并抓取事件与控制台错误，
   或 `log 100` 看服务端日志。
5. 修改卡文件后重新 `import`（同名会替换，st-bridge 会提示）。
6. 测试完 `cleanup 卡名 --purge-chats` 清理。

### 放置文件到指定位置

```powershell
node 入口/st-debug.mjs place 世界书.json worlds/          # 世界书目录
node 入口/st-debug.mjs place 开场白.jsonl chats/角色名/     # 角色聊天目录
```

支持目录白名单：`characters`、`worlds`、`chats`、`group chats`、`QuickReplies`、
`backgrounds`、`user`、`extensions`、`instruct`、`sysprompt`、`themes`、
`OpenAI Settings`、`TextGen Settings`。覆盖已有文件前会自动备份为 `.bak-时间戳`。

## 监听内容（参考写卡知识库 06_事件监听）

`listen` 以 JSONL 输出，每条为 `{t, kind, name?, payload}`：

- `event`：酒馆事件（MESSAGE_SENT / MESSAGE_RECEIVED / GENERATION_STARTED /
  GENERATION_ENDED / GENERATION_STOPPED / CHARACTER_MESSAGE_RENDERED /
  USER_MESSAGE_RENDERED / STREAM_TOKEN_RECEIVED / TOOL_CALLS_PERFORMED /
  TOOL_CALLS_RENDERED / WORLDINFO_ENTRIES_LOADED / WORLDINFO_SCAN_DONE /
  CHAT_CHANGED / MESSAGE_DELETED）
- `console` / `pageerror`：页面控制台错误与未捕获异常（EJS 报错、正则错误等）
- `toast`：酒馆提示气泡（导入失败、API 错误等）

长文本默认截断到 500 字；事件名以 `手册/酒馆运行时速查.md` 的实测清单为准。

## 安全约定

- `cleanup` 只删除指定名字的角色卡；`--purge-chats` 仅删除
  `chats/<角色名>/` 目录，路径经过白名单校验。
- `place` 只允许写入酒馆数据目录的白名单子目录，拒绝路径穿越。
- 测试前建议用 `--dry-run` 预演；真实 `send` 会消耗模型额度。
- `delete` 会永久删除当前聊天末尾消息；先用 `delete N --dry-run` 核对目标。删除会触发
  `MESSAGE_DELETED`，让已安装的 MVU 按宿主事件链回退。
- `regenerate` 会删除末条助手回复并生成替代回复，同样会消耗模型额度；末条为用户消息时则直接续写。
- 导入同名卡会替换酒馆中的旧卡，注意区分「新增」与「替换」。
