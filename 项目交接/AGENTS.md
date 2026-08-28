# Repository Guidelines

《诡异药剂师》同人角色卡制作计划：SillyTavern MVU Zod 角色卡分版本工程。本文档是仓库级贡献者指南；各版本目录内的 `AGENTS.md` 是该版本专属的 AI 接手指南，优先级更高。

## 驾驶员同步（每次会话/任务先对齐）

- **开工前三格**：先对齐「目标 / 红线 / 验收」；然后用三句话复述（目标是 X / 红线是 Y / 验收是 Z），等驾驶员逐句确认，**对上了才动手**；任何一格含糊先补齐。
- **会话开始**：先读 `项目备忘.md` 顶部「交接摘要」+ 当前版本 `AGENTS.md` / `创作规划.yaml`，开工前先复述现状（我们在哪 / 上次做到哪 / 这次做什么）。
- **进行中（大活）**：开跑前拆成可验收小块（完工标准任务开始时定）；每完成一块在 `项目备忘.md` 记一笔或口头报一句；中途偏航回到三格重新对齐。
- **进度只写一份**：`项目备忘.md`；会话结束前把「交接摘要」更新为：本次目标 / 完成了什么 / 遗留什么 / 下一步从哪继续。没写进文件的等于没发生。
- **完工不自封**：先给证据（`npm run check` 输出、真机记录），列出「验收对齐项」清单（做了什么 / 怎么验证 / 哪些还没验），等驾驶员逐项确认。离线通过 ≠ 真机交付。
- **小块存版本**：每个可验收的小块完成存一次 git，附一句人话说明。

> 权威模型与检查单见 `00-Shared/SillyTavern参考资料/ST开发指南DB/A1_驾驶员同步检查.md`；本文件只保留必读摘要。

## Project Structure

- `诡异药剂师_MVU_v0.1/`（已废弃，MVU坏了）、`v0.2/`、`v0.3/`、`v0.3.1/`、`v0.3.2/`、`v0.3.3.1/`、`v0.4/`（当前最新）：各版本完整工程（目录名带 `诡异药剂师_MVU_` 前缀与括号备注，此处为简写）。旧版本目录与产物必须保持不变。
- `角色卡设定/`：小说总结、人设档案与世界观材料（含全局版角色档案）。
- `00-Shared/SillyTavern参考资料/`：SillyTavern 参考资料（`ST开发指南DB/` 文档 + `TavernWeave技能/` 参考副本）。
- `Handoffs/`：跨会话交接材料。

每个版本的标准布局：`src/`（维护源码：prompts / characters / events / factions / mechanisms / locations / scripts / ui）、`tools/`（build.mjs、validate.mjs）、`dist/`（生成产物，勿手改）、`manifest.json`、`contract.json`、`profile.json`、`创作规划.yaml`、`README.md`、`AGENTS.md`。

## Build & Test

先进入目标版本目录再运行：

- `npm run check`：构建 + 离线验证（推荐入口）。
- `npm run build`：从 `src/` 生成 `dist/诡异药剂师_vX.json`。
- `npm run validate`：仅运行离线验证（当前 v0.4 为 2400 项）。

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

- Git 历史目前共 3 条（`Initial commit` / `feat: 初始化项目仓库（v0.1-v0.32 全部版本与素材）` / `feat: publish SillyTavern AI bridge tool`），工作区仍有大量未提交改动；建议按功能拆分语义化提交，如 `feat(v0.4): ...`。
- 提交前确保 `npm run check` 全绿且基线哈希已同步。
- 无远程 PR 流程时可仅本地提交；若开 PR，描述改动范围、附 `check` 输出与产物哈希变化，并说明是否影响真实宿主验收。

## Agent-Specific Instructions

- 每个版本目录内的 `AGENTS.md` 定义该版本的权威顺序（用户要求 > `创作规划.yaml` > `contract.json` > `manifest.json` > `src/`）与安全边界。
- 修改任何内容前，先读目标版本的 `AGENTS.md` 与 `创作规划.yaml`。
