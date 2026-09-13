import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const initialPath = resolve(root, 'src/initial_variables.json');
const firstMessagePath = resolve(root, 'src/prompts/first_message.md');
const statusPath = resolve(root, 'src/ui/status.html');

const titles = {
  E21: '魔鬼训练与首次独立出诊', E22: '幸福之家的血肉晚宴', E23: '异域同乡与爱丽丝初愈',
  E24: '诅咒复燃与古堡围猎', E25: '双面伯爵与心脑之汤', E26: '爱丽丝重生与母女终局',
  E27: '白逸遣返与九州异变', E28: '爱丽丝日常与十四病战蜥', E29: '传奇赠药与夜医启程',
  E30: '血月狼群与寂静镇试诊', E31: '哭泣小丑与血肉灾变', E32: '小丑余波与夜医接纳',
  E33: '夜医试炼与白夜旧梦', E34: '倒吊天使与夜医授职', E35: '左左拟化与蓝星鬼袭',
};

function relationship(boundary) {
  return {
    解锁: false,
    在场: false,
    生存状态: '活动',
    位置: '未解锁',
    处境: '未解锁',
    关系类型: '未建立',
    人物阶段: '未接触',
    好感: 0,
    信赖: 0,
    戒备: 0,
    吸引: 0,
    关系创伤: 0,
    恶堕: 0,
    可见迹象: [],
    边界: boundary,
    关键记忆: [],
    最近互动: '尚未发生',
  };
}

const state = JSON.parse(await readFile(initialPath, 'utf8'));
state.元数据 = { 卡名: '《诡异药剂师》v0.6', 版本: '0.6.0' };
state.世界.当前场景时间 = 'E02收尾·午后';
for (const [id, title] of Object.entries(titles)) {
  state.事件.锚点状态[id] = { 标题: title, 状态: '未触发', 收尾: false };
}
Object.assign(state.关系, {
  爱丽丝: relationship('非性恋爱与吸引方向开放；幼态外观期间恶堕恒为0，治疗、家人承诺与地缚依赖不能制造亲密同意'),
  白逸: relationship('固定非恋爱同乡与盟友；治疗、去势后遗症和跨界依赖不能制造亲密同意'),
  倒吊天使: relationship('关系方向开放；原作之吻、任务、高好感、授职与治疗均不代表玩家接受关系'),
  白夜: relationship('固定非恋爱前辈；理念认可、特批资格与引见主母不能制造亲密同意'),
  渡鸦: relationship('固定非恋爱夜医同僚；考验、救治、审查与接纳不等于完全信任'),
  黑颅: relationship('固定非恋爱夜医同僚；短时恢复生前肉身不改变边界'),
  猪头屠夫: relationship('固定非恋爱幕后反派；交易、送达与救命事实不构成亲密关系'),
  哭泣小丑: relationship('固定非恋爱体内诅咒人格；侵蚀、替代人格和显化均不能被叙述为亲密同意'),
  黑白小丑: relationship('固定非恋爱独立反派；与哭泣小丑显化体分离，林恩当前不知道其身份与山巅密谈'),
});

const json = JSON.stringify(state, null, 2);
await writeFile(initialPath, `${json}\n`, 'utf8');

const first = await readFile(firstMessagePath, 'utf8');
const firstStart = first.indexOf('<initvar>');
const firstEnd = first.indexOf('</initvar>');
if (firstStart === -1 || firstEnd === -1 || firstEnd < firstStart) throw new Error('first_message缺少initvar块');
const syncedFirst = `${first.slice(0, firstStart + '<initvar>'.length)}\n${json}\n${first.slice(firstEnd)}`;
await writeFile(firstMessagePath, syncedFirst, 'utf8');

const status = await readFile(statusPath, 'utf8');
const marker = 'const FALLBACK_STATE = ';
const statusStart = status.indexOf(marker);
const statusEnd = status.indexOf('\n;', statusStart);
if (statusStart === -1 || statusEnd === -1) throw new Error('status缺少FALLBACK_STATE');
const syncedStatus = `${status.slice(0, statusStart)}${marker}${json}\n;${status.slice(statusEnd + 2)}`;
await writeFile(statusPath, syncedStatus, 'utf8');

console.log(JSON.stringify({ status: 'synced', eventAnchors: Object.keys(state.事件.锚点状态).length, relationships: Object.keys(state.关系).length }, null, 2));
