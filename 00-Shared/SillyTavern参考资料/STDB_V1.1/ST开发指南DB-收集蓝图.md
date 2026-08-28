# ST 指南数据库 · 收集蓝图

> 生成 2026-06-27 · 侦察 Workflow（13 agent / 约 70 万 token / 11 领域并行）。
> 质量门：精选可信源 · 全主题平铺。本文件 = 正式收集阶段的范围依据，待用户拍板增删。
> 注：本库为通用 ST 开发参考（不冠「星月」），通用避坑手册 + 范式库合一。

---
# SillyTavern 收集蓝图

## 概览

11 个领域侦察完成，识别出 **约 70 个独立源**（含跨领域重复），去重合并后约 **45 个实体源**。正式收集规模估算：**deep-read 约 18 个，登记备查约 27 个**。

---

## 一、跨领域源归并表

| 源实体 | 覆盖领域 | 可信度 |
|---|---|---|
| SillyTavern 主仓库 (SillyTavern/SillyTavern) | ST核心机制、世界书、正则、扩展生态、角色卡工程 | high |
| ST 官方文档站 (docs.sillytavern.app) | ST核心机制、世界书、MVU变量、正则、EJS、STScript、扩展生态 | high |
| SillyTavern-Docs 仓库 | ST核心机制、正则 | high |
| JS-Slash-Runner (N0VI028) | 酒馆助手、MVU、UI/HUD、扩展生态、角色卡工程 | high |
| 酒馆助手文档站 | 酒馆助手、MVU、UI/HUD、扩展生态、角色卡工程 | high |
| MagVarUpdate (MagicalAstrogy) | MVU本体、变量更新规则 | high |
| ST-Prompt-Template (zonde306) | EJS、变量更新规则、角色卡工程 | high |
| SillyTavern-LALib (LenAnderson) | 正则、STScript、扩展生态、世界书、变量 | high |
| DeepWiki: SillyTavern/SillyTavern | ST核心机制、世界书、正则、扩展 | medium |
| KritBlade/MVU_Game_Maker | MVU、变量更新规则、角色卡工程 | medium |
| KritBlade/MVU_Zod_StatusMenuBuilder | MVU、变量更新规则、UI/HUD、角色卡工程 | medium |
| GuidedGenerations-Extension (Samueras) | STScript、角色卡工程、扩展生态 | high |
| SillyTavern-MemoryBooks (aikohanasaki) | 世界书 | medium |
| SillyTavern-WorldInfoInfo (aikohanasaki) | 世界书 | medium |
| SillyTavern-LorebookOrdering | 世界书 | medium |
| RT15548/LittleWhiteBox | UI/HUD、MVU、角色卡工程 | high |
| Anastasia2372/sillytavern-cardforge | UI/HUD、变量更新规则、角色卡工程 | high |
| GitHub Issue #3844 (class前缀) | ST核心机制、UI/HUD | high |
| GitHub Issue #3996 (Showdown/DOMPurify) | ST核心机制、UI/HUD | high |
| uuuiiiiooo/mvu-sillytavern-extension | MVU、UI/HUD、角色卡工程 | medium |
| SillyTavern-Content (官方注册表) | 扩展生态 | high |
| Samueras/Guided-Generations | STScript、角色卡工程 | medium |
| World Info Encyclopedia (rentry.co) | 世界书 | high（内容有时效限制） |
| rentry.org/stscript | STScript | medium |
| DeepWiki: ST World Info 6.1 | 世界书 | high（基于源码） |
| SillyTavern 中文 wiki (sillytavern.wiki) | 世界书、正则 | high（翻译源） |
| exported.mvu.d.ts | MVU、酒馆助手 | high |
| JS-Slash-Runner event.d.ts | 酒馆助手 | high |

---

## 二、可信度分级

### high — 可直接信

- SillyTavern 主仓库源码（最终真相，任何分歧以此为准）
- docs.sillytavern.app 全站官方文档（含 regex/、reasoning/、extensions/、macros/、worldinfo/、st-script/ 各专题页）
- SillyTavern-Docs GitHub 仓库（可溯源 git blame）
- JS-Slash-Runner 主仓库 + 官方文档站 + @types/ TypeScript 定义文件
- MagVarUpdate 主仓库（MVU 原始实现，所有下游的上游）
- ST-Prompt-Template (zonde306) 主仓库 + reference.md + features.md
- SillyTavern-LALib（LenAnderson，已入官方注册表）
- GuidedGenerations-Extension（已入官方注册表）
- RT15548/LittleWhiteBox（191★，活跃，v3.0.0 2026-06）
- sillytavern-cardforge（130★，活跃，v7.6.0 2026-05）
- GitHub Issue #3844、#3996（官方 issue tracker，机制证据）
- KritBlade/MVU_Game_Maker（2026-06 活跃，技术栈与星月高度重叠）
- World Info Encyclopedia (rentry.co)（官方 Further Reading 推荐，内容有时效限制见下方风险节）
- SillyTavern-Content 官方注册表（机器可读真相源）
- DeepWiki ST World Info 6.1（基于明确源码 commit，架构细节可信）

### medium — 建议交叉验证

- DeepWiki SillyTavern/SillyTavern 通用章节（AI 生成，部分有幻觉风险）
- DeepWiki zonde306/ST-Prompt-Template（架构概览可用，细节需核对源码）
- KritBlade/MVU_Zod_StatusMenuBuilder（14★，文档简略）
- Samueras/Guided-Generations（2025-03 最后更新，部分 LALib 依赖需版本确认）
- SillyTavern-MemoryBooks、WorldInfoInfo、LorebookOrdering（功能专一，star 偏低）
- uuuiiiiooo/mvu-sillytavern-extension（架构参考价值高，生产依赖不推荐）
- sillytavern.wiki 中文 wiki（翻译版，核心内容与官方一致但需交叉确认新特性）
- Context7 (Tavern Helper 索引)（爬取可能滞后）
- SillyTavern-WorldInfo-Recommender（120★，功能依赖 LLM 质量）
- rentry.org/stscript（部分章节已过期，需甄别）
- HuggingFace Lorebook as Active Tool（创意价值高，时效不明）
- DeepWiki QR System 7.2、Slash Command 7.1（源码自动生成，架构细节有引用行号，但无人工审核）
- card.zmer.top V4 卡片构建器（无公开仓库，无法审计代码）
- Megumin-Suite（CC BY-NC-ND 4.0，记忆系统与 MVU 集成深度未验证）
- ContextQMD ST 1.17.0 正则编辑器（第三方镜像，版本锁 1.17.0）

