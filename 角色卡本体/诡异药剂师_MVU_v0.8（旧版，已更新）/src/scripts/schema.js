const BRIDGE_URLS = [
  'https://cdn.jsdelivr.net/gh/StageDog/tavern_resource@7f29257de3ffbd83d63bc37ca09f4d4ecad6ca0f/dist/util/mvu_zod.js',
  'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource@7f29257de3ffbd83d63bc37ca09f4d4ecad6ca0f/dist/util/mvu_zod.js',
];

async function loadSchemaBridge() {
  let lastError;
  for (const url of BRIDGE_URLS) {
    try {
      const module = await import(url);
      if (typeof module.registerMvuSchema === 'function') {
        return module.registerMvuSchema;
      }
    } catch (error) {
      lastError = error;
      console.warn(`[诡异药剂师v0.8] Zod 桥接加载失败，尝试备用源：${url}`, error);
    }
  }
  throw lastError ?? new Error('registerMvuSchema 不可用');
}

const score = z.coerce.number().transform(value => _.clamp(Math.round(value), 0, 100));
const shortText = z.string().max(320);
const mediumText = z.string().max(800);
const shortList = z.array(z.string().max(200)).max(16);
const sceneTime = shortText.refine(
  value => !/(?:星期[一二三四五六日天]|周[一二三四五六日天]|(?:第\s*)?(?:\d+|[一二三四五六七八九十百千万]+|好几|好多|很多|数|几|多)\s*天|昨天|昨日|昨夜|今天|今日|今早|今晨|明天|明日|次日|翌日|第二天|\d{4}\s*[-/.年]\s*\d{1,2}\s*[-/.月]\s*\d{1,2}\s*日?|\d{1,2}月\d{1,2}日)/.test(value),
  '场景时间只能使用事件标签与相对时段，不得写星期、精确日期、X天时长或昨天/昨日/昨夜/今天/今日/今早/今晨/明天/明日/次日/翌日/第二天',
);
const eventState = z.enum(['未触发', '预兆', '活跃', '变形', '完成', '取消']);
const survivalState = z.enum(['活动', '受伤', '失联', '受困', '休眠', '暂离', '敌对']);
const phaseNames = {
  S0: '药店接管期',
  S1: '怪物客户建立期',
  S2: '血衣与药剂风波期',
  S3: '魔人协会冲突期',
  S4: '猎头者家庭与师徒归来期',
  S5: '幸福之家与独立行医期',
  S6: '夜医启程与寂静镇灾变期',
  S7: '黑夜城授职与跨界伏笔期',
  S8: '蓝星召唤与寻亲期',
  S9: '黑夜城成长与人偶线期',
  S10: '宗教战争与疫医伪装期',
  S11: '疫医潜入与纳米风暴期',
  S12: '万机之神降临与根源混战期',
  S13: '战后修复与机械总攻期',
};
const anchorTitles = {
  E01: '系统觉醒与开店',
  E02: '血娃娃上门与找妈妈任务',
  E03: '猪头魔与恶灵血婴',
  E04: '猎魔人治疗与传说左轮',
  E05: '不眠夜与小小牙科',
  E06: '诅咒清除能力与鬼婴塑形',
  E07: '血衣寻子与鬼婴萌化化解',
  E08: '暴击药剂与视界曝光',
  E09: '血衣鸿门宴与诅咒绑定',
  E10: '视界经营与玥玥治疗',
  E11: '血夜地狱行者与左左诞生',
  E12: '血肉灾变与左手共存',
  E13: '猎杀者夜袭与信使线',
  E14: '瘦长鬼影手术与024诊断',
  E15: '求援信与小小赴约',
  E16: '械魔大军与猎神者',
  E17: '小小介绍棒医生',
  E18: '倒吊塔决战与协会覆灭',
  E19: '猎头者家族绑定',
  E20: '师徒归来与阶段收束',
  E21: '魔鬼训练与首次独立出诊',
  E22: '幸福之家的血肉晚宴',
  E23: '异域同乡与爱丽丝初愈',
  E24: '诅咒复燃与古堡围猎',
  E25: '双面伯爵与心脑之汤',
  E26: '爱丽丝重生与母女终局',
  E27: '白逸遣返与九州异变',
  E28: '爱丽丝日常与十四病战蜥',
  E29: '传奇赠药与夜医启程',
  E30: '血月狼群与寂静镇试诊',
  E31: '哭泣小丑与血肉灾变',
  E32: '小丑余波与夜医接纳',
  E33: '夜医试炼与白夜旧梦',
  E34: '倒吊天使与夜医授职',
  E35: '左左拟化与蓝星鬼袭',
  E36: '左左醉酒与酒店暧昧',
  E37: '白逸召唤降临与总局清剿',
  E38: '审问王蓓与根源关系网',
  E39: '暴食血祭与血娃娃回收',
  E40: '户籍锁定与血娃娃共情',
  E41: '白家休整与机械造物',
  E42: '跳车寻母与林樱初遇',
  E43: '回归汇报与被收教子',
  E44: '盗版史诗药剂与巨像脑情报',
  E45: '召唤四阶段与无瞳法阵',
  E46: '拟化惩罚与踢裆反杀',
  E47: '群星圣堂实习与误麻院长',
  E48: '接诊喵喵与002盗书',
  E49: '犬皮改造真相与千人寻亲',
  E50: '猫娘药剂与喵喵破茧',
  E51: '黑弦月到货与保护契约',
  E52: '森一夜袭与四次重生',
  E53: '三重算计与平等契约',
  E54: '疫医暗面与最高级保护',
  E55: '喵喵宠物与家人复仇',
  E56: '史莱姆整形与游荡者情报',
  E57: '整备出征与收编小宝贝',
  E58: '前线观战与银色幻想降临',
  E59: '斩臂反击与三根源驰援',
  E60: '圣子推定与圣徒叛变',
  E61: '突围反杀与夺萃之镰',
  E62: '折跃入城与疫医伪装',
  E63: '堡垒解围与欲望教派',
  E64: '诅咒之城余韵（开放钩子）',
  E65: '疫医X博士潜入与指挥官拉拢示爱',
  E66: '电钻充能暴走与人偶情感暴涨',
  E67: '纳米风暴追杀与快感冲击蜂巢',
  E68: '血肉养蛊与病毒反噬纳米风暴',
  E69: '黑弦月签人偶之誓',
  E70: '撤离堡垒揭巨像之心',
  E71: '设伏反打银色幻想',
  E72: '核爆硬抗捕获机械姬',
  E73: '猎魔左轮处决与破防全部失败',
  E74: '快感冲击逼供缴双剑与龙狙',
  E75: '触发恶堕向机械姬调教任务',
  E76: '全城机械紊乱与死星结晶交易',
  E77: '万机之神投影降临贯穿取心',
  E78: '巨像网络苏醒与捣翻万机之神',
  E79: '黑弦月只身赴死与求婚被拒',
  E80: '直死书与六诅咒同归于尽',
  E81: '黑弦月肉身挡轰炸与解雇无效',
  E82: '白发异变与虚握差杀万机之神',
  E83: '艾雯爵士救场与八音盒扰泰坦',
  E84: '吞钱逼斗志与认义弟立执念',
  E85: '强吻黑弦月遭漏电惩罚',
  E86: '工伤条款强制治疗黑弦月',
  E87: '锁与钥匙比喻诱骗左左签据',
  E88: '恒星熔炉锻造人偶之臂',
  E89: '求左左做爱解诅咒被拒',
  E90: '救回乱流深处的恶灵妹妹',
  E91: '妹妹误触性释放与骨科召唤',
  E92: '诱捕左左强行性释放解咒',
  E93: '入视界建群与喵喵参战',
  E94: '三蜂巢饱和轰炸与母树降临',
  E95: '银色幻想恨意暴增与总攻',
  E96: '待续钩子（开放钩子）',
};

