# DSH 子代理配置说明（tavern-cards README 第 3 步适配）

按 `00-Shared/tavern-cards/README.md`「安装 → 3. 配置子代理」的要求，把 tavern-cards 的三个子代理
注册到本机 DeepSeek Harness（DSH）。

## 适配方式

DSH 没有 Claude Code 那种 `agents/` 目录（`~/.claude/agents/*.md` 按名调用的机制）。
DSH 的等价机制是：**具名子代理工具 = `@deepseek-ai/dsh-tool-subagent` 实例**：

- 每个实例绑定一个 `toolName`（即子代理的调用名）和一个固定 `persona`（子代理的人设提示词）；
- `provider: spawn` = 独立上下文的子代理（不继承主对话，符合 check-agent「独立检查上下文」的要求）；
- `backgroundMode: one-shot` = 默认前台调用、返回子代理结果。

## 已注册的子代理

| 工具名 | 对应源文件 | 用途 |
|---|---|---|
| `check-agent` | `tavern-cards/agents/check-agent.md` | 禁词扫描（审稿师） |
| `conversion-agent` | `tavern-cards/agents/conversion-agent.md` | 长文本大纲提取（录事） |
| `first-message-agent` | `tavern-cards/agents/first-message-agent.md` | 叙事式开场白创作 |

persona 内容即各 `agents/*.md` 的正文（去掉 YAML frontmatter），并追加了「本机路径锚点」段，
把正文中「相对于 tavern-cards skill 目录」的相对路径（`references/*.md` 等）锚定到：

```
C:\Users\huang\Desktop\《诡异药剂师》同人角色卡制作计划\.dsh\skills\tavern-cards
```

该目录由项目根的 `sync-skills.ps1` 从 `00-Shared\tavern-cards` 镜像生成。
若项目整体迁移到别的路径，需要同步更新 patch 文件中三处「本机路径锚点」的绝对路径。

## 配置位置

- 配置文件：`C:\Users\huang\.dsh\cordis.patch.yml`（用户级 patch 层，对全部 profile 生效）
- 配置段：`# === tavern-cards 子代理 … ===` 注释块，位于 dsh-skin managed 块之后
- 生效机制：该文件被运行中的 DSH 进程 watch，保存后热加载；
  下次启动时也会在引导阶段重新应用（可用 `dsh --profile web --dump-config` 离线校验）

## 验证步骤（README 测试子代理，开一个新会话）

1. 测试 skill 加载：
   ```
   请根据 tavern-cards skill 列出你掌握的全部条目创作类型
   ```
2. 测试子代理：
   ```
   请 check-agent 检查以下内容："她非常善良，心湖泛起涟漪。"
   ```
   若返回按 `rules-check.md` 逐项扫描的检查结果（预计不通过，含主观评价/模糊意象命中），即配置成功。
3. 另两个子代理无需单独自测，在正式流程中按需触发：
   - 长文本转化：主代理按 `references/conversion/outline.md` 调用 `conversion-agent`；
   - 叙事式开场白：主代理按 `references/contents-creation/first-message.md` 调用 `first-message-agent`。

## 维护

- **更新人设**：直接改 `00-Shared\tavern-cards\tavern-cards\agents\*.md` 后，
  需要把改动同步到 `~/.dsh/cordis.patch.yml` 对应 persona（两处不会自动同步）；
  记得重跑 `sync-skills.ps1` 刷新 `.dsh\skills` 镜像。
- **卸载**：删除 patch 文件中 `tavern-cards 子代理` 注释块即可，无需重启（热卸载）。
- **Claude Code / Codex 用户**：本项目另有 `.claude\skills`、`.codexbridge\skills` 镜像；
  如需在这些工具中使用同名子代理，按其各自 agents 目录规则配置（`~/.claude/agents/*.md` 等），
  本次配置仅覆盖 DSH。