### low — 必须对抗验证或仅作线索

- endege/JS-Slash-Runner 英文翻译 fork（严重滞后 v4.x 以前，仅入门线索）
- smAI42/mvu-sillytavern-extension（4★，与 uuuiiiiooo fork 并存，维护状态不明）
- Min3Mast3r4653 Regex.md（样本量极小，单人维护，仅作两个用例范例参考）
- JS-Slash-Runner GitLab 镜像（内容一致但可能有轻微延迟，访问备用而非技术参考）
- SillyTavern-Extras（2024-04 归档，仅用于了解历史背景）
- X00LA Extensions Gist（链接目录，无技术内容）
- 艾萝工坊中文教程站（社区导航，技术细节需交叉验证）

---

## 三、重点两大薄弱点专节

### 3A. 世界书优化（World Info / Lorebook）

**核心问题**：世界书激活规则、token 预算工程化、递归扫描深度控制，是本工作区当前已知断裂链路的重灾区（B19 向导写入、世界书条目格式等）。

| 优先级 | 源 | 深度建议 | 关键收益 |
|---|---|---|---|
| P0 | `docs.sillytavern.app/usage/core-concepts/worldinfo/` | **deep-read，提炼范式** | timed effects、inclusion groups、Outlet、Automation ID、vectorized 全特性官方定义 |
| P0 | `SillyTavern-Docs/Usage/worldinfo.md` (GitHub 原文) | **deep-read，git blame 追溯** | 精确确认各特性对应 ST 哪个版本引入 |
| P0 | `public/scripts/world-info.js` 源码（主仓库） | **deep-read 核心函数** | 激活排序算法（weight→order→uid）精确实现、inclusion groups tiebreak 逻辑、递归上限机制（文档缺失） |
| P1 | DeepWiki ST World Info 6.1 | **deep-read，辅助速查** | WorldInfoBuffer 三层架构、四种 selectiveLogic 快速定位 |
| P1 | World Info Encyclopedia (rentry.co) | **deep-read，但需与新版文档校准** | 递归扫描系统阐述仍是最清晰参考，timed effects/inclusion groups/vectorized 章节需用官方文档补充 |
| P1 | sillytavern.wiki 世界书页 | **deep-read（中文决策）** | inclusion groups 权重竞争机制有独到中文说明，Automation ID + sticky 骰子机制 |
| P2 | SillyTavern-WorldInfoInfo (`/wi-report`) | 登记备查，调试用 | 唯一可观察递归激活轮次的工具 |
| P2 | SillyTavern-LorebookOrdering | 登记备查 | lorebook 级别优先级控制（star 偏低，功能专一） |
| P2 | SillyTavern-MemoryBooks | 登记备查 | 自动写入 lorebook 条目的参考实现 |
| P2 | LALib `/wi-activate`、`/wi-trigger` | 登记备查（合并进 LALib deep-read） | STscript 驱动世界书精确触发 |
| P3 | HuggingFace Lorebook as Active Tool | 仅登记，对抗验证 | 骰子机制/行为控制器创意思路，时效不明 |
| P3 | 类脑宝宝教程 | 仅登记 | 中文案例参考，缺 inclusion groups/timed effects |

**特别注意**：`@@activate` 装饰器语法在所有源中均未找到明确记录，需直接读 `world-info.js` 源码确认是否存在，不能仅凭社区描述使用。

---

### 3B. 变量更新规则（MVU 变量命令语法 + UpdateVariable 格式 + Zod schema）

**核心问题**：MVU 的 `_.set/_.add/_.assign/_.remove` 命令语法、`[InitVar]` 世界书格式、变量冻结机制、Zod schema 注册三个层面（ST-Prompt-Template / TavernHelper / MVU）的区别——是星月 zod_schema.js 已坐实 bug 的根源领域，也是 B17/B19 等断裂链路的技术底层。

| 优先级 | 源 | 深度建议 | 关键收益 |
|---|---|---|---|
| P0 | `MagVarUpdate/doc/tutorial.md` | **deep-read，提炼范式代码** | UpdateVariable + Analysis + JSONPatch 完整结构、变量初始化 `[value, description]` 格式、五种命令语法 |
| P0 | `MagVarUpdate/doc/supplementary-tutorial.md` | **deep-read** | `$meta.extensible / required / recursiveExtensible` 冻结机制、`$__META_EXTENSIBLE__$` 解锁标记、strictSet 配置——这是防 LLM 违规增删字段的核心 |
| P0 | `exported.mvu.d.ts` (@types/iframe/) | **deep-read** | `MvuData`、`CommandInfo` 联合类型、五个生命周期事件精确签名——机器可读无歧义 |
| P0 | `event.d.ts` (@types/iframe/) | **deep-read** | 事件 API 函数签名、`ListenerType` 映射——`VARIABLE_UPDATE_ENDED` 状态栏刷新监听的精确写法 |
| P0 | 酒馆助手文档站（MVU 接口页） | **deep-read** | `getMvuData / replaceMvuData / parseMessage` 三件套、`registerVariableSchema` 用法、变量管理器调试 |
| P1 | `MagVarUpdate/doc/stat_var.md` + `template.md` | **deep-read** | `stat_data / display_data` 双层架构、`template` 自动合并、`VWD` 结构 |
| P1 | ST-Prompt-Template `reference.md` + `features.md` | **deep-read** | `patchVariables / jsonPatch`（EJS 路线的增量更新实现）、`setVariableSchema`、五级作用域——EJS 路线与 MVU 路线的边界对比必读 |
| P1 | KritBlade/MVU_Game_Maker | **deep-read 作为参考实现** | Zod schema + JSONPatch + 三层 stat 分层设计（Traits/Dispositions/Pulse）的真实生产级案例，技术栈与星月高度重叠 |
| P2 | STscript 官方文档（变量命令节） | 登记备查 | ST 原生变量层底层原语，理解 MVU 叠加层的必要背景 |
| P2 | JS-Slash-Runner CHANGELOG.md | 登记备查 | 追踪 `registerVariableSchema`（v4.3.7）、zod 内置（v3.3.2）等 API 引入版本 |
| P2 | card.zmer.top V4 构建器 | 仅登记（对抗验证） | `VARIABLE_UPDATE_ENDED` 状态栏事件触发点有说明，但无公开代码库 |
| P3 | KritBlade/MVU_Zod_StatusMenuBuilder | 登记备查 | 辅助工具，理解"schema 定义 → 可视化布局"流程 |
| P3 | mvu-sillytavern-extension (uuuiiiiooo) | 仅登记，架构参考 | MVU shim 层初始化机制（blob iframe → window.Mvu 暴露）有参考价值，不作生产依赖 |

