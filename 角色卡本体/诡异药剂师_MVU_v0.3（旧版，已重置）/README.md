# 《诡异药剂师》v0.3

这是面向SillyTavern 1.17.0与酒馆助手4.8.19的MVU Zod角色卡工程。v0.3从v0.2非破坏性复制，内容范围推进到第1至149章阶段1，v1.0以前仅内部使用。

角色卡的最高目标是还原小说世界与人物，让玩家直接扮演20岁的林恩自由行动。原作事件提供默认因果，不要求玩家复刻章节。AI绝不替林恩书写对白、主动行动、决定、判断、记忆或内心。

## 本版内容

- 十名主要角色：左左、血锯、血衣女士、小小、人偶夫人、爱丽丝、黑弦月、泰坦头颅、巫神头颅、小宝贝。
- 每人维护角色速览、基础信息、性格调色盘、三面性、多阶段人设和二次解释六个源码组件。
- 运行时每人合并为一条姓名触发蓝灯，避免常驻占用上下文。
- 六类势力、四类世界机制、六处关键地点。
- 五个宽阶段与E01至E12十二个自主世界事件锚点。
- 七根MVU结构：元数据、世界、林恩、事件、关系、角色关系、系统。
- 三页状态栏：当前状态、人物关系、世界事件。
- 所有世界书条目同时打开`exclude_recursion`和`prevent_recursion`。

血锯、小小、爱丽丝、泰坦头颅、巫神头颅和小宝贝固定非恋爱，吸引锁定为0。十名主要角色不会永久死亡或彻底退出，但可以受伤、失联、受困、休眠、暂离或敌对。

本版不包含战斗数值、等级、阶位、技能树、装备、库存、货币、经营模拟或v0.2聊天迁移。

## 运行依赖

- SillyTavern 1.17.0
- 酒馆助手 / JS-Slash-Runner 4.8.19
- 卡内MVU加载器与Zod Schema
- MagVarUpdate固定提交`b42817925d0391c15fa242a8238d2bbe28eb6319`
- MVU Zod桥接固定提交`7f29257de3ffbd83d63bc37ca09f4d4ecad6ca0f`
- 主CDN为`cdn.jsdelivr.net`，备用CDN为`testingcf.jsdelivr.net`

不需要额外安装Zod或EJS。额外更新预设是可选项，同轮`UpdateVariable.JSONPatch`可独立工作。

## 构建与验证

在本目录运行：

```powershell
npm run check
```

生成物：

`dist/诡异药剂师_v0.3.json`

离线验证覆盖角色卡规范与镜像、十人六组件合并、势力与地点、事件模板、递归保护、MVU整链、非恋爱锁定、三页UI、固定远程提交、血娃娃开场逐字节一致及负向夹具。

本版已由所有者在真实酒馆中测试并确认可用，验收记录见`host_acceptance.json`。v1.0以前仍为内部版本，不公开发布。

当前离线基线：

- 世界书条目：50
- 主要角色：10
- 事件锚点：12
- 检查：2677项通过
- 产物大小：290730字节
- SHA-256：`fb6c01d376e9cf4047ce1221b9f522049e8d5e0366ee53189f6ce360bdb9586c`
- 真实宿主验收：所有者确认通过

## 维护入口

- `创作规划.yaml`：需求和内容边界。
- `contract.json`：结构契约与验收条件。
- `manifest.json`：稳定ID、版本、文件映射和运行依赖。
- `src/worldbook.json`：世界书注册表。
- `src/characters/`：十名主要角色的六组件源码。
- `src/events/`：十二个事件锚点。
- `src/factions/`、`src/mechanisms/`、`src/locations/`、`src/npcs/`：世界内容。
- `src/initial_variables.json`、`src/scripts/schema.js`、`src/prompts/mvu_*`、`src/ui/status.html`：MVU整链。
- `tools/build.mjs`、`tools/validate.mjs`：构建与离线验证。

不要直接编辑`dist/`，应修改源码后重新构建。
