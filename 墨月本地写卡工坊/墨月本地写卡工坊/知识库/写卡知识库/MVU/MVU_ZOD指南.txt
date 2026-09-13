MVU ZOD 变量框架工作流

系统组成：
- 变量结构脚本（Zod Schema，角色脚本）→ 定义类型和约束
- [initvar]初始变量（世界书条目，禁用）→ YAML初始值
- 变量列表（世界书条目）→ 让AI看到当前值
- [mvu_update]变量更新规则（世界书条目）→ 告诉AI何时更新
- [mvu_update]变量输出格式（世界书条目）→ 告诉AI用JSON Patch输出
- 酒馆正则 → 隐藏<UpdateVariable>块
- 脚本/界面（可选）→ 后台控制/显示变量

一、变量结构脚本

z和_已全局可用，不要import。放在角色脚本中。

import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';
export const Schema = z.object({
  角色: z.object({
    好感度: z.coerce.number().transform(v => _.clamp(v, 0, 100)),
    物品栏: z.record(z.string().describe('物品名'), z.object({
      描述: z.string(),
      数量: z.coerce.number().prefault(1),
    })).transform(data => _.pickBy(data, ({数量}) => 数量 > 0)),
  }),
});
$(() => { registerMvuSchema(Schema); });

Zod 4规则：
- z.coerce.number() 优于 z.number()
- z.prefault 优于 z.default
- z.transform做约束（clamp而非min/max）
- 对象优于数组（z.record优于z.array）
- 不用z.strict/z.passthrough（不存在）
- transform只接受一个参数(value)=>...
- 保持幂等：Schema.parse(Schema.parse(x)) === Schema.parse(x)

二、初始变量

条目名：[initvar]变量初始化勿开，禁用状态
YAML格式，与Schema对应：
角色:
  好感度: 35
  物品栏:
    创可贴:
      描述: 卡通创可贴
      数量: 1

不同开局方案：
- 全量：开局消息中<UpdateVariable><initvar>完整YAML</initvar></UpdateVariable>
- 增量：<UpdateVariable><JSONPatch>[{"op":"replace","path":"/角色/好感度","value":50}]</JSONPatch></UpdateVariable>

三、变量列表

条目名：变量列表（不加[mvu_update]），D0/D1，顺序200
固定内容：
---
<status_current_variable>
{{format_message_variable::stat_data}}
</status_current_variable>

四、变量更新规则

条目名：[mvu_update]变量更新规则，D0，顺序200
---
变量更新规则:
  角色:
    好感度:
      type: number
      range: 0~100
      check:
        - 根据角色反应调整±(3~6)
    物品栏:
      type: |-
        { [物品名: string]: { 描述: string; 数量?: number } }
      check:
        - 获取/消耗物品时更新

编写技巧：自明变量省略规则，同类变量合并，_开头只读变量不写

五、变量输出格式

条目名：[mvu_update]变量输出格式，D0(Gemini)/D4(Claude)，顺序200
固定内容（英文或中文版均可）：
---
变量输出格式:
  rule:
    - you must output the update analysis and the actual update commands at once in the end of the next reply
    - the update commands works like **JSON Patch (RFC 6902)**, supports: replace/delta/insert/remove/move
    - don't update fields starting with `_`
  format: |-
    <UpdateVariable>
    <Analysis>$(IN ENGLISH, no more than 80 words)
    - ${calculate time passed}
    - ${decide dramatic updates allowed: yes/no}
    - ${analyze every variable based on check}
    </Analysis>
    <JSONPatch>
    [
      { "op": "replace", "path": "${/path}", "value": "${new}" },
      { "op": "delta", "path": "${/path}", "value": "${delta}" },
      { "op": "insert", "path": "${/path/new_key}", "value": "${new}" },
      { "op": "remove", "path": "${/path}" },
      ...
    ]
    </JSONPatch>
    </UpdateVariable>

JSON Patch路径：用/分隔，不需要stat_data前缀

六、正则配置

导入三个正则（美化/折叠/仅提示版）：
- [不发送]去除变量更新：仅格式提示词，替换<UpdateVariable>为空
- [美化/折叠]变量更新中：仅格式显示，美化显示
- [美化/折叠]完整变量更新：仅格式显示

七、脚本控制变量

前置：await waitGlobalInitialized('Mvu');

获取变量：
const vars = Mvu.getMvuData({type:'message', message_id:-1});
const stat = _.get(vars, 'stat_data');

写回变量：
await Mvu.replaceMvuData(vars, {type:'message', message_id:id});

监听更新命令解析：
eventOn(Mvu.events.COMMAND_PARSED, commands => {
  commands.forEach(cmd => { cmd.args[0] = cmd.args[0].replaceAll('-',''); });
});

监听更新结束：
eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, (new_vars, old_vars) => {
  // 限制变动幅度
  const old = _.get(old_vars, 'stat_data.好感度');
  _.update(new_vars, 'stat_data.好感度', v => _.clamp(v, old-3, old+3));
});

解析AI生成结果中的命令：
const data = await Mvu.parseMessage(message, old_data);
await Mvu.replaceMvuData(data, {type:'message', message_id:id});

八、界面显示

MVU自动附加<StatusPlaceHolderImpl/>，配合正则：
- [不发送]界面占位符：仅格式提示词，替换为空
- [界面]状态栏：仅格式显示，替换为界面代码

纯文本示例：
💖 好感度: {{format_message_variable::stat_data.角色.好感度}}

前端界面须在init中：
await waitGlobalInitialized('Mvu');
populateCharacterData();
eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, () => populateCharacterData());

九、特殊前缀

无前缀：AI可见可更新
_前缀：AI可见不可更新（只读）
$前缀：AI不可见，脚本/提示词可更新

十、EJS读取 vs AI更新路径

EJS/状态栏：stat_data.角色.好感度
AI JSON Patch：/角色/好感度（无stat_data）