**三层 Zod schema 注册 API 必须厘清的边界**：
- `setVariableSchema()`：ST-Prompt-Template 层，写入前拦截校验
- `registerVariableSchema()`：TavernHelper v4.3.7 引入，变量管理器 UI 联动
- `registerMvuSchema()`：MVU 核心引擎内置 TS 类型守卫，两套不同体系

---

## 四、优先级与深度建议汇总

### Deep-read（提炼范式代码，约 18 个源）

| 序号 | 源 | 原因 |
|---|---|---|
| 1 | ST 主仓库 `regex/engine.js` | `getRegexedString` 精确签名，`markdownOnly/promptOnly` 参数传入时机，星月多处正则依赖此 |
| 2 | ST 主仓库 `world-info.js` | 激活排序算法、递归上限、inclusion groups tiebreak，文档未覆盖的实现真相 |
| 3 | `docs.sillytavern.app/extensions/regex/` | 三路分发、ephemerality 三模式、Affects 六来源官方定义 |
| 4 | `docs.sillytavern.app/usage/core-concepts/worldinfo/` | 世界书全特性官方定义，timed effects/inclusion groups/outlet 必读 |
| 5 | `docs.sillytavern.app/for-contributors/writing-extensions/` | messageFormatter.addHook 三阶段、DOMPurify ADD_TAGS、custom-style 安全机制 |
| 6 | `docs.sillytavern.app/usage/prompts/reasoning/` | auto_parse 配置、reasoning 块正则 Affects 目标、隐式 reasoning 模型处理 |
| 7 | `MagVarUpdate/doc/tutorial.md` + `supplementary-tutorial.md` | MVU 命令语法完整范式、冻结机制（无其他可替代源） |
| 8 | `exported.mvu.d.ts` + `event.d.ts` | 机器可读无歧义类型定义，直接作为接口文档使用 |
| 9 | 酒馆助手文档站 MVU 接口页 | getMvuData 三件套 + registerVariableSchema 中文官方说明 |
| 10 | ST-Prompt-Template `reference.md` + `features.md` | EJS 变量更新路线完整 API，与 MVU 路线边界对比 |
| 11 | ST 官方 `docs.sillytavern.app/usage/st-script/` | STscript 变量/注入/QR 事件体系，B19 世界书写入修复背景 |
| 12 | JS-Slash-Runner 主仓库 `@types/` 目录 | 全量 iframe API 类型定义，酒馆助手 generate/event/变量 API 无歧义参考 |
| 13 | Issue #3996 (Showdown/DOMPurify) | `<content>` 被吞根因证据，ADD_TAGS 解法，与 content-unwrap 卡内正则联动 |
| 14 | Issue #3844 (class 前缀) | custom-style 机制确认、class 冲突负面结论，data-属性规避根据 |
| 15 | KritBlade/MVU_Game_Maker | 真实生产级 MVU + Zod + JSONPatch 实现案例，直接对标星月技术栈 |
| 16 | World Info Encyclopedia (rentry.co) | 递归扫描系统阐述，注意 2023 年后新特性需补官方文档 |
| 17 | DeepWiki ST World Info 6.1 | WorldInfoBuffer 架构速查，比读源码效率更高 |
| 18 | SillyTavern-LALib 主仓库 | STscript 增强命令集（`/wi-activate`、`getat/setat`、列表操作），多领域复用 |

### 仅登记备查（约 27 个源）

DeepWiki 其他章节（宏/Prompt/扩展架构/QR/STscript）、SillyTavern-Content 官方注册表、CHANGELOG.md（版本追踪）、sillytavern.wiki 中文 wiki（决策时中文参考）、SillyTavern-MemoryBooks、WorldInfoInfo、LorebookOrdering、WorldInfo-Recommender、CardForge（工具链观察）、LittleWhiteBox（模块化架构参考）、GuidedGenerations（QR 实战）、Guided-Generations-Extension、mvu-sillytavern-extension（架构参考）、card.zmer.top（事件时序线索）、context7 聚合索引、Extension-TopInfoBar（官方 HUD 注入模式）、Extension-ScriptEvents（事件驱动自动化）、Extension-PromptInspector（调试工具）、SillyTavern-Larson（纯 CSS HUD 动画路线）、rentry.org/stscript（STscript 中高级教程，甄别过期章节）、DeepWiki QR 7.2 + STscript 7.1（架构细节备查）、SillyTavern-MoonlitEchoesTheme（消息样式 CSS 参考）、SillyTavern-CssSnippets（CSS 管理模式）、X00LA Gist（扩展发现目录）、SillyTavern-Extras（仅历史背景）。

---

## 五、风险标注

### 可靠来源稀缺的主题

