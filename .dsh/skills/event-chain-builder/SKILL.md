---
name: event-chain-builder
description: "为《诡异药剂师》这类 MVU Zod SillyTavern 角色卡新增/维护事件锚点与常驻事件链，并把长篇原文按阶段改编为事件、概念和总结。使用场景：用户要求添加新事件（E0X）、扩展剧情版本、按原文续写世界书、修改事件衔接/预兆/收尾逻辑、同步常驻衔接段、事件详情窗口、状态栏推进按钮、事件蓝灯或验证器断言。触发词：事件链条、事件锚点、下一事件引入、原文分包、概念词条、总结同步、常驻衔接、收尾标记、上下文窗口、详情窗口、推进按钮、E0X、蓝灯词条。"
---

# Event Chain Builder

## 职责

维护“常驻注入 + MVU 状态门控”的事件链机制：新增事件、修改衔接、同步全链路文件，并保证 `npm run check` 全绿。

## 前置

先读目标版本目录的 `AGENTS.md` 与 `创作规划.yaml`；不改旧版本目录与产物；不手改 `dist/`。

## 新增事件（E13 示例）

1. 运行脚手架生成事件文件与同步片段：

```powershell
node scripts/add-event.mjs <版本目录> E13 <事件标题> --dry-run
```

先 `--dry-run` 预览，确认后去掉该参数正式生成。

2. 按 `references/add-event-workflow.md` 执行九步：
   填事件内容 → 同步 mainline.md（ctx 数组 + 两段桥接 EJS）→ status.html（BRIDGE_PAIRS）→ schema.js（anchorTitles）→ initial_variables.json + 重建 first_message.md initvar → worldbook.json 蓝灯注册 → validate.mjs（bridgePairs、循环范围、E12 边界断言）→ `npm run check` → 同步 README/AGENTS/host_acceptance 基线。

3. 按 workflow 文档末尾的真机验收清单核对。

## 按长篇原文扩展一个版本

先读 `references/long-source-version-workflow.md`。这类任务不能从目录、章节标题或旧提纲直接批量生成：先冻结总结与原文边界，再分包逐段精读；事件全部通过交叉复核后，才编写概念与三层总结，最后克隆旧版源码并集成。若用户明确要求子代理分包，主代理必须保留边界台账、冲突裁决和最终全链校验责任。

## 修改既有事件或机制

- 只改事件内容：编辑 `src/events/E0X_*.md` 对应字段，保持 EJS 门槛结构与完整分支标题。
- 改衔接/门控：先读 `references/mechanism.md` 的门控条件与规则落点，再同步 mainline.md / system.md / mvu_update_rules.md / status.html / validate.mjs。
- 任何改动后必须 `npm run check`，并同步基线。

## 资源

- `references/mechanism.md`：机制规范（状态模型、常驻条目、桥段门控、详情窗口、按钮、规则与验证落点）。
- `references/add-event-workflow.md`：新增事件九步流程与真机验收清单。
- `references/long-source-version-workflow.md`：长篇原文的阶段冻结、事件分包、概念补全、总结同步与版本集成流程。
- `scripts/add-event.mjs`：脚手架，生成事件文件并输出全链路同步片段，支持 `--dry-run`。

## 关键约束

- 事件蓝灯：未触发只显示占位；完整分支必须含标题（验证器断言标题 ≥2 次）。
- 收束条件：每个事件必须写「完成条件/变形条件/取消条件」，收束判定以事件自身条件为准，中途事实不得计为完成。
- 桥段门控：前件 ∈ {完成, 变形, 取消} 或 (活跃 && 收尾=true)；后件 ∈ {未触发, 预兆}。
- 所有世界书条目必须开启 `exclude_recursion` 与 `prevent_recursion`。
- 事件详情窗口由 `tools/build.mjs` 自动并入常驻条目，勿手改生成段。
- 新增字段必须沿 MVU 整链同步：initial_variables → schema → 更新规则 → 输出格式 → status.html → contract → validate。
