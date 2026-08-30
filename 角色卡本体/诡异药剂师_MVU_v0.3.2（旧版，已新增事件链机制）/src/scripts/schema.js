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
      console.warn(`[诡异药剂师v0.32] Zod 桥接加载失败，尝试备用源：${url}`, error);
    }
  }
  throw lastError ?? new Error('registerMvuSchema 不可用');
}

const score = z.coerce.number().transform(value => _.clamp(Math.round(value), 0, 100));
const shortText = z.string().max(320);
const mediumText = z.string().max(800);
const shortList = z.array(z.string().max(200)).max(16);
const eventState = z.enum(['未触发', '预兆', '活跃', '变形', '完成', '取消']);
const survivalState = z.enum(['活动', '受伤', '失联', '受困', '休眠', '暂离', '敌对']);
const phaseNames = {
  S0: '药店接管期',
  S1: '怪物客户建立期',
  S2: '血衣与药剂风波期',
  S3: '魔人协会冲突期',
  S4: '猎头者家庭与师徒归来期',
};
const anchorTitles = {
  E01: '血娃娃上门',
  E02: '猪头魔与恶灵血婴',
  E03: '小小夜间牙科',
  E04: '血衣女士寻子',
  E05: '暴击药剂副作用扩散',
  E06: '血衣女士宴会与诅咒治疗',
  E07: '血肉傀儡追杀、小宝贝支援与左左诞生',
  E08: '猎杀者夜袭与情报转折',
  E09: '械魔进攻',
  E10: '噬心魔出击与魔人协会覆灭',
  E11: '猎头者家庭记忆与契约',
  E12: '师徒归来与阶段收束',
};

function relationship(options = {}) {
  const attraction = options.attractionLocked
    ? z.literal(0)
    : score;
  const evil = options.evilLocked
    ? z.literal(0)
    : score;
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
    可见迹象: shortList,
    边界: mediumText,
    关键记忆: shortList,
    最近互动: mediumText,
  });
}

const anchor = z.object({
  标题: z.string().max(120),
  状态: eventState,
});

const activeEvent = z.object({
  事件ID: z.enum(['E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08', 'E09', 'E10', 'E11', 'E12', '']),
  标题: z.string().max(140),
  地点: shortText,
  参与者: shortList,
  状态: z.enum(['活跃', '变形', '无']),
  紧迫度: z.enum(['无', '低', '中', '高', '极高']),
  模糊期限: shortText,
  进展: mediumText,
  幕后停止点: mediumText,
});

const omen = z.object({
  事件ID: z.enum(['E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08', 'E09', 'E10', 'E11', 'E12', '']),
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
    卡名: z.literal('《诡异药剂师》v0.32'),
    版本: z.literal('0.32.0'),
  }),
  世界: z.object({
    阶段编号: z.enum(['S0', 'S1', 'S2', 'S3', 'S4']),
    阶段名称: z.enum(['药店接管期', '怪物客户建立期', '血衣与药剂风波期', '魔人协会冲突期', '猎头者家庭与师徒归来期']),
    模糊阶段进度: z.enum(['初期', '推进中', '后期', '收束']),
    当前场景时间: shortText,
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
    }),
    唯一活跃事件: activeEvent,
    近期预兆: omen,
    最近结果: z.array(result).max(12),
    阶段总结: z.array(z.string().max(1000)).max(5),
    原创重大事件待定队列: z.array(pendingEvent).max(6),
  }),
  关系: z.object({
    左左: relationship({ evilLocked: false }),
    血锯: relationship({ attractionLocked: true, evilLocked: true }),
    血衣女士: relationship(),
    小小: relationship({ attractionLocked: true, evilLocked: true }),
    人偶夫人: relationship(),
    泰坦头颅: relationship({ attractionLocked: true, evilLocked: true }),
    巫神头颅: relationship({ attractionLocked: true }),
    小宝贝: relationship({ attractionLocked: true, evilLocked: true }),
  }),
  角色关系: z.array(relationEdge).max(24),
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

  const activeAnchors = Object.entries(data.事件.锚点状态)
    .filter(([, value]) => value.状态 === '活跃' || value.状态 === '变形');
  const activeEvent = data.事件.唯一活跃事件;
  const activeStateIsEmpty = activeEvent.状态 === '无';
  const activeMatches = activeAnchors.length === 1
    && activeAnchors[0][0] === activeEvent.事件ID
    && activeAnchors[0][1].状态 === activeEvent.状态;
  if ((activeStateIsEmpty && (activeAnchors.length !== 0 || activeEvent.事件ID !== ''))
      || (!activeStateIsEmpty && !activeMatches)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['事件', '唯一活跃事件'],
      message: '重大事件必须唯一活跃，并与锚点状态一致',
    });
  }

  for (const [eventId, title] of Object.entries(anchorTitles)) {
    if (data.事件.锚点状态[eventId].标题 !== title) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['事件', '锚点状态', eventId, '标题'],
        message: `${eventId}标题必须保持稳定`,
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

  const omenId = data.事件.近期预兆.事件ID;
  if (omenId && data.事件.锚点状态[omenId].状态 !== '预兆') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['事件', '近期预兆', '事件ID'],
      message: '近期预兆必须指向处于预兆状态的锚点',
    });
  }

  if (data.关系.小小.恶堕 !== 0 || data.关系.小小.吸引 !== 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['关系', '小小'],
      message: '小小吸引与恶堕恒为0',
    });
  }
});

const registerMvuSchema = await loadSchemaBridge();

$(() => {
  registerMvuSchema(Schema);
});