| 主题 | 稀缺程度 | 现状 |
|---|---|---|
| `@@activate` 装饰器语法 | 极度稀缺 | 所有 11 个领域均未找到明确记录，可能是非官方/已废弃语法，必须读 `world-info.js` 源码确认 |
| inclusion groups tiebreak 算法（数量相同时的决胜逻辑） | 稀缺 | 任何中英文文档均未明确说明，需读源码 |
| MVU bundle 版本兼容矩阵 | 稀缺 | 无可靠对照表，CHANGELOG 无时间戳 |
| iframe 与 ST 宿主 postMessage 协议细节 | 稀缺 | 官方未公开，需读 JS-Slash-Runner 源码 |
| `document.write` 模式在 ST 中的官方限制说明 | 稀缺 | 完全无官方文档，仅有 issue/社区经验（NAV-BLOCK 问题、Blob URL 替代方案均为非官方发现） |
| 变量 schema migration（存档升级） | 稀缺 | MVU 文档未覆盖跨版本存档升级工作流 |
| SmartTheme CSS 变量完整枚举 | 稀缺 | DeepWiki 仅列 4 个，完整列表需读 `backgrounds.css` 源文件 |

### 各项目做法分歧大（需对抗验证，不能强行统一）

| 分歧点 | 具体分歧 | 处理建议 |
|---|---|---|
| 变量更新技术路线 | MVU + `_.set/_.add` 命令路线 vs EJS + `patchVariables/jsonPatch` 路线，哲学差异，不可直接混用 | 星月已选 MVU 路线，EJS 作为对照理解，不混用 |
| Zod schema 注册层 | ST-Prompt-Template 的 `setVariableSchema` vs TavernHelper 的 `registerVariableSchema` vs MVU 内置 TS 守卫，三套独立体系 | 必须明确当前使用哪一层，不能混淆 API 来源 |
| HUD iframe 技术方案 | blob iframe + `document.write`（状态栏围栏）vs JS-Slash-Runner 完整 iframe 沙箱 vs 纯 CSS HUD（无 iframe） | 三路各有适用场景，需按场景选择不强行统一 |
| 正则执行顺序（多作用域并存） | ST 1.14.0 起 Preset 先于 Scoped，1.14.0 之前相反；1.16.0 有 Preset 顺序修正 | 必须锁定 ST 版本确认，不同版本行为不一致 |
| 世界书插入位置的 attention 影响 | Before/After Char Defs、depth 精确定位、Outlet 宏注入各有显著 attention 差异，社区有经验性结论但无量化文档 | 需实测验证，不能从文档直接推断最优 |

### 已过时的源

| 源 | 过时程度 |
|---|---|
| SillyTavern-Extras | 2024-04 正式归档停服，所有功能已迁移到内置扩展，**不得用于新开发参考** |
| World Info Encyclopedia (rentry.co) | 2023-10 内容，timed effects、vectorized entries、inclusion groups、Automation ID 均未覆盖，使用前必须与新版文档校准 |
| endege/JS-Slash-Runner 英文翻译 fork | v4.x 以前，`auto_update=false`，功能代码不跟进主库，**技术细节完全不可信** |
| rentry.org/stscript | 部分章节明确标注 2024-06 过期，STscript 此后有较大迭代 |
| ContextQMD ST 1.17.0 正则编辑器 | 锁定 1.17.0，1.18.0 新增功能未覆盖 |

### 开源许可风险

| 源 | 许可证 | 风险点 |
|---|---|---|
| JS-Slash-Runner | Aladdin Free Public License | **限商用**，任何商业化工坊场景需注意 |
| ST-Prompt-Template | AGPL-3.0 | 网络分发须开源修改版本 |
| sillytavern-cardforge | GPL-3.0 | Copyleft 传染性 |
| LittleWhiteBox | GPL/自定义（需确认） | 需进一步核实 |
| Megumin-Suite | CC BY-NC-ND 4.0 | **不可商业改编，不可创作衍生**，作为预设参考可以，作为代码基础有限制 |

---

## 六、正式收集规模估算

| 类型 | 数量 | 时间估算 |
|---|---|---|
| Deep-read + 提炼范式代码 | 18 个源 | 每个 ~20-40 分钟，总计约 6-10 小时 |
| 仅登记链接备查 | 27 个源 | 每个 ~5 分钟，总计约 2-3 小时 |
| 源码直读（弥补文档空白） | 4 个文件（`world-info.js`、`engine.js`、`backgrounds.css`、JS-Slash-Runner postMessage 实现） | 按需深读，不定时 |
| **总计** | **约 45 个实体源** | **预计 8-13 小时** |

**建议收集顺序**：先完成世界书优化（P0 的 `worldinfo/` + `world-info.js` + DeepWiki 6.1）和变量更新规则（P0 的 `tutorial.md` + `supplementary-tutorial.md` + `exported.mvu.d.ts`）两个重点薄弱点，再顺延正则机制（`engine.js` + 正则专题页）、渲染管线（Issue #3844 + #3996）、EJS 路线（ST-Prompt-Template reference.md），最后处理登记类源。

---

# 附录 A · 查漏与补充建议（completeness critic）

以下是遗漏与补充建议清单：

---

## 遗漏与补充建议

### 一、ST 官方机制盲区

**1. STScript Slash 命令完整实现**
蓝图收录了 rentry.org/stscript 和 DeepWiki 7.1，但没有覆盖 **ST 主仓库 `public/scripts/slash-commands/` 目录**（SlashCommandParser、SlashCommandClosure、pipe 传值机制）。`/setvar`/`/getvar`/`/flushvar` 与 MVU 变量层叠加的精确行为必须读源码，文档全部严重滞后。建议：补 deep-read `slash-commands/SlashCommandParser.js`。

