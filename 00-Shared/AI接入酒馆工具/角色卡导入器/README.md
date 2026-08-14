# 角色卡导入器（import-card）

一条命令完成「导入角色卡 → 打标签 → 选世界书 → 选酒馆助手脚本 → 启用正则 → 首次进聊天」的全流程，专为 AI 代理（Codex 等）在真实酒馆里导入新卡设计。

## 用法

```powershell
cd AI接入酒馆工具
npm run import-card -- 卡文件.json
npm run import-card -- 卡文件.png --tags all --worldbook yes --scripts yes --regex yes
npm run import-card -- 卡文件.json --chat "《诡异药剂师》v0.4 - 2026-08-02@20h43m06s881ms"
```

## 它会做什么

1. **导入**：走酒馆原生通道（`#character_import_file`），不手改数据目录。
2. **标签弹窗**：自动点「Import All」（或按 `--tags` 选 Existing / None）。
3. **世界书弹窗**：默认点「Yes」把卡内世界书导入为全局世界书并关联到角色（`--worldbook no` 则跳过）；若弹窗未出现，会从「更多 → 导入卡内世界书」兜底执行。
4. **酒馆助手脚本弹窗**：默认勾选全部脚本并确认启用（`--scripts no` 跳过）。
5. **正则脚本**：默认把该角色加入 `character_allowed_regex` 允许列表（`--regex no` 跳过）。
6. **首次进聊天**：导入后自动点进角色聊天（或按 `--chat` 打开指定聊天），等待消息渲染。
7. **收尾修复**：把完整卡数据（世界书 49 条目、TH 脚本、正则、聊天绑定）直接写回角色 PNG
   （chara+ccv3 双块、位于 IEND 之前，与酒馆自身写入格式一致），避免页面保存浅层角色时剥书。
8. **验证报告**：输出标签、世界书关联、TH 脚本、正则、聊天状态；`--json` 可机器读取。

## 选项

| 选项 | 说明 |
|---|---|
| `--tags all\|existing\|none` | 标签弹窗选择（默认 all） |
| `--worldbook yes\|no` | 卡内世界书导入并关联（默认 yes） |
| `--scripts yes\|no` | 酒馆助手脚本启用（默认 yes） |
| `--regex yes\|no` | 角色正则启用（默认 yes） |
| `--chat <聊天文件名>` | 导入后打开指定聊天 |
| `--keep-dialog-settings` | 不恢复弹窗设置（默认结束后恢复原值） |
| `--json` / `--headed` / `--timeout` / `--url` | 通用选项 |

## 说明

- 导入前会临时把「标签导入设置」设为 Ask、「世界书导入对话框」设为开启，确保弹窗出现；结束后恢复原设置（除非 `--keep-dialog-settings`）。
- 同名卡已存在时，酒馆走「替换」流程，工具通过导入提示确认成功。
- 安全闸：检测到的新角色卡名必须与源卡一致，否则继续等待并最终中止，防止把流程误跑到并行操作产生的其他卡上（真实事故教训）。
- 依赖 `核心/tavern-session.mjs` 的连接逻辑；需要酒馆正在运行（默认 `http://127.0.0.1:8000`）。
