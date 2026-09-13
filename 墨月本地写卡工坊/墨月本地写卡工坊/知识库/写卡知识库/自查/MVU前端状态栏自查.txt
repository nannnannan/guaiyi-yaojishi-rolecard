MVU前端状态栏自查标准

本文件供AI在完成MVU前端状态栏创作后自动审查使用。

═══════════════════════════════════════
检查清单
═══════════════════════════════════════

1. HTML结构完整性
- 有 <head> 和 <body>
- <head> 里有 <script type="module">
- <body> 里有HTML内容（结构可以任意）

2. CSS样式检查（必须严格检查）
- body 必须有 margin: 0; padding: 0;
- 重要：不能是 padding: 10px 或其他任何非0的值
- 如果需要边距，应该给容器元素加 margin，而不是给 body 加 padding
- 样式符合用户要求的UI风格
- 样式不会导致布局错乱或显示异常

3. 变量获取检查（重点！）
- 使用了 getAllVariables()
- 所有变量路径都以 'stat_data.' 开头（必须！）
- 使用了 _.get(all_variables, 'stat_data.xxx', '默认值')

对于数组类型变量（如背包、记忆列表）：
- 正确遍历并显示数组内容

对于嵌套对象（如用户信息.背包.材料）：
- 使用 _.get 访问嵌套路径

4. 初始化检查（核心逻辑，必须严格检查）
- 必须使用 await waitGlobalInitialized('Mvu')
- 必须使用 $(errorCatched(init))
- populateCharacterData() 在 init 里调用
- 必须有 eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, ...) 监听变量更新
- 监听回调中必须调用 populateCharacterData()

═══════════════════════════════════════
核心检查重点
═══════════════════════════════════════

最重要的检查点：

1. 所有变量路径必须以 'stat_data.' 开头
- 错误：_.get(all_variables, '角色.年龄', ...)
- 正确：_.get(all_variables, 'stat_data.角色.年龄', ...)

2. 防御性编程（重要，提高代码健壮性）
- 使用 _.get 访问嵌套路径

═══════════════════════════════════════
常见错误
═══════════════════════════════════════

1. body 的 padding 不是 0
   错误：body { padding: 10px; }
   正确：body { margin: 0; padding: 0; }
   如果需要边距：#container { margin: 10px; }

2. 缺少 stat_data 前缀
   错误：_.get(all_variables, '角色.年龄', 'N/A')
   正确：_.get(all_variables, 'stat_data.角色.年龄', 'N/A')

3. 缺少变量更新监听
   必须有 eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, ...) 并在回调中重新渲染