**2. Chat Completion 消息构建管线**
蓝图完全没有覆盖 `public/scripts/openai.js` 或等效的 `chat-completion.js`——这是世界书条目最终注入 prompt 的实际发生地（`world-info.js` 激活的条目在这里按 depth/role 插入）。世界书 depth 参数的精确行为（depth 0 = system 末尾 vs depth 1 = 倒数第一条 human 前）是高频踩坑点，无此源则无法可靠断言插入位置。建议：补 deep-read `openai.js` 中 `world_info_depth` 相关段落。

**3. Reasoning / thinking 块的消息存储格式**
蓝图有 `docs/reasoning/` 页，但没有覆盖 **reasoning 块在 `chat.jsonl` 里的实际存储结构**（`extra.reasoning` 字段）以及 ST 如何在历史消息重放时处理 reasoning——这直接影响正则 Affects 目标中 reasoning 块的行为（星月 2.9.8 已坐实此坑）。建议：补 `public/scripts/chat.js` 中 `extractMessageFromData` / `addOneMessage` 对 reasoning 字段的处理。

**4. Extension 生命周期 / 加载顺序**
蓝图的"扩展生态"节没有覆盖 **`public/scripts/extensions.js` 中 extension 加载顺序与初始化时序**——JS-Slash-Runner、LALib、CardForge 均依赖此时序，`window.SillyTavern` 和 `window.tavern_helper` 的挂载时机是扩展互调的前提。建议：补 deep-read `extensions.js` 中 `loadExtension` 和 `runGenerationInterceptors` 两段。

---

### 二、世界书专节补充

**5. `@@activate` 装饰器与 Automation ID 可靠来源**
蓝图已标注"极度稀缺"，但没有给出明确的补充路径。**ST 主仓库 `CHANGELOG.md`** 对 Automation ID 引入版本有明确记录（1.11.x 区间），且 `world-info.js` 中 `checkWIEntriesForAutomatic` 函数是唯一可靠实现。`@@activate` 在源码里对应的是 `triggerWIKeywords` 还是完全不存在，必须靠 `git log -S "@@activate"` 确认。建议：补"ST 主仓库 `git log` + `world-info.js` `@@activate` 关键词源码确认"这一步骤为优先级 P0 研究动作。

**6. Vector Storage 与世界书的集成**
蓝图完全没有提 **ST 内置的 Vector Storage 扩展**（`public/scripts/extensions/vectors/`）以及世界书 `vectorized` 字段的实际工作路径（语义相似度搜索替代关键词匹配）。对于需要大量条目的知识库型世界书场景，这是重要的优化手段，且与 token 预算工程深度耦合。建议：补 `extensions/vectors/index.js` 和官方文档 `extensions/vector-storage/` 页为登记备查。

---

### 三、变量更新规则专节补充

**7. TavernHelper `registerVariableSchema` 的 Zod 版本锁定问题**
蓝图提到 v4.3.7 引入 `registerVariableSchema`，但没有覆盖 **JS-Slash-Runner 内置的 Zod 版本**（v3.3.2 引入，具体 Zod semver 版本）与用户卡内自带 Zod 的冲突问题。星月已有 `zod_schema.js` 且 `window.__xingyueMvuSchema` 已暴露——如果 TavernHelper 内置 Zod 与卡内 Zod 版本不同，`instanceof` 检查会静默失败。建议：补 JS-Slash-Runner `package.json` 中 Zod 版本声明为 P0 确认项，这是星月 bug 修复的直接相关信息。

**8. MVU `$meta` 冻结机制的 schema migration 路径**
蓝图"可靠来源稀缺"节已标注此问题，但没有给出任何探索路径。**MagVarUpdate issues 和 releases** 有时包含跨版本 schema 升级的实战讨论（即使无正式文档）。建议：补 MagVarUpdate GitHub Issues（关键词 `migration`/`upgrade`/`schema`）为 P2 搜索任务。

---

### 四、渲染管线盲区

**9. Showdown 扩展注册机制**
蓝图有 Issue #3996（DOMPurify/Showdown），但没有覆盖 **ST 如何向 Showdown 注册自定义扩展**（`public/scripts/showdown-extensions.js`）以及扩展执行顺序——这直接影响"卡内正则 unwrap `<content>` 是否在 Showdown 渲染前生效"的判断。建议：补 `showdown-extensions.js` 为 deep-read。

**10. `getMessageFromTemplate` / `messageFormatting` 完整调用链**
Issue #3844 和 #3996 只是两个截面证据，但没有一个源覆盖**完整的消息渲染调用链**：`formatMessageFromTemplate → addCopyToCodeBlocks → messageFormatting → applyRegexes → renderMessageContent`。这个链路是正则 `markdownOnly`/`promptOnly` 参数时机、reasoning 块处理、DOMPurify 消毒顺序的唯一可靠来源。建议：补 `public/scripts/messageHandling.js`（或等效文件）作为 deep-read 来源，提炼完整调用链图。

---

### 五、中文社区资源

**11. 类脑宝宝 / 莫名离别 系列教程**
蓝图仅有"类脑宝宝教程 仅登记"一行，没有具体 URL 或内容标注。中文社区中**BiliBili 上的 ST 系列视频**（特别是世界书实战向、正则调试向）是实际踩坑经验的重要来源，可信度 medium 但覆盖"文档写了但实测行为不一致"的场景。建议：明确补充 BiliBili 搜索词 `SillyTavern 世界书` / `酒馆助手 MVU` 作为发现渠道，列入 low 级登记。

**12. ST 官方 Discord `#development` 频道存档**
蓝图完全没有提 **ST 官方 Discord**。很多机制（尤其是 `document.write` NAV-BLOCK、`inclusion groups` tiebreak、`@@activate` 语法来源）首次出现在 Discord 讨论而非文档或 issue。Discord 没有公开索引，但 ST 官方 Discord 的 `#announcements` 和 `#development` 频道是新特性首次说明的地方。建议：补 ST 官方 Discord 邀请链接为发现渠道，标注为 low 级（无法系统检索，仅作线索）。

---

### 六、可信度误判

