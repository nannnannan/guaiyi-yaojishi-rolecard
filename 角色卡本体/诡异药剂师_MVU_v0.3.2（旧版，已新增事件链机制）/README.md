# 《诡异药剂师》v0.32

这是面向SillyTavern 1.17.0与酒馆助手4.8.19的MVU Zod角色卡工程。v0.32是v0.31的小版本补丁：开场白替换为小说第1-4章血娃娃剧情原文摘抄（仅格式调整，正文逐字未改），E01血娃娃事件与相关设定按原文重写；其余内容与v0.31一致。内容范围截至第1至149章阶段1。v1.0以前仅内部使用，不公开发布；卡按开源标准制作，玩家主权优先。

## 本版内容

- 开场白：小说原文摘抄（第1章至第4章），覆盖系统觉醒、血锯离店、血娃娃上门诊疗、右眼抵押、隐藏任务"血娃娃找妈妈"触发（完成度2%）。玩家从诊后节点开始行动。
- 八名主要角色：左左、血锯、血衣女士、小小、人偶夫人、泰坦头颅、巫神头颅、小宝贝。
- 每人六个源码组件，按事件状态用EJS条件分段呈现阶段人设。
- 六类势力、三套世界机制、五处关键地点、十二个自主事件锚点（E01至E12）。
- 纯事件驱动时间线：不记录天数，E01完成后E02才可能进入预兆。
- 系统任务+图鉴轻量版；林恩按原文为17岁、等级2。
- 七根MVU结构；四页状态栏（当前状态、人物关系、世界事件、系统）。
- 恶堕值=女性角色亲密接受度：全部女性角色建变量、初始0、不锁定；小小为幼态角色，恶堕恒为0。

血锯、小小、泰坦头颅、巫神头颅和小宝贝固定非恋爱，吸引恒为0。八名主要角色不会永久死亡或彻底退出。

本版不包含战斗数值体系、装备栏、库存、货币经营结算、天数计数或旧聊天迁移。

## 运行依赖

- SillyTavern 1.17.0
- 酒馆助手 / JS-Slash-Runner 4.8.19
- 卡内MVU加载器与Zod Schema（ID：tavernweave-mvu-loader-v0.32、tavernweave-mvu-schema-v0.32）
- MagVarUpdate固定提交`b42817925d0391c15fa242a8238d2bbe28eb6319`
- MVU Zod桥接固定提交`7f29257de3ffbd83d63bc37ca09f4d4ecad6ca0f`

不需要额外安装Zod或EJS。额外更新预设是可选项，同轮`UpdateVariable.JSONPatch`可独立工作。

## 构建与验证

在本目录运行：

```powershell
npm run check
```

生成物：`dist/诡异药剂师_v0.32.json`

当前离线基线：

- 世界书条目：41
- 主要角色：8
- 事件锚点：12
- 检查：1938项通过（含开场白与`src/prompts/opening_source.txt`原文逐字归一化比对、锚点优先调度规则、十二对事件引入段）
- 产物大小：394191字节
- SHA-256：`8b24ead6352c707b8a40d023029a0e6375db4b3b87c9d91dde0484ab8ec1b1be`
- 状态：离线验证通过候选版（等待所有者真实宿主验收）

## 维护入口

- `创作规划.yaml`：需求和内容边界。
- `contract.json`：结构契约与验收条件。
- `manifest.json`：稳定ID、版本、文件映射和运行依赖。
- `src/worldbook.json`：世界书注册表。
- `src/prompts/opening_source.txt`：开场白原文源（修改开场白须同步此源并保持逐字一致）。
- `src/prompts/first_message.md`：生成的开场白（原文+占位符+initvar块）。
- `src/characters/`：八名主要角色的六组件源码。
- `src/events/`：十二个事件锚点。
- `src/factions/`、`src/mechanisms/`、`src/locations/`：世界内容。
- `src/initial_variables.json`、`src/scripts/schema.js`、`src/prompts/mvu_*`、`src/ui/status.html`：MVU整链。
- `tools/build.mjs`、`tools/validate.mjs`：构建与离线验证。

不要直接编辑`dist/`，应修改源码后重新构建。
