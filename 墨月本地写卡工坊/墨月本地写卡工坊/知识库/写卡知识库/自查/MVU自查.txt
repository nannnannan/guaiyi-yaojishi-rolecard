MVU变量系统自查标准

本文件供AI在完成MVU相关创作后自动审查使用。
涵盖：变量结构脚本、初始变量、变量列表、变量更新规则、变量输出格式、变量输出格式强调。

═══════════════════════════════════════
一、变量结构脚本自查
═══════════════════════════════════════

1. 头尾检查
变量结构脚本必须原封不动地包含：

开头：
import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';

结尾：
$(() => {
  registerMvuSchema(Schema);
})

2. javascript语法检查
- javascript语法正确（括号、逗号、引号配对）
- 数组和对象的嵌套层级正确

3. zod 4使用检查
- 没有使用任何 .strict() 或 .passthrough()
- 没有滥用 .optional()
- 没有对根变量的字段使用 .optional() 或 .prefault()
- .prefault/catch(value | () => value) 使用正确
- 针对复杂 .object 有使用 .or(z.literal('待初始化')).prefault('待初始化') 等手段保证变量能有效更新
- 只对必要的键使用了 .describe() 解释用途
- 尽量地使用了 z.object() 而不是 z.array()

4. 代码导入检查
确保代码中仅导入了 registerMvuSchema，没有导入 zod 或 lodash 库。
zod 和 lodash 库已经默认可用，在代码中导入它们反而会导致问题。

5. 常见错误检查
- 数组、对象嵌套层级混乱
- 过分使用了 .optional() 或 .prefault()
- 错误使用了繁体字！需要把所有繁体字改为简体字！

═══════════════════════════════════════
二、初始变量自查
═══════════════════════════════════════

1. YAML格式检查
- YAML语法正确（括号、逗号、引号配对）
- 数组和对象的嵌套层级正确

2. 变量结构检查
- 变量初始值的类型符合变量结构要求

3. 常见错误检查
- 错误使用了繁体字！需要把所有繁体字改为简体字！

4. 条目配置
- 条目名：[initvar]变量初始化勿开
- 位置：D齿轮在深度
- 深度：4
- 顺序：200

═══════════════════════════════════════
三、变量列表自查
═══════════════════════════════════════

变量列表是固定格式，必须与以下完全一致：

```yaml
---
<status_current_variables>
{{format_message_variable::stat_data}}
</status_current_variables>
```

条目配置：
- 条目名：变量列表（不要添加[mvu_update]）
- 位置：D齿轮在深度
- 深度：0
- 顺序：200

═══════════════════════════════════════
四、变量更新规则自查
═══════════════════════════════════════

1. 精简性检查
- 是否对变量名已经解释清楚该如何更新的自明变量填写了大量更新规则
- 是否有变量还能够合并变量更新规则

2. 变量更新结构
检查每个变量mapping：
- z.record 变量是否正确区分了变量路径和 type 中的键名
- type 是否与变量结构脚本中的定义一致
- 是否有 check 字段

3. 特殊规则检查（如有）
如果有特殊系统（傲娇、敌意等），检查：
- 数值范围
- 变化步长
- 特殊条件
- 边界处理

4. 条目配置
- 条目名：[mvu_update]变量更新规则（一定不要忘记[mvu_update]）
- 位置：D齿轮在深度
- 深度：0
- 顺序：200

═══════════════════════════════════════
五、变量输出格式自查
═══════════════════════════════════════

变量输出格式是固定格式，必须与以下完全一致：

```yaml
---
变量输出格式:
  rule:
    - you must output the update analysis and the actual update commands at once in the end of the next reply
    - the update commands works like the **JSON Patch (RFC 6902)** standard, must be a valid JSON array containing operation objects, but supports the following operations instead:
      - replace: replace the value of existing paths
      - delta: update the value of existing number paths by a delta value
      - insert: insert new items into an object or array (using `-` as array index intends appending to the end)
      - remove
      - move
    - don't update field names starts with `_` as they are readonly, such as `_变量`
  format: |-
    <UpdateVariable>
    <Analysis>$(IN ENGLISH, no more than 80 words)
    - ${calculate time passed: ...}
    - ${decide whether dramatic updates are allowed as it's in a special case or the time passed is more than usual: yes/no}
    - ${analyze every variable based on its corresponding `check`, according only to current reply instead of previous plots: ...}
    </Analysis>
    <JSONPatch>
    [
      { "op": "replace", "path": "${/path/to/variable}", "value": "${new_value}" },
      { "op": "delta", "path": "${/path/to/number/variable}", "value": "${positive_or_negative_delta}" },
      { "op": "insert", "path": "${/path/to/object/new_key}", "value": "${new_value}" },
      { "op": "insert", "path": "${/path/to/array/-}", "value": "${new_value}" },
      { "op": "remove", "path": "${/path/to/object/key}" },
      { "op": "remove", "path": "${/path/to/array/0}" },
      { "op": "move", "from": "${/path/to/variable}", "to": "${/path/to/another/path}" },
      ...
    ]
    </JSONPatch>
    </UpdateVariable>
```

条目配置：
- 条目名：[mvu_update]变量输出格式（一定不要忘记[mvu_update]）
- 位置：D齿轮在深度
- 深度：Gemini设置成0 / Claude设置成4
- 顺序：200

═══════════════════════════════════════
六、变量输出格式强调自查
═══════════════════════════════════════

变量输出格式强调是固定格式，必须与以下完全一致：

```yaml
---
变量输出格式强调:
  rule: The following must be inserted to the end of reply, and cannot be omitted
  format: |-
    <UpdateVariable>
    ...
    </UpdateVariable>
```

注意：这个条目只在最后测试角色卡时，发现AI经常不输出变量更新（即<UpdateVariable>块）时才需要。

条目配置：
- 条目名：[mvu_update]变量输出格式强调（一定不要忘记[mvu_update]）
- 位置：D齿轮在深度
- 深度：0
- 顺序：200

═══════════════════════════════════════
通用自查原则
═══════════════════════════════════════

1. 只检查结构和格式正确性，不检查内容丰富度
2. 如果正确就说正确，不要为了检查而找问题
3. 给出具体错误位置和修正方案
4. 发现错误时直接输出修正后的完整代码
