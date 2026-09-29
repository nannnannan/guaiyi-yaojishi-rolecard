import fs from 'node:fs';

const keywordMap = {
  2676: ["原子革命", "祭品飞升", "地狱锁", "以太例外"],
  2677: ["上传芯片", "灭绝者", "截芯", "意识上传"],
  2678: ["无序拖带", "冲心倍扩", "无序化"],
  2679: ["劝服测试", "七神窗口", "吞噬升神"],
  2680: ["恒星矩阵", "原初封印", "封印钥匙", "巨构"],
  2681: ["绝对理智之神", "七神权限", "权限扩容"],
  2682: ["血肉农场", "物质极限", "五台巨构"],
  2683: ["莫比乌斯环", "虚拟维度", "万机再现"],
  2684: ["暂时升神", "神降烬灭", "临时升格"],
  2685: ["光门吸噬", "格式塔锁核", "五台光门"],
  2686: ["神灵级傀儡", "魂丝吸力", "人偶傀儡"],
  2687: ["以太牢笼", "初诞权限", "权限锚"],
  2688: ["心灵之海", "以太精神世界", "心灵之锚"],
  2689: ["万姬升神", "叹息之墙", "升神召回"],
  2690: ["三位一体机", "银幻归心", "临时容器"],
  2691: ["第二次大坠落", "梦境方舟", "方舟策略"],
  2692: ["时间战争", "五十四次奖励", "时间战争规则"],
  2693: ["新神计划", "初诞容器", "玻璃珠容器"],
  2694: ["鲜血孽灵", "禁术变身", "血渴循环"],
  2695: ["渡鸦节点", "时间外入侵", "节点遗迹"],
  2696: ["三招赌约", "因果压制", "时间压制"],
  2697: ["二十一万年前", "宿命闭环", "空间规则"],
  2698: ["黑袍挑战链", "夏娃战书", "镜像试炼"],
  2699: ["私藏试探", "身份坐实", "撕破伪装"],
  2700: ["创造规则", "万物神王", "镜像决斗"],
  2701: ["法则切磋", "同路人同盟", "攻守同盟"],
  2702: ["南方坠落者联盟", "圣安娜", "金矛"],
  2703: ["主母之战", "假死囚禁", "系统空间"],
  2704: ["第二只渡鸦", "达摩克利斯", "渡鸦误导"],
  2705: ["地狱争霸", "心灵之海起航", "心灵之海"]
};

const wbPath = 'src/worldbook.json';
const wb = JSON.parse(fs.readFileSync(wbPath, 'utf8'));

let count = 0;
for (const entry of wb.entries) {
  if (keywordMap[entry.id]) {
    const rawTitle = entry.comment.replace(/^\[概念·[^\]]+\]/, '');
    const cleanKeys = [...keywordMap[entry.id]];
    if (!cleanKeys.includes(rawTitle)) {
      cleanKeys.push(rawTitle);
    }
    entry.keys = cleanKeys;
    count++;
    console.log(`Updated [${entry.id}] ${entry.comment} -> keys:`, JSON.stringify(entry.keys));
  }
}

fs.writeFileSync(wbPath, JSON.stringify(wb, null, 2) + '\n', 'utf8');
console.log(`Successfully updated ${count} concept entries in ${wbPath}`);