**13. `sillytavern.wiki` 可信度应降级**
蓝图将其列为 high（注："翻译源"）。但中文 wiki 的更新频率远落后于官方文档，且 2025 年后的新特性（timed effects、inclusion groups、Automation ID、reasoning）均无翻译。将其标为 high 会误导使用者在新特性上信任中文 wiki 而非官方文档。建议：降为 medium，并注明"新特性覆盖滞后约 6-12 个月，需与官方文档校准"。

**14. `card.zmer.top V4` 可信度标注缺失关键风险**
蓝图仅标注"无公开仓库，无法审计代码"，但没有提到更关键的风险：**该站点是否仍在运营、作者是否持续维护**。V4 构建器若停止维护，其对 `VARIABLE_UPDATE_ENDED` 时序的说明可能对应旧版 JS-Slash-Runner 行为。建议：补充标注"需确认最后更新时间和对应 TavernHelper 版本"。
---

# 附录 B · 主控合并建议与正式收集范围草案（待你拍板）

## B1. 对 critic 14 条的裁决

必并入正式收集 P0（直接关系星月已坐实 bug / 核心机制真相）：
- #2 openai.js 世界书 depth 注入管线 —— 世界书最终按 depth/role 插入 prompt 的真相发生地，高频踩坑点
- #7 registerVariableSchema 内置 Zod 版本锁定 —— 直接是 zod_schema.js / window 暴露 schema 的 instanceof 静默失败潜在根源
- #10 完整消息渲染调用链（messageFormatting → applyRegexes → DOMPurify）—— 正则 markdownOnly/promptOnly 时机、reasoning、消毒顺序的唯一可靠

并入 P1：
- #1 slash-commands 源码（/setvar 与 MVU 变量层叠加的精确行为）
- #9 Showdown 扩展注册（content-unwrap 卡内正则是否在 Showdown 渲染前生效）
- #5 @@activate 用 git log -S 直接源码确认（世界书 P0 动作，社区无明确记录）

登记备查 / 发现渠道：
- #3 reasoning 块存储格式、#4 extension 加载时序、#6 Vector Storage 集成、#8 MVU schema migration issues、#11 BiliBili 教程、#12 ST 官方 Discord 开发频道

直接采纳的可信度修正：
- #13 sillytavern.wiki：high → medium（新特性滞后 6–12 月，需与官方文档校准）
- #14 card.zmer.top：补标「需确认最后更新时间 + 对应 TavernHelper 版本」

## B2. 正式收集范围草案
- Deep-read 提炼范式 ≈ 蓝图 18 + critic 并入 6 = 约 24 个源
- 登记备查 ≈ 27 + 若干发现渠道
- 源码直读 4 个文件：world-info.js / regex/engine.js / openai.js / messageFormatting

## B3. 批次建议（E16：别一次整吞）
分两批：
- 第一批 = 两个薄弱点的 P0（世界书 + 变量更新规则，约 10 个 deep-read + @@activate 源码确认 + Zod 版本核实）→ 产出这两块指南库 → 你验证格式与质量
- 第二批 = 正则 / 渲染管线 / EJS / STScript / UI 美化 + 其余登记
理由：先把最痛、最直接关系已坐实 bug 的两块做出来验证质量，再铺开，避免一次吞 8–13 小时规模。

## B4. 库形态（按已定）
- 通用避坑手册（别这么做）+ 范式库（该这么做）合一，按主题并排
- 每条目四件套：来源 URL / 适用 ST 版本 / 收集日期 / 置信度
- 做法分歧不强行统一（标注两派，如 MVU vs EJS 变量路线）

---

# 附录 C · 2026-07-14 五项专题增补

> 本节是对 2026-06-27 原蓝图的追加档案。原蓝图的“约 45 个实体源 / 22 册产出”等历史统计保持原样，不倒改为当前数字。

## C1. 增补主题

| 新手册 | 解决的缺口 | 与既有手册的边界 |
|---|---|---|
| `C4_数据库表格模板.md` | 持续演进的 SP·数据库 / 神·数据库表格定义、AI 填表、双存储模式、提示词变量、前端 API 与持久化 | 与 B1 的 MVU/JSONPatch 路线并列；用已核快照记录精确实现，不把某一插件标签写成永久基线 |
| `C5_同层前端.md` | 在首楼 / 0 号消息楼层闭合输入、生成、剧情阅读、状态、路由与回看等完整游玩主链 | 建立在 C1 的消息楼层 iframe/API 上；不是开局页或挂载容器，真实聊天楼层仍可在后台承担上下文和存档 |
| `C6_独立前端.md` | 把某一张角色卡直接产品化为 Web / App / PC 程序，设定、玩法、提示词、数据和资产全部内建 | 程序本身就是角色卡，不依赖 ST，也不再提供“导入角色卡封装体”的通用客户端模型 |
| `C7_数据库二创前端.md` | 在正常多楼层角色卡中，把 SP·数据库状态映射为“数据库版 MVU 状态栏 / 控制中心”式二创 UI | 不替代、隐藏或镜像剧情楼层；数据库在正常 AI 回复后填表，UI 只负责状态呈现与受控编辑 |
| `C8_数据库兼容同层前端-待验证.md` | 研究额外消息/楼层桥能否补齐数据库缺少的同层剧情、选项、路由与楼层信息契约 | 待验证实验路线；默认不兼容 C5，完成真机矩阵和转正门前禁止生产引用 |

## C2. 本次回源