const eventIds = [
  'E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08', 'E09', 'E10',
  'E11', 'E12', 'E13', 'E14', 'E15', 'E16', 'E17', 'E18', 'E19', 'E20',
  'E21', 'E22', 'E23', 'E24', 'E25', 'E26', 'E27', 'E28', 'E29', 'E30',
  'E31', 'E32', 'E33', 'E34', 'E35', 'E36', 'E37', 'E38', 'E39', 'E40',
  'E41', 'E42', 'E43', 'E44', 'E45', 'E46', 'E47', 'E48', 'E49', 'E50',
  'E51', 'E52', 'E53', 'E54', 'E55', 'E56', 'E57', 'E58', 'E59', 'E60',
  'E61', 'E62', 'E63', 'E64', 'E65', 'E66', 'E67', 'E68', 'E69', 'E70',
  'E71', 'E72', 'E73', 'E74', 'E75', 'E76', 'E77', 'E78', 'E79', 'E80',
  'E81', 'E82', 'E83', 'E84', 'E85', 'E86', 'E87', 'E88', 'E89', 'E90',
  'E91', 'E92', 'E93', 'E94', 'E95', 'E96', '',
];

function relationship(options = {}) {
  const attraction = options.attractionLocked
    ? z.literal(0)
    : score;
  const evil = options.evilLocked
    ? z.literal(0)
    : score;
  const lewdness = options.attractionLocked
    ? z.literal(0)
    : score;
  const emotional = options.emotionalOpen ? score : z.literal(0);
  const tame = options.a01Open ? score : z.literal(0);
  const collapse = options.a01Open ? score : z.literal(0);
  const hatred = options.a01Open ? score : z.literal(0);
  return z.object({
    解锁: z.boolean(),
    在场: z.boolean(),
    生存状态: survivalState,
    位置: shortText,
    处境: mediumText,
    关系类型: shortText,
    人物阶段: shortText,
    好感: score,
    信赖: score,
    戒备: score,
    吸引: attraction,
    关系创伤: score,
    恶堕: evil,
    涩涩度: lewdness,
    情感开发度: emotional,
    驯服度: tame,
    崩坏值: collapse,
    恨意值: hatred,
    可见迹象: shortList,
    边界: mediumText,
    关键记忆: shortList,
    最近互动: mediumText,
  });
}

