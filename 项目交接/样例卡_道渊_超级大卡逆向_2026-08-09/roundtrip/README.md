# 往返验证说明

这里保留了两种性质不同的往返结果。

## 1. `lossless-reembedded.png`

它把权威原始 JSON 重新写入 PNG 的 `chara` 与 `ccv3` 两个载荷块，同时保留其他 PNG 块。结果与源快照逐字节相同：

- PNG SHA-256：`d5fcf612f95620c285610a4702a18ffd0e98797e8903e2eaaf2cfb228a562752`
- JSON SHA-256：`7759a56059d4e8bd17bfa6a09c5f2c45178393d703e5c5e523873eaa190757a8`
- 语义 SHA-256：`8fff3e9f6fb8f042df3bed17fa1fb64499a129071a66039f3f1a670468b6de6f`

`redecoded/` 是对该结果的再次解码审计。

## 2. `repacked.png`

该文件是通用 `tavern-cards-forge` 回包器的输出。虽然扩展名为 `.png`，当前工具实际输出的是 JSON；它仅用于差异研究，不是可交付角色卡。

`semantic-diff.json` 记录了它相对权威载荷的 805 处语义差异，主要包括：

- 302 条世界书的 `extensions.depth` 被改为 `0`；
- 多个 `null` 型 cooldown、delay、sticky 被改为数字 `0`；
- 11 个 `selective` 值改变；
- 4 个助手脚本的 `export_with` 被删除；
- 开场白换行被规范化。

结论：本次拆包结果适合阅读和审计，但不能未经修正直接作为该卡的发布回包源。
