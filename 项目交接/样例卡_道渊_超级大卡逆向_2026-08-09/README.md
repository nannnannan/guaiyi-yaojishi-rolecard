# 《道渊》v5.3 超级大卡逆向资料

本目录是对用户提供样例 PNG 的只读快照、无损解包、组件映射、语义审计与往返验证结果。分析对象没有被修改；截至本报告生成时，目标卡也没有导入本地 SillyTavern。

## 建议阅读顺序

1. `道渊v5.3_超级大卡完整逆向报告.md`：完整原理、MVU、EJS、世界书架构、缺陷与本项目可复用方案。
2. `analysis/worldbook-entry-index.csv`：319 条世界书的逐条工程索引，可按 UID、名称、粗分类、启用状态、关键词和文件路径筛选。
3. `analysis/worldbook-semantic-classification.csv`：报告使用的十类人工语义映射及逐条 cl100k_base 近似 token。
4. `components/unpacked/`：便于人工阅读的世界书、开场白、正则和脚本组件。
5. `components/extracted-extensions/ZOD.ts`：从卡内提取的可读 Zod Schema。
6. `analysis/runtime-dependency-ledger.json`：宿主、内嵌脚本与远程运行依赖。
7. `analysis/runtime-readonly-evidence.json`：只读真机命令、版本、计数与零变更结果。
8. `analysis/remote-runtime-snapshot-manifest.json`：远程 URL、版本策略与点时哈希。
9. `decoded/png-audit-manifest.json` 与 `analysis/integrity-manifest.json`：PNG、双载荷和组件覆盖证据。
10. `roundtrip/README.md`：无损回嵌与通用拆包器回包差异。

## 权威性说明

- 权威语义源：`decoded/payload-chara.raw.json`
- 人工可读副本：`components/unpacked/`
- `analysis-initial-superseded/` 保存了修正复合条目映射、EJS 第二参数识别之前的中间分析，已被 `analysis/` 完全取代，不应作为结论依据。
- `components/unpacked/` 适合阅读，但当前通用回包器不能保持该卡全部元数据；发布前必须以权威 JSON 或修复后的专用流水线为准。

## 写入边界

本轮新增内容只位于 `项目交接/样例卡_道渊_超级大卡逆向_2026-08-09/`。未写入 `角色卡本体/`、`00-Shared/` 或其他协作者项目。
