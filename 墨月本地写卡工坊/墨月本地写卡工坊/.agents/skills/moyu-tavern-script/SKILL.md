---
name: moyu-tavern-script
description: 设计和实现运行在 SillyTavern 后台 iframe 中的酒馆助手脚本，包括事件监听、消息楼层、变量、世界书、提示词注入、AI 请求、按钮和酒馆页面增强。用户要求自动化、后台逻辑或接口操作时使用；只展示内容的前端界面不使用。
---

# 酒馆助手脚本

## 接口事实

先读取 `../../../知识库/写卡知识库/酒馆助手接口/00_索引_先看这个.txt`，再按任务只打开一个或数个接口分类。最终以项目 `@types/` 声明为准；知识库与类型冲突时，以类型和实际版本为准并记录差异。

- TavernHelper 全局函数：`../../../@types/function/`
- iframe 内 TavernHelper 对象：`../../../@types/iframe/exported.tavernhelper.d.ts`
- SillyTavern 原生导出：`../../../@types/iframe/exported.sillytavern.d.ts`
- ST-Prompt-Template 导出：`../../../@types/iframe/exported.ejstemplate.d.ts`
- MVU 导出：`../../../@types/iframe/exported.mvu.d.ts`

不要凭记忆发明函数。优先使用 TavernHelper 高层接口；只有没有对应能力时才考虑 SillyTavern 原生接口或 Slash 命令。

## 从大白话到脚本

1. 明确用户想让什么事件触发、读取什么、改变什么、失败时怎样处理。
2. 判断数据应放全局、角色卡、脚本、聊天还是消息楼层变量。
3. 列出最小权限和副作用；涉及删除、批量修改或外部请求时先确认。
4. 在 `脚本/<功能名>/index.ts` 实现一个清晰职责。
5. 用类型检查和最小运行场景验证；异常不能静默吞掉。

## 生命周期

- 使用 `$(() => {})` 作为加载入口，不依赖 `DOMContentLoaded`。
- 使用 `pagehide` 清理事件、计时器、Vue 实例和挂载节点。
- 脚本中的 jQuery 会作用到酒馆父页面；选择器必须限定范围，避免污染全局 UI。
- 挂载独立复杂界面时使用隔离 iframe；需要沿用酒馆样式的轻量组件才挂父页面，并正确传送与卸载样式。
- 浏览器环境不能调用 Node.js API。
