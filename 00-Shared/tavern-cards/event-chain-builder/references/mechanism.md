# 常驻事件链机制（机制规范）

本文档描述 v0.3.3.1 及之后版本采用的事件链机制：**常驻注入 + MVU 状态门控**，不依赖聊天关键词触发事件衔接。改动机制前先读本文件与目标版本的 `AGENTS.md`、`创作规划.yaml`。

## 1. 状态模型（MVU）

- `事件.锚点状态.{E0X}`：`{ 标题, 状态, 收尾 }`。
  - `状态` 六态：未触发 / 预兆 / 活跃 / 变形 / 完成 / 取消。
  - `收尾`：布尔。事件主体完成、只差玩家推进时 true；进行中 false。
- `事件.唯一活跃事件`：活跃/变形锚点必须唯一；无活跃时置空（事件ID=""、状态="无"）。
- `事件.近期预兆`：指向处于「预兆」状态的下一事件。
- `事件.最近结果`：已收束事件摘要（事件ID/标题/结果/世界影响）。
- schema（`src/scripts/schema.js`）强制：唯一活跃校验、预兆必须指向预兆态锚点、`收尾` 为布尔。

**收束判定**：每个事件文件必须显式给出「完成条件」「变形条件」「取消条件」。完成/变形/取消必须对照这些条件判定；中途事实（来客离开、场景切换、单步处置）不构成收束。例：E03 仅猪头魔跑路不算完成，必须血婴完成整容处置并形成稳定结果。系统规则（system.md 规则7、mainline 规则11、mvu_update_rules 规则5）均引用此判定。

## 2. 常驻条目 [核心]自主世界事件调度

内容源 `src/prompts/mainline.md`，constant=true 每轮注入。包含四部分：

1. **五个宽阶段**：S0–S4 全局地图。
2. **调度规则 1–11**：锚点优先于原创、预兆流程、衔接优先、触发时机守卫、收尾门控、原创边界。
3. **事件上下文窗口**（EJS）：按状态定位当前锚点 `cur`，渲染前后各 3 个事件的一句话因果摘要。
   - `cur` 定位顺序：活跃/变形事件 → 近期预兆的前件 → 最近完成/取消事件 → E01。
   - 行格式：`- [E0X·标题] 状态[·收尾/·进行中] ◆当前/·已过/·未到｜因果摘要`。
4. **事件详情窗口**（构建生成，见 §5）：`detailWindow = [cur-1, cur, cur+1]`，只展开这三条事件的完整详情。

## 3. 即时衔接段（12 对）

每对 Ei→Ei+1 包含：触发时机 / 剧情引子 / 预兆写法 / 承接因果。EJS 门控条件：

```ejs
前件 ∈ {完成, 变形, 取消} 或 (前件 === "活跃" && 前件.收尾 === true)
且 后件 ∈ {未触发, 预兆}
```

满足才渲染该对；未满足（如事件进行中）整段不出现。触发时机以每对自带文字为准，未满足不得把后件写入近期预兆。

## 4. 事件蓝灯条目（E01–E12）

- 注册于 `src/worldbook.json`，id = 300 + 序号，keys 含事件 ID 与自然词。
- 内容带 EJS 门槛：`状态 === "未触发"` 时只显示占位（不泄底）；否则渲染完整详情。
- 完整分支必须含标题行（`# E0X·标题`），验证器断言标题出现 ≥2 次。

## 5. 构建期：事件详情窗口并入

`tools/build.mjs` 构建时把 12 条事件源码（去掉「下一事件引入」段）自动并入常驻条目，每条包一层：

```ejs
<%_ if (detailWindow.indexOf('E0X') !== -1) { _%>
<事件内容，含其自身 EJS 门槛>
<%_ } _%>
```

运行时只有 `detailWindow` 内的三条会输出；未触发的后件由其自身门槛降级为占位。

## 6. 状态栏推进按钮

`src/ui/status.html` 内：

- `BRIDGE_PAIRS`：11 对 {from,to,title,dir,loc,urgency,deadline}，方向文案用于写近期预兆。
- `findReadyPair(events)`：与 §3 同一门控，找到就绪对 → 按钮可点；否则禁用。
- 点击逻辑：前件活跃→完成（并清空唯一活跃事件）、后件→预兆、写近期预兆与事件通知；用 `Mvu.replaceMvuData` 整树写回（保留其他字段）。

## 7. 规则落点

- `src/prompts/system.md` 规则 7：锚点优先、第一轮推进语、触发时机守卫、收尾门控、原创边界。
- `src/prompts/mvu_update_rules.md` 规则 8/10/15：预兆写入规则、衔接优先、收尾标记语义。
- `src/prompts/mainline.md` 规则 11：衔接优先。

## 8. 验证器落点（tools/validate.mjs）

- 每条事件：标题 ≥2、EJS 门槛、字段标记、引入段（E12 除外）。
- mainline：12 对桥段标题、getvar 门控、六态覆盖、上下文窗口、detailWindow、收尾 token。
- 初始变量：E01 活跃收尾=true、其余未触发收尾=false、近期预兆为空、唯一活跃 E01。
- 状态栏：FALLBACK_STATE、按钮、findReadyPair、replaceMvuData。
- 打包常驻条目：事件详情窗口存在、源码与打包内容一致性（常驻条目允许附加生成段）。

## 9. 添加/修改事件必须同步的文件

1. `src/events/E0X_*.md`（事件内容）
2. `src/prompts/mainline.md`（ctx 数组行 + 桥段 EJS 块）
3. `src/scripts/schema.js`（anchorTitles）
4. `src/initial_variables.json`（锚点行 + 重新生成 first_message.md initvar）
5. `src/worldbook.json`（蓝灯注册）
6. `src/ui/status.html`（BRIDGE_PAIRS）
7. `tools/validate.mjs`（桥段对、循环范围、E12 边界断言）
8. 重建 + `npm run check` + 同步基线（README/AGENTS/host_acceptance）

详细步骤见 `references/add-event-workflow.md`；脚手架见 `scripts/add-event.mjs`。
