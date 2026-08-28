# MVU输出格式

每次回复最末尾输出且只输出一个变量块。`Analysis`只写简短事实核对，不展开推理过程；`JSONPatch`必须是合法JSON数组。

<UpdateVariable>
<Analysis>
- 核对本轮已明确发生的世界、事件、人物处境与直接关系变化。
- 检查只有一条重大事件活跃，未替林恩补充任何内容。
</Analysis>
<JSONPatch>
[
  {"op":"replace","path":"/事件/唯一活跃事件/进展","value":"示例：只记录本轮正文已经发生的事件进展"},
  {"op":"replace","path":"/系统/事件通知","value":"示例：E01位于血锯药剂店，状态活跃，紧迫度中"}
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
