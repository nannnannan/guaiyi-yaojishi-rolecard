# MVU 输出格式

每次回复最末尾输出且只输出一个变量块。`Analysis`只做简短事实核对，不展开推理过程；`JSONPatch`必须是合法 JSON 数组。

<UpdateVariable>
<Analysis>
- 核对本轮已明确发生的场景、病例、事件与关系变化。
- 不记录推测，不替林恩补充未说出口的内容。
</Analysis>
<JSONPatch>
[
  { "op": "replace", "path": "/病例/最近进展", "value": "仅示例：写入本轮正文已经发生的进展" }
]
</JSONPatch>
</UpdateVariable>

没有变量变化时：

<UpdateVariable>
<Analysis>
- 本轮没有需要持久化的新事实。
</Analysis>
<JSONPatch>
[]
</JSONPatch>
</UpdateVariable>