const anchor = z.object({
  标题: z.string().max(120),
  状态: eventState,
  收尾: z.boolean(),
});

const activeEvent = z.object({
  事件ID: z.enum(eventIds),
  标题: z.string().max(140),
  地点: shortText,
  参与者: shortList,
  状态: z.enum(['活跃', '无']),
  紧迫度: z.enum(['无', '低', '中', '高', '极高']),
  模糊期限: shortText,
  进展: mediumText,
  幕后停止点: mediumText,
});

const omen = z.object({
  事件ID: z.enum(eventIds),
  方向: mediumText,
  地点: shortText,
  参与者: shortList,
  紧迫度: z.enum(['无', '低', '中', '高', '极高']),
  模糊期限: shortText,
});

const result = z.object({
  事件ID: z.string().max(16),
  标题: z.string().max(140),
  结果: mediumText,
  世界影响: mediumText,
});

const pendingEvent = z.object({
  标题: z.string().max(140),
  长期影响: mediumText,
  前置条件: mediumText,
  紧迫度: z.enum(['低', '中', '高']),
});

const relationEdge = z.object({
  双方: z.tuple([z.string().max(40), z.string().max(40)]),
  关系类型: shortText,
  当前状态: mediumText,
  公开程度: z.enum(['林恩未知', '仅当事人知情', '局部公开', '公开']),
  最近变化: mediumText,
});