- C4：AlbusKen/shujuku 持续演进仓库；2026-07-14 已核历史 `spv5.5.6@2020b14...` 与当日 upstream `main@708e66...`，以最低能力契约 + 已核快照 + 实际安装版本能力检测代替永久固定基线；继续对照 `API_DOCUMENTATION.md`、`syntax-reference.md`、建表指南、V2 存储和源码 API 分组。
- C5：本地权威 API 四件套，重点是 `getChatMessages(0)`、`setChatMessages`、`createChatMessages`、`refreshOneMessage(0)`、`getCurrentMessageId()` 与消息事件；星月 3.4.9 的首楼短 mount + 远程开局页仅作局部生产样本。
- C6：以单张作品自身的角色设定、世界观、提示词、玩法变量、UI、媒体和发行需求为真相源；Character Card 规范只在“从旧卡迁移素材”时参考，RisuAI 一类多卡客户端只用于识别并排除通用导入器架构，不作为本册主体。
- C7：主链回源 `message-handler.ts` 与新消息触发流程：数据库在正常 AI 回复出现后再判断和填表；前端数据契约同时核对历史发布与 2026-07-14 upstream 观察快照。DC 社群存在大量数据库二创前端是总监提供的需求背景；公开样本不足时不虚构作品名。
- C8：总监裁定数据库默认不产出同层所需楼层信息；仅把“真实消息生成/楼层桥 + 数据库状态层 + 首楼渲染”的组合登记为待验证假设，事实来源仍分别回到 C5 消息 API 与 C4/C7 数据库 API。
- 既有 `A2/A3/A4/A5/A6/B1/C1/C2/C3` 用于标出角色卡格式、世界书、提示词、宏、正则、变量与前端能力中哪些属于 ST 专用、哪些可以移植。

## C3. 关键裁决

1. “数据库表格”专指持续演进的 SP·数据库 / 神·数据库：以 `sheet_*` 二维表、原生 DSL / SQLite 双模式、`<tableEdit>`、聊天持久化和宿主 `AutoCardUpdaterAPI` 组成的另一套变量方案；它与 MVU 并列，不从属 MVU。文档记录已核快照，不把某一插件标签固化成永久基线。
2. “同层前端”按完整应用架构定义：在首楼 / 0 号消息内闭合输入、生成、剧情阅读、状态、路由、回看等全部游玩体验；玩家始终停留在首楼完整应用中，内部可以继续嵌套路由、组件或受控子 iframe，真实聊天楼层也可继续生成并由首楼镜像和驱动。它不是开局页、挂载容器或“脚本把 DOM 挂到 ST 宿主页面”。
3. “独立前端”按产品边界定义：单张角色卡直接成为 Web / App / PC 程序，程序内建角色内容并负责提示词、世界知识、玩法状态、模型调用和存档；运行时不再解析或导入另一份角色卡封装体。它不是“ST 内独立 document”，也不是多卡客户端。
4. “数据库二创前端”按正常多楼层角色卡的状态 UI 定义：把 `sheet_*` 数据映射为状态栏、控制中心、人物、任务、背包等可交互视图；它对应“数据库版 MVU 状态栏 / 控制中心”的体验类比，但不替代正常剧情楼层，也不是另一套数据库协议。
5. C7 与 C5 默认不兼容：数据库依赖正常 AI 回复后填表，却不提供同层完整应用需要的剧情、选项、路由和楼层信息输出契约。额外兼容层只在 C8 登记为待验证路线；C8 通过完整真机转正门前，不得把数据库写成 C5 的成熟后端。C6 则是脱离 ST 的单作品完整运行时。

## C4. 当前规模

- 2026-06-28 整合后：22 个主题手册。
- 2026-07-14 新增：5 个主题手册，其中 C8 标记为待验证。
- 当前：27 个主题手册，另有 A0/A1 两份驾驶员检查单；继续平铺于 `ST开发指南DB/` 根目录。

> 以上是五项专题增补完成时的阶段统计；同日后续批次将规模更新为 32 个主题手册，见附录 D。

---

# 附录 D · 2026-07-14 酒馆前端、入口与工坊批次

## D1. 原始需求与合并裁决

原始 8 项：酒馆助手脚本与魔棒入口、酒馆插件、酒馆美化、开局页与自定义开局、创意工坊、悬浮球与功能入口、抽屉式状态栏、浮窗式状态栏。

按“重合度过高就合并升级；原册已经完整则不重复造轮子”执行：

| 原始需求 | 落点 | 裁决 |
|---|---|---|
| 酒馆助手脚本与魔棒入口 | `E5_创意工坊与扩展生态.md` | 合并升级；当前 TH ScriptTree/按钮/生命周期 |
| 酒馆插件 | `D5_ST扩展开发完整指南.md` | 合并升级；安装更新、依赖、兼容、安全与回滚 |
| 酒馆美化 | `C9_酒馆界面美化.md` | 新册；ST 宿主 Theme/Custom CSS，不与 C3 卡内 HTML 混同 |
| 开局页与自定义开局 | `C10_开局页与自定义开局.md` | 新册；一次性初始化器，不是 C5 同层前端 |
| 创意工坊 | `E5_创意工坊与扩展生态.md` | 合并升级；包/桥/事务/来源/审核产品链 |
| 悬浮球与功能入口 | `C11_悬浮球与功能入口.md` | 新册；launcher 与统一命令注册表 |
| 抽屉式状态栏 | `C12_抽屉式状态栏-移动端方案.md` | 新册；星月 3.4.9 已生产落地，不标待验证 |
| 浮窗式状态栏 | `C13_浮窗式状态栏.md` | 新册；桌面 HUD shell，不是悬浮球 |

## D2. 关键边界

1. **酒馆美化 vs 卡内 HTML**：C9 作用于 ST 宿主和用户主题，必须用户显式启用；C3 作用于角色卡消息/iframe。
2. **开局页 vs 同层前端**：C10 提交一次真实玩家开局消息后退出并恢复正常多楼层；C5 整场游玩都在首楼应用中闭合。
3. **入口 vs 内容表面**：C11 的悬浮球只分发命令；C12/C13 是 HUD 外壳；C2 继续负责状态内容和数据链。
4. **抽屉 vs 浮窗**：抽屉是移动端 top/bottom 单轴外壳；浮窗是桌面绝对像素矩形、拖动和缩放。自动模式可在二者之间切换，但任意时刻只保留一个 HUD host。
5. **TH 脚本 vs ST 插件**：E5 管卡内 ScriptTree、Wand 和工坊；D5 管 UI Extension/Server Plugin/manifest/安装运维。
6. **工坊 vs 正式变量**：工坊包只写受控世界书条目，不直接 patch MVU 存档变量；开局、prompt、UI 主题类型不从通用工坊包放行。

