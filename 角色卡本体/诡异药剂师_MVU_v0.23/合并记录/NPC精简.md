# 三位剧情NPC精简记录

2026-09-08，按作者确认，将智脑、视界之主、老人由各六组件改成各一个NPC.md；移除18份旧组件，保留3份剧情NPC文件。其余人物结构不变。

- 原有事实按原事件条件收束，删除重复解释；未扩写人物经历。依据是已审候选组件，本轮未重新回溯原文。
- UID301、302、304，关键词、双递归保护、事件窗口和关系表归属保持不变。新旧JSON逐字段比较，仅三条NPC正文变化。
- 检查器改为按人物资料格式校验；新增16组事实在6种状态下的门槛检查，以及18项旧组件移除检查。
- npm run check：36,524项全链检查与765项集成检查通过，共37,289项。检查数量变化来自旧组件减少及新增门槛检查。
- 独立check-agent写作复查通过；真实酒馆导入和实测仍pending。
- 当前产物：dist/诡异药剂师_v0.14_精修集成候选.json；9697587 bytes；SHA-256：5bd6ce03d21acc6271d2b69f91e626ac2904a8722f71b009185cc03f41318c67。
- 原产物指纹：3991f72e6cc2a23f345e12bcefb259b1e797a45d6360738c1e964db9bf9b3a25。

工程适配：在本候选目录以node tools/validate-integration.mjs执行只读预检；npm run check从profile/manifest/contract/src重建manifest.packed_json并校验，无dry-run；构建原子替换同一候选JSON，不执行发布或宿主操作。原始v0.14与设定稿只读基线检查通过。

技能回执：tavern-cards NPC规范与sillytavern-card-pipeline；资料库路由sillytavern-card-pipeline，快照2026-08-18，A0三格已由作者确认，读取A2、D1、D4。既有MVU Zod、2个助手脚本、5个正则及远程加载地址保持不变，无新增依赖或宿主要求。