const Schema = z.object({
  元数据: z.object({
    卡名: z.literal('《诡异药剂师》v0.8'),
    版本: z.literal('0.8.0'),
  }),
  世界: z.object({
    阶段编号: z.enum(['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12', 'S13']),
    阶段名称: z.enum(['药店接管期', '怪物客户建立期', '血衣与药剂风波期', '魔人协会冲突期', '猎头者家庭与师徒归来期', '幸福之家与独立行医期', '夜医启程与寂静镇灾变期', '黑夜城授职与跨界伏笔期', '蓝星召唤与寻亲期', '黑夜城成长与人偶线期', '宗教战争与疫医伪装期', '疫医潜入与纳米风暴期', '万机之神降临与根源混战期', '战后修复与机械总攻期']),
    模糊阶段进度: z.enum(['初期', '推进中', '后期', '收束']),
    当前场景时间: sceneTime,
    地点: shortText,
    氛围: mediumText,
    大局线索: shortList,
  }),
  林恩: z.object({
    年龄: z.literal(17),
    身体状况: mediumText,
    当前身份: shortList,
    等级: z.number().int().min(1).max(999),
    技能: shortList,
    成就: shortList,
    图鉴已解锁: shortList,
    关键诅咒或契约: shortList,
    当前明确目标: mediumText,
    最近明确指令: mediumText,
    压力: score,
    道德: score,
    罪恶: score,
    复苏度: score,
    替死娃娃剩余: z.number().int().min(0).max(999),
    天使之吻状态: z.boolean(),
    根系网络权限: z.boolean(),
    巨像网络权限: z.boolean(),
  }),
  事件: z.object({
    锚点状态: z.object({
      E01: anchor,
      E02: anchor,
      E03: anchor,
      E04: anchor,
      E05: anchor,
      E06: anchor,
      E07: anchor,
      E08: anchor,
      E09: anchor,
      E10: anchor,
      E11: anchor,
      E12: anchor,
      E13: anchor,
      E14: anchor,
      E15: anchor,
      E16: anchor,
      E17: anchor,
      E18: anchor,
      E19: anchor,
      E20: anchor,
      E21: anchor,
      E22: anchor,
      E23: anchor,
      E24: anchor,
      E25: anchor,
      E26: anchor,
      E27: anchor,
      E28: anchor,
      E29: anchor,
      E30: anchor,
      E31: anchor,
      E32: anchor,
      E33: anchor,
      E34: anchor,
      E35: anchor,
      E36: anchor,
      E37: anchor,
      E38: anchor,
      E39: anchor,
      E40: anchor,
      E41: anchor,
      E42: anchor,
      E43: anchor,
      E44: anchor,
      E45: anchor,
      E46: anchor,
      E47: anchor,
      E48: anchor,
      E49: anchor,
      E50: anchor,
      E51: anchor,
      E52: anchor,
      E53: anchor,
      E54: anchor,
      E55: anchor,
      E56: anchor,
      E57: anchor,
      E58: anchor,
      E59: anchor,
      E60: anchor,
      E61: anchor,
      E62: anchor,
      E63: anchor,
      E64: anchor,
      E65: anchor,
      E66: anchor,
      E67: anchor,
      E68: anchor,
      E69: anchor,
      E70: anchor,
      E71: anchor,
      E72: anchor,
      E73: anchor,
      E74: anchor,
      E75: anchor,
      E76: anchor,
      E77: anchor,
      E78: anchor,
      E79: anchor,
      E80: anchor,
      E81: anchor,
      E82: anchor,
      E83: anchor,
      E84: anchor,
      E85: anchor,
      E86: anchor,
      E87: anchor,
      E88: anchor,
      E89: anchor,
      E90: anchor,
      E91: anchor,
      E92: anchor,
      E93: anchor,
      E94: anchor,
      E95: anchor,
      E96: anchor,
    }),
    唯一活跃事件: activeEvent,
    近期预兆: omen,
    最近结果: z.array(result).max(12),
    阶段总结: z.array(z.string().max(1000)).max(8),
    原创重大事件待定队列: z.array(pendingEvent).max(6),
  }),
  关系: z.object({
    左左: relationship(),
    血锯: relationship({ attractionLocked: true, evilLocked: true }),
    血衣女士: relationship(),
    小小: relationship(),
    人偶夫人: relationship(),
    爱丽丝: relationship(),
    白逸: relationship({ attractionLocked: true, evilLocked: true }),
    泰坦头颅: relationship({ attractionLocked: true, evilLocked: true }),
    巫神头颅: relationship({ attractionLocked: true }),
    小宝贝: relationship({ attractionLocked: true, evilLocked: true }),
    倒吊天使: relationship(),
    白夜: relationship({ attractionLocked: true, evilLocked: true }),
    渡鸦: relationship({ attractionLocked: true, evilLocked: true }),
    黑颅: relationship({ attractionLocked: true, evilLocked: true }),
    猪头屠夫: relationship({ attractionLocked: true, evilLocked: true }),
    哭泣小丑: relationship({ attractionLocked: true, evilLocked: true }),
    黑白小丑: relationship({ attractionLocked: true, evilLocked: true }),
    黑弦月: relationship({ emotionalOpen: true }),
    喵喵: relationship(),
    林樱: relationship(),
    艾雯爵士: relationship({ attractionLocked: true, evilLocked: true }),
    羽毛笔: relationship(),
    a01银色幻想: relationship({ a01Open: true }),
    欲望母树: relationship(),
    万机之神: relationship({ attractionLocked: true, evilLocked: true }),
    巨像之脑: relationship(),
    血肉支配者: relationship({ attractionLocked: true, evilLocked: true }),
  }),
  角色关系: z.array(relationEdge),
  系统: z.object({
    当前任务: shortText,
    任务阶段: shortText,
    任务状态: z.enum(['进行中', '暂停', '完成', '无']),
    任务说明: mediumText,
    图鉴: shortList,
    成就: shortList,
    最近提示: mediumText,
    事件通知: mediumText,
    更新模式: z.literal('同轮更新；可选独立预设'),
  }),
}).superRefine((data, ctx) => {
  if (phaseNames[data.世界.阶段编号] !== data.世界.阶段名称) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['世界', '阶段名称'],
      message: '阶段编号与阶段名称不匹配',
    });
  }

  const anchorEntries = Object.entries(data.事件.锚点状态);
  const activeAnchors = anchorEntries.filter(([, value]) => value.状态 === '活跃');
  const activeEvent = data.事件.唯一活跃事件;
  const activeStateIsEmpty = activeEvent.状态 === '无';
  const activeEmptyIsCanonical = activeEvent.事件ID === ''
    && activeEvent.标题 === ''
    && activeEvent.地点 === ''
    && activeEvent.参与者.length === 0
    && activeEvent.紧迫度 === '无'
    && activeEvent.模糊期限 === ''
    && activeEvent.进展 === ''
    && activeEvent.幕后停止点 === '';
  const activeMatches = activeAnchors.length === 1
    && activeAnchors[0][0] === activeEvent.事件ID
    && activeEvent.状态 === '活跃';
  if ((activeStateIsEmpty && (activeAnchors.length !== 0 || !activeEmptyIsCanonical))
      || (!activeStateIsEmpty && !activeMatches)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['事件', '唯一活跃事件'],
      message: '重大事件必须唯一活跃，并与锚点状态一致',
    });
  }

  for (const [eventId, title] of Object.entries(anchorTitles)) {
    const eventAnchor = data.事件.锚点状态[eventId];
    if (eventAnchor.标题 !== title) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['事件', '锚点状态', eventId, '标题'],
        message: `${eventId}标题必须保持稳定`,
      });
    }
    if ((eventAnchor.状态 === '未触发' || eventAnchor.状态 === '预兆') && eventAnchor.收尾) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['事件', '锚点状态', eventId, '收尾'],
        message: `${eventId}未触发或预兆时收尾必须为false`,
      });
    }
    if (['变形', '完成', '取消'].includes(eventAnchor.状态) && !eventAnchor.收尾) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['事件', '锚点状态', eventId, '收尾'],
        message: `${eventId}进入终态时收尾必须为true`,
      });
    }
  }

  if (activeEvent.事件ID && activeEvent.标题 !== anchorTitles[activeEvent.事件ID]) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['事件', '唯一活跃事件', '标题'],
      message: '活跃事件标题与事件ID不匹配',
    });
  }

  const omen = data.事件.近期预兆;
  const omenId = omen.事件ID;
  const omenAnchors = anchorEntries.filter(([, value]) => value.状态 === '预兆');
  const omenEmptyIsCanonical = omenId === ''
    && omen.方向 === ''
    && omen.地点 === ''
    && omen.参与者.length === 0
    && omen.紧迫度 === '无'
    && omen.模糊期限 === '';
  const omenMatches = omenAnchors.length === 1 && omenAnchors[0][0] === omenId;
  if ((!omenId && (omenAnchors.length !== 0 || !omenEmptyIsCanonical))
      || (omenId && !omenMatches)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['事件', '近期预兆', '事件ID'],
      message: '近期预兆必须唯一对应预兆锚点；无预兆时所有详情字段必须清空',
    });
  }
});

const registerMvuSchema = await loadSchemaBridge();

$(() => {
  registerMvuSchema(Schema);
});