## D3. 本次回源

- 官方 SillyTavern：UI Customization、Character Design、UI Extensions、Server Plugins、Releases、SillyTavern-Content。
- 本地权威类型：`酒馆助手开发完全指南/@types.txt` 与配套完整指南。
- 当前生产 runtime：`rolecard-diy-workshop/runtime/xingyue/3.4.9/control-center.js`、`opening-page.html`。
- 工坊机器契约：`schemas/workshop-package.schema.json`、`shared/workshop-package-contract.js`、`gateway/server.js` 与 README。
- 历史/组件对照：`模块化组件/control_center/base_xingyue/fragments/`、星月 3.4.5/3.4.6/3.4.9 计划。

当前观察快照记录为 SillyTavern 1.18.0、TH upstream manifest 4.8.18（最低客户端 1.12.13），核验日期 2026-07-14。它们不是永久基线；指南采用最低能力契约、运行时检测和已核日期。

## D4. 规模与版本策略

- 新增 5 个主题手册：C9–C13。
- 升级 3 个既有主题：C2、D5、E5 至 v1.1.0。
- 证据一致性小修：A5、C5 至 v1.0.1。
- 当前共 32 个主题手册，另有 A0/A1 两份检查单；非归档活跃版本条目共 34 个。
- C9–C13 已于 2026-07-15 通过总监验收并转为 v1.0.0 正式指南。
- C12 的正式文档状态与生产证据一致：其架构已有星月 3.4.9 生产落地。只有 C8 明确保持“待验证”技术状态。

---

# 附录 E · 文档版本索引

> 文档版本只表示本指南条目的修订状态，不表示 SillyTavern、Tavern Helper、MVU、SP·数据库或其他依赖的版本。依赖版本必须查看各册“适用基线 / 已核快照 / 核验日期”。

| 条目 | 文档版本 | 最后更新 | 状态 |
|---|---:|---:|---|
| `A0_驾驭工程从零搭建检查单.md` | v1.0.0 | 2026-07-14 | 检查单 |
| `A1_驾驶员同步检查.md` | v1.0.0 | 2026-07-14 | 检查单 |
| `A2_角色卡格式规范.md` | v1.0.0 | 2026-07-14 | 正式指南 |
| `A3_世界书优化.md` | v1.0.0 | 2026-07-14 | 正式指南 |
| `A4_提示词与预设.md` | v1.0.0 | 2026-07-14 | 正式指南 |
| `A5_渲染管线与宏.md` | v1.0.1 | 2026-07-14 | 正式指南，开局占位/内联样式版本敏感性修正 |
| `A6_正则机制.md` | v1.0.0 | 2026-07-14 | 正式指南 |
| `B1_变量更新规则.md` | v1.0.0 | 2026-07-14 | 正式指南 |
| `B2_STScript与QuickReplies.md` | v1.0.0 | 2026-07-14 | 正式指南 |
| `C1_前端基础-TavernHelper与iframe.md` | v1.0.0 | 2026-07-14 | 正式指南 |
| `C2_前端应用-状态栏与控制中心.md` | v1.1.0 | 2026-07-14 | 正式指南，入口/外壳/内容分层升级 |
| `C3_HTML美化与CSS.md` | v1.0.0 | 2026-07-14 | 正式指南 |
| `C4_数据库表格模板.md` | v1.0.0 | 2026-07-14 | 正式指南 |
| `C5_同层前端.md` | v1.0.1 | 2026-07-14 | 正式指南，星月 3.4.9 证据路径修正 |
| `C6_独立前端.md` | v1.0.0 | 2026-07-14 | 正式指南 |
| `C7_数据库二创前端.md` | v1.0.0 | 2026-07-14 | 正式指南 |
| `C8_数据库兼容同层前端-待验证.md` | v0.1.0 | 2026-07-14 | 待验证，禁止生产引用 |
| `C9_酒馆界面美化.md` | v1.0.0 | 2026-07-15 | 正式指南，总监验收通过 |
| `C10_开局页与自定义开局.md` | v1.0.0 | 2026-07-15 | 正式指南，总监验收通过 |
| `C11_悬浮球与功能入口.md` | v1.0.0 | 2026-07-15 | 正式指南，总监验收通过 |
| `C12_抽屉式状态栏-移动端方案.md` | v1.0.0 | 2026-07-15 | 正式指南；技术路线已生产落地 |
| `C13_浮窗式状态栏.md` | v1.0.0 | 2026-07-15 | 正式指南，总监验收通过 |
| `D1_git挂载与资源加载.md` | v1.0.0 | 2026-07-14 | 正式指南 |
| `D2_大卡性能优化.md` | v1.0.0 | 2026-07-14 | 正式指南 |
| `D3_多模型API适配差异.md` | v1.0.0 | 2026-07-14 | 正式指南 |
| `D4_ST数据目录与部署运维.md` | v1.0.0 | 2026-07-14 | 正式指南 |
| `D5_ST扩展开发完整指南.md` | v1.1.0 | 2026-07-14 | 正式指南，插件安装/依赖/兼容/安全升级 |
| `D6_角色卡安全与XSS防护.md` | v1.0.0 | 2026-07-14 | 正式指南 |
| `D7_移动端与响应式适配.md` | v1.0.0 | 2026-07-14 | 正式指南 |
| `E1_ST群聊与多角色机制.md` | v1.0.0 | 2026-07-14 | 正式指南 |
| `E2_消息操作与分支检查点.md` | v1.0.0 | 2026-07-14 | 正式指南 |
| `E3_音频媒体与多模态.md` | v1.0.0 | 2026-07-14 | 正式指南 |
| `E4_表情立绘与Live2D.md` | v1.0.0 | 2026-07-14 | 正式指南 |
| `E5_创意工坊与扩展生态.md` | v1.1.0 | 2026-07-14 | 正式指南，TH 当前脚本树与工坊全链升级 |
