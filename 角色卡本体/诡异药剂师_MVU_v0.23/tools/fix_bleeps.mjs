import fs from 'node:fs';

const replacements = [
  {
    file: 'src/characters/人偶夫人/三面性.md',
    from: '“林恩！！你……你这个家伙！！你居然给我灌（哔——）药！！”',
    to: '“林恩！！你……你这个家伙！！你居然给我灌催情媚药！！”',
    fallbackFrom: '"林恩！！你……你这个家伙！！你居然给我灌（哔——）药！！"',
    fallbackTo: '"林恩！！你……你这个家伙！！你居然给我灌催情媚药！！"'
  },
  {
    file: 'src/characters/白夜/性格调色盘.md',
    from: '在前线混战中被林恩的涩涩大哔哔药剂或以M之拳余波波及',
    to: '在前线混战中被林恩的生殖增生药剂或以M之拳余波波及'
  },
  {
    file: 'src/concepts/C583_四合一超级异常药剂.md',
    from: '全员同时长出猫耳、大哔哔、爆浆触手与扭曲肉刺',
    to: '全员同时长出猫耳、粗硕肉茎、爆浆触手与扭曲肉刺'
  },
  {
    file: 'src/concepts/C793_血肉灾变与万恶部位.md',
    from: '她崩溃"你见过哪个正常机械体专门给自己装血肉大哔哔"',
    to: '她崩溃"你见过哪个正常机械体专门给自己装血肉肉棒"'
  },
  {
    file: 'src/concepts/C831_感知放大器与秽体史莱姆药剂.md',
    from: '而是"奇异的大哔哔形状"',
    to: '而是"奇异的粗大肉棒形状"'
  },
  {
    file: 'src/concepts/C923_魅魔外交团.md',
    from: '"我（哔——）了两个男的""我被两个男的（哔——）了"',
    to: '"我强上了两个男的""我被两个男的强暴了"'
  },
  {
    file: 'src/concepts/物品/秽体史莱姆拟化形态药剂.md',
    from: '决定"舍（哔）而娶姑娘"',
    to: '决定"舍排泄恶臭而娶姑娘"'
  },
  {
    file: 'src/events/E56_史莱姆整形与游荡者情报.md',
    from: '因闻着像（哔）被揍，决定“舍（哔）而娶姑娘”',
    to: '因闻着像粪便被揍，决定“舍排泄恶臭而娶姑娘”'
  },
  {
    file: 'src/events/E76_全城机械紊乱与死星结晶交易.md',
    from: '（智脑：“你居然躲在路边的垃圾桶里——（哔——）”）',
    to: '（智脑：“你居然躲在路边的垃圾桶里——你这个混蛋！！”）'
  },
  {
    file: 'src/events/E105_密室除患与全舰生化下毒.md',
    from: '熬出长满猫耳大哔哔还会爆浆的“四合一超级异常药剂”',
    to: '熬出长满猫耳粗硕肉茎还会爆浆的“四合一超级异常药剂”'
  },
  {
    file: 'src/events/E108_第一腔室掀牌与全舰异变灾变.md',
    from: '无数猫耳大哔哔与扭曲肉刺破体而出',
    to: '无数猫耳粗硕肉茎与扭曲肉刺破体而出'
  },
  {
    file: 'src/prompts/mainline.md',
    from: '响指引爆全舰数千疫医长出猫耳大哔哔惨叫震天。',
    to: '响指引爆全舰数千疫医长出猫耳粗硕肉茎惨叫震天。'
  },
  {
    file: 'src/events/E187_样本截获与爬行者接管.md',
    from: '畸变体提示含哔量过高、词库无此组合',
    to: '畸变体提示脏话辱骂量过高、词库无此组合'
  },
  {
    file: 'src/events/E249_血肉灾变与首次涩涩.md',
    from: '她崩溃大叫：“你见过哪个正常的机械体专门给自己安装一个血肉方面的大（哔——）啊！你不想着造个脑子，却造了个这种万恶的东西！”',
    to: '她崩溃大叫：“你见过哪个正常的机械体专门给自己安装一个血肉方面的大肉棒啊！你不想着造个脑子，却造了个这种万恶的东西！”'
  },
  {
    file: 'src/events/E250_现场直播与昏厥的左手.md',
    from: '“其实也不全是——因为他给自己安了个肉做的……”（哔——），荒野回音荡荡',
    to: '“其实也不全是——因为他给自己安了个肉做的大肉棒！”，荒野回音荡荡'
  },
  {
    file: 'src/events/E250_现场直播与昏厥的左手.md',
    from: '也许并不是结束，而是那个女孩……被啪晕了？',
    to: '也许并不是结束，而是那个女孩……被操晕了？'
  },
  {
    file: 'src/events/E292_出兵介入魅魔外交沦陷.md',
    from: '（“我（哔——）了两个男的”“我被两个男的（哔——）了”“我都有……”）',
    to: '（“我强上了两个男的”“我被两个男的强暴了”“我都有……”）'
  },
  {
    file: 'src/events/E306_总攻前夜智脑的路线交易.md',
    from: '（智脑：“你居然躲在路边的垃圾桶里——（哔——）”）',
    to: '（智脑：“你居然躲在路边的垃圾桶里——你这个混蛋！！”）'
  },
  {
    file: 'src/events/E328_主仆欲望与根系吞噬.md',
    from: '母树羞愤反驳：“那你现在还（哔——）我？！”，林恩理直气壮反呛：“（哔——）你和不信任你有什么冲突？！”',
    to: '母树羞愤反驳：“那你现在还在操我？！”，林恩理直气壮反呛：“操你和不信任你有什么冲突？！”'
  },
  {
    file: 'src/events/E511_人偶军团与巨构扩张.md',
    from: '若从系统空间取出平时换用、专门留下的「一根大（哔——）（哔——）」催化脱出（原文删节形态的功能道具／粗口玩笑物，勿扩写成未出现的性行为）',
    to: '若从系统空间取出平时换用、专门留下的「一根粗硕假阳具道具」催化脱出（原文删节形态的功能道具／粗口玩笑物，勿扩写成未出现的性行为）'
  },
  {
    file: 'src/events/E511_人偶军团与巨构扩张.md',
    from: '「大（哔）」仅催化道具',
    to: '「粗硕假阳具」仅催化道具'
  }
];

let applied = 0;
for (const r of replacements) {
  let content = fs.readFileSync(r.file, 'utf8');
  if (content.includes(r.from)) {
    content = content.replace(r.from, r.to);
    fs.writeFileSync(r.file, content, 'utf8');
    applied++;
    console.log('Replaced in ' + r.file);
  } else if (r.fallbackFrom && content.includes(r.fallbackFrom)) {
    content = content.replace(r.fallbackFrom, r.fallbackTo);
    fs.writeFileSync(r.file, content, 'utf8');
    applied++;
    console.log('Replaced (fallback) in ' + r.file);
  } else {
    console.warn('NOT FOUND in ' + r.file + ': ' + r.from);
  }
}
console.log(`Finished: ${applied}/${replacements.length} replacements applied.`);
