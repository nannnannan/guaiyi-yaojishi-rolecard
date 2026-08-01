# Repository Guidelines

《诡异药剂师》同人角色卡制作计划：SillyTavern MVU Zod 角色卡分版本工程。本文档是仓库级贡献者指南；各版本目录内的 `AGENTS.md` 是该版本专属的 AI 接手指南，优先级更高。

## Project Structure

- `诡异药剂师_MVU_v0.1/`（已废弃）、`v0.2/`、`v0.3/`、`v0.31/`、`v0.32/`（当前最新）：各版本完整工程。旧版本目录与产物必须保持不变。
- `角色卡设定/`：小说总结、人设档案与世界观材料（含全局版角色档案）。
- `00-Shared/ST开发指南DB/`：SillyTavern 开发参考资料。
- `Handoffs/`：跨会话交接材料。

每个版本的标准布局：`src/`（维护源码：prompts / characters / events / factions / mechanisms / locations / scripts / ui）、`tools/`（build.mjs、validate.mjs）、`dist/`（生成产物，勿手改）、`manifest.json`、`contract.json`、`profile.json`、`创作规划.yaml`、`README.md`、`AGENTS.md`。

## Build & Test

先进入目标版本目录再运行：

- `npm run check`：构建 + 离线验证（推荐入口）。
- `npm run build`：从 `src/` 生成 `dist/诡异药剂师_vX.json`。
- `npm run validate`：仅运行离线验证（当前 v0.32 为 1938 项）。

任何源码改动后必须跑 `check`，并同步 `host_acceptance.json`、`README.md`、`AGENTS.md` 中的产物大小与 SHA-256 基线。

## Coding Style

- 简体中文；世界书条目使用 YAML 中文格式；2 空格缩进。
- 每条世界书必须开启 `extensions.exclude_recursion` 与 `extensions.prevent_recursion`。
- 角色条目按事件状态用 EJS 条件分段，例如 `<%_ if (getvar("stat_data.事件.锚点状态.E07.状态", { defaults: "未触发" }) === "完成") { _%>`。
- 不直接编辑 `dist/`；修改 `src/` 后重建。
- 开场白正文必须与 `src/prompts/opening_source.txt` 逐字一致（v0.32 起，验证器做归一化比对）。

## Testing Guidelines

- 离线验证集中在 `tools/validate.mjs`：版本镜像、八人六组件、事件链与引入段、MVU 整链、防递归开关、开场白原文比对、锚点优先规则。
- 新增或修改功能时，必须在 `validate.mjs` 中补充对应的 `ok()` 断言。
- 真实宿主验收：用户在 SillyTavern 测试通过后，将 `host_acceptance.json` 状态从 `candidate` 更新为 `accepted-release`。

## Commit & PR

- Git 历史目前仅一条 "Initial commit"；建议按功能拆分语义化提交，如 `feat(v0.32): add event bridge segments`。
- 提交前确保 `npm run check` 全绿且基线哈希已同步。
- 无远程 PR 流程时可仅本地提交；若开 PR，描述改动范围、附 `check` 输出与产物哈希变化，并说明是否影响真实宿主验收。

## Agent-Specific Instructions

- 每个版本目录内的 `AGENTS.md` 定义该版本的权威顺序（用户要求 > `创作规划.yaml` > `contract.json` > `manifest.json` > `src/`）与安全边界。
- 修改任何内容前，先读目标版本的 `AGENTS.md` 与 `创作规划.yaml`。
