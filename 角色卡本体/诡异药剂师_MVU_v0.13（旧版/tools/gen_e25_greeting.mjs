// 生成 E25 预兆版开场白（正文 + 状态栏占位 + UpdateVariable/initvar）
import fs from 'node:fs';
const initvar = fs.readFileSync('src/initial_variables_e25.json', 'utf8').trim();
const body = `【幸福之家·围猎暂歇的深夜】

围猎的喧嚣刚刚散去，古堡重新安静下来。

宴会厅里杯盘狼藉，撕破的窗帘外夜色浓重。通往高塔的阶梯处，还有最后一名“家人”守着——他背对大厅，身影被烛光拉长，一动不动。厨房方向飘来肉汤的香气，浓得反常。

E24的围猎中，玛丽夫人的深层诅咒被暂时压制，爱丽丝再度隐去身形（没有消散）；白逸在几步外清点伤情，左手手心里，左左仍绷着警戒。

烛火噼啪一声，高台方向没有回头。

【系统提示】近期预兆：E25·双面伯爵与心脑之汤——高台仍有最后一名家人守住通往高塔的路。E24已完成收尾，E25处于预兆、尚未进入活跃。林恩此刻在宴会厅余烬之间，接下来的一切由玩家决定。

<StatusPlaceHolderImpl/>
<UpdateVariable>
<initvar>
${initvar}
</initvar>
</UpdateVariable>`;
fs.writeFileSync('src/prompts/alternate_greeting_e25.md', body + '\n', 'utf8');
console.log('已生成 src/prompts/alternate_greeting_e25.md，正文', body.split('\n').slice(0, 14).join('\n').length, '字符');
