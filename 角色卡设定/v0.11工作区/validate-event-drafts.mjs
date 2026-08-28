import { readFile, readdir } from 'node:fs/promises';

const root = new URL('.', import.meta.url);
const names = (await readdir(root))
  .filter(name => /^事件草稿_P\d+_E\d+-E\d+\.md$/.test(name))
  .sort((a, b) => Number(a.match(/P(\d+)/)[1]) - Number(b.match(/P(\d+)/)[1]));

const failures = [];
const records = [];
const requiredFields = [
  '玩家主权',
  '阶段',
  '地点',
  '前置条件',
  '参与者与动机',
  '默认走向',
  '紧迫度',
  '幕后停止点',
  '变形条件',
  '完成条件',
  '取消条件',
  '结果影响',
  '系统提示',
];
const runtimeMetadata = /第\s*\d+\s*章|小总结|大总结|阶段[一二三四五六七八九十百]+|v0\.11|V0\.11|本版|原文第\s*\d+\s*行/;
const unsafeRuntimePhrases = /萝莉控|师生\s*play|先啪后杀|以身相报|攻略成功|恶堕奖励|调教奖励|\brbq\b/i;

for (const name of names) {
  const text = (await readFile(new URL(name, root), 'utf8')).replace(/\r\n/g, '\n');
  const blocks = [...text.matchAll(/(<%_ const s(\d+) = getvar\("stat_data\.事件\.锚点状态\.E\2\.状态"[\s\S]*?\n<%_ \} _%>)/g)];
  if (blocks.length !== 8) failures.push(name + ' 应含8个事件块，实际' + blocks.length);
  for (const match of blocks) {
    const block = match[1];
    const id = 'E' + match[2];
    const title = block.match(new RegExp('^# ' + id + '·(.+)$', 'm'))?.[1]?.trim() ?? '';
    if (!title) failures.push(name + '/' + id + ' 缺少标题');
    for (const field of requiredFields) {
      const count = (block.match(new RegExp('^- ' + field + '：', 'gm')) ?? []).length;
      if (count !== 1) failures.push(name + '/' + id + ' 字段' + field + '应恰好1次，实际' + count);
    }
    if (id !== 'E218') {
      if (!block.includes('## 下一事件引入（')) failures.push(name + '/' + id + ' 缺下一事件引入');
      for (const field of ['触发时机', '剧情引子', '预兆写法', '承接因果']) {
        if (!new RegExp('^- ' + field + '：', 'm').test(block)) failures.push(name + '/' + id + ' 下一事件缺' + field);
      }
    } else {
      if (/E219|下一事件引入/.test(block)) failures.push(name + '/E218 终点不得创建E219或下一事件钩子');
      if (!block.includes('七使徒已经完成包围') || !block.includes('开启咒瞳') || !block.includes('胜负均尚未发生')) {
        failures.push(name + '/E218 未严格停在七使徒包围、咒瞳开启且胜负未知');
      }
    }
    const direction = block.match(/^- 默认走向：([\s\S]*?)\n- 紧迫度：/m)?.[1] ?? '';
    const chars = direction.replace(/\s/g, '').length;
    if (chars < 200 || chars > 500) failures.push(name + '/' + id + ' 默认走向' + chars + '字，不在200—500');
    const runtime = block.replace(/^<%_[^\n]+\n# [^\n]+\n（本事件尚未进入预兆[\s\S]*?<%_ \} else \{ _%>\n/m, '');
    if (runtimeMetadata.test(runtime)) failures.push(name + '/' + id + ' 运行块含制作元数据');
    if (unsafeRuntimePhrases.test(runtime)) failures.push(name + '/' + id + ' 运行块含禁用性化或奖励化短语');
    if (!/18岁|十八岁/.test(block)) failures.push(name + '/' + id + ' 未声明林恩18岁口径');
    if (!/玩家|林恩.*(决定|输入|主权)|不得替/.test(block)) failures.push(name + '/' + id + ' 玩家主权声明不足');
    records.push({ id, title, chars, file: name });
  }
}

records.sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
const expected = Array.from({ length: 48 }, (_, index) => 'E' + (index + 171));
const actual = records.map(record => record.id);
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  failures.push('事件序列应为E171—E218，实际' + (actual.join(',') || '空'));
}
if (new Set(actual).size !== actual.length) failures.push('事件ID重复');

if (failures.length) {
  console.error(JSON.stringify({ status: 'failed', files: names.length, events: records.length, failures }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    status: 'passed',
    files: names.length,
    events: records.length,
    first: records[0],
    last: records.at(-1),
    default_direction_chars: {
      min: Math.min(...records.map(record => record.chars)),
      max: Math.max(...records.map(record => record.chars)),
    },
  }, null, 2));
}
