import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import ejs from 'ejs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspace = path.resolve(root, '../..');
const originalRoot = path.resolve(root, '../诡异药剂师_MVU_v0.14');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
let checks = 0;
const ok = (condition, message) => { checks++; if (!condition) throw new Error(message); };
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    ['node_modules', '.git'].includes(entry.name) ? [] : entry.isDirectory()
      ? files(path.join(dir, entry.name)) : [path.join(dir, entry.name)]).sort();
}
for (const baseline of json('合并记录/只读基线.json')) {
  const dir = path.join(workspace, baseline.root);
  const list = files(dir);
  const hash = crypto.createHash('sha256');
  let bytes = 0;
  for (const file of list) {
    const body = fs.readFileSync(file); bytes += body.length;
    hash.update(path.relative(dir, file).replaceAll('\\', '/') + '\0'); hash.update(body); hash.update('\0');
  }
  ok(list.length === baseline.files && bytes === baseline.bytes && hash.digest('hex') === baseline.sha256, `只读源发生变化：${baseline.root}`);
}
for (const name of fs.readdirSync(path.join(root, 'src/events'))) {
  const match = name.match(/^E(\d+)_.*\.md$/u);
  if (match && Number(match[1]) <= 317) ok(read(`src/events/${name}`) === fs.readFileSync(path.join(originalRoot, 'src/events', name), 'utf8'), `早期事件被修改：${name}`);
}
for (const file of ['src/initial_variables.json', 'src/initial_variables_e25.json', 'src/scripts/schema.js', 'src/scripts/mvu_loader.js', 'src/regex_scripts.json', 'src/prompts/first_message.md', 'src/prompts/alternate_greeting_e25.md']) {
  ok(read(file) === fs.readFileSync(path.join(originalRoot, file), 'utf8').replaceAll('0.14.0', '0.15.0').replaceAll('v0.14', 'v0.15'), `未授权的状态或加载器变更：${file}`);
}

const contract = json('contract.json');
const book = json('src/worldbook.json');
const manifest = json('manifest.json');
const packed = json(manifest.packed_json).data;
ok(contract.required.core_characters.length === 28, '核心人数应保持28');
ok(Object.keys(contract.required.optional_characters).length === 6, '应登记6名可选NPC');
ok(book.entries.length === 1009 && packed.character_book.entries.length === 1009, '1009条世界书源码/产物不一致');
ok(book.entries.some(entry => entry.id === 306 && entry.content_file === 'src/prompts/minor_npcs.md'), '现场协作者未注册');

const initial = json('src/initial_variables.json');
const sequence = contract.required.event_ids;
function localsFor(current, state = '完成') {
  const stat = structuredClone(initial);
  for (const id of sequence) stat.事件.锚点状态[id].状态 = Number(id.slice(1)) < current ? '完成' : Number(id.slice(1)) === current ? state : '未触发';
  return { getvar: (key, options = {}) => key.split('.').reduce((object, part) => object?.[part], { stat_data: stat }) ?? options.defaults };
}
const npcFiles = contract.required.optional_characters['奈奈子'].content_files;
// 精简NPC仍逐事件揭示；单独切换每个锚点，防止累积进度掩盖提前泄露。
const compactNpcFacts = {
  智脑: { E319: '不再向肃正议会提交', E321: '设置自动化炮击', E323: '随后被禁锢', E331: '不愿再被安排', E340: '七神已宣布她们叛乱', E342: '无法定位人偶家' },
  视界之主: { E335: '必须签署和约才生效', E336: '旧神七人组', E337: '虽未签约', E338: '被小丑一拳轰塌', E344: '跪在队列末端' },
  老人: { E344: '苍蓝领域的引路老人', E345: '篱笆外提示', E346: '有权知道并获得答案', E347: '建造者比紫罗兰大君更早', E348: '分魂渡鸦' },
};
for (const [name, facts] of Object.entries(compactNpcFacts)) {
  const content = read(`src/characters/${name}/NPC.md`);
  for (const old of ['角色速览', '基础信息', '性格调色盘', '三面性', '多阶段人设', '二次解释']) {
    ok(!fs.existsSync(path.join(root, `src/characters/${name}/${old}.md`)), `${name}残留旧组件：${old}`);
  }
  for (const [event, fact] of Object.entries(facts)) {
    for (const state of ['未触发', '预兆', '活跃', '完成', '变形', '取消']) {
      const output = ejs.render(content, { getvar: key => key === `stat_data.事件.锚点状态.${event}.状态` ? state : '未触发' });
      ok(output.includes(fact) === ['完成', '变形'].includes(state), `${name} ${event} ${state}信息门槛错误`);
    }
  }
}
for (const file of npcFiles) {
  for (const current of [343, 344, 345]) ok(!ejs.render(read(file), localsFor(current)).includes('奈奈子'), `实名提前泄露：${file} E${current}`);
  ok(ejs.render(read(file), localsFor(346)).includes('奈奈子'), `E346实名未开放：${file}`);
}

// 运行现有路由而非复制算法；确认NPC可走事件窗，并拒绝外部世界书与重复UID。
const router = read('src/prompts/concept_event_router.md').replace(/^@@preprocessing\s*/u, '');
const runtimeEntries = book.entries.filter(entry => entry.enabled !== false).map(entry => ({ ...entry, uid: entry.id, world: 'integration-test' }));
const foreign = { ...runtimeEntries.find(entry => entry.id === 301), world: 'unrelated-world' };
for (let current = 318; current <= 348; current++) {
  const calls = [];
  await ejs.render(router, {
    ...localsFor(current, '活跃'),
    getEnabledWorldInfoEntries: async () => [...runtimeEntries, foreign, runtimeEntries.find(entry => entry.id === 301)],
    activewi: async (world, uid, force) => { calls.push({ world, uid: Number(uid), force }); },
  }, { async: true });
  ok(calls.every(call => call.world === 'integration-test'), `E${current}激活了其他世界书`);
  ok(new Set(calls.map(call => `${call.world}:${call.uid}`)).size === calls.length, `E${current}重复激活UID`);
  for (const [name, npc] of Object.entries(contract.required.optional_characters)) {
    const expected = npc.event_ids.some(id => Math.abs(sequence.indexOf(id) - sequence.indexOf(`E${current}`)) <= 1);
    ok(calls.some(call => call.uid === npc.entry_id) === expected, `${name} E${current}事件窗激活不一致`);
  }
}

for (const entry of book.entries.filter(entry => entry.extensions?.tavernweave?.route_kind === 'optional_npc' || entry.id === 306)) {
  const normalized = file => read(file).replace(/^\uFEFF/u, '').replace(/\r\n/g, '\n').trim();
  const content = entry.content_files ? entry.content_files.map(normalized).join('\n\n') : normalized(entry.content_file);
  ok(content === packed.character_book.entries.find(item => item.id === entry.id)?.content, `${entry.comment}产物内容不一致`);
  for (const state of ['未触发', '预兆', '活跃', '完成', '变形', '取消']) ok(typeof ejs.render(content, localsFor(348, state)) === 'string', `${entry.comment}状态渲染失败`);
}
console.log(JSON.stringify({ status: 'passed', checks, core_characters: 28, optional_npcs: 6, worldbook_entries: 1009, real_host_acceptance: 'pending' }, null, 2));
