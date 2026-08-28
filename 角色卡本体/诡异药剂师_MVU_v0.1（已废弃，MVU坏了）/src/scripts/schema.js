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
      console.warn(`[诡异药剂师] Zod 桥接加载失败，尝试备用源：${url}`, error);
    }
  }
  throw lastError ?? new Error('registerMvuSchema 不可用');
}

const score = z.coerce.number().transform(value => _.clamp(value, -100, 100));
const shortText = z.string().max(300);
const shortList = z.array(z.string().max(160)).max(12);

const relationship = z.object({
  解锁: z.boolean(),
  在场: z.boolean(),
  关系类型: z.string().max(80),
  可见阶段: z.string().max(80),
  信任: score,
  亲近: score,
  戒备: score,
  吸引: score,
  关系创伤: score,
  可见迹象: shortList,
  边界: z.string().max(240),
  关键记忆: shortList,
  最近互动: z.string().max(240),
});

const event = z.object({
  标题: z.string().max(80),
  状态: z.enum(['进行中', '暂停', '完成', '放弃']),
  摘要: z.string().max(360),
});

const Schema = z.object({
  元数据: z.object({
    卡名: z.literal('《诡异药剂师：血锯药剂店》v0.1'),
    版本: z.literal('0.1.0'),
  }),
  世界: z.object({
    日期: shortText,
    时间: shortText,
    地点: shortText,
    氛围: shortText,
  }),
  林恩: z.object({
    年龄: z.literal(20),
    身体状况: shortText,
    当前身份: shortList,
    最近明确指令: z.string().max(500),
  }),
  病例: z.object({
    阶段: z.enum(['接诊', '诊断', '方案', '观察', '结束']),
    病患: shortText,
    主诉: shortText,
    已知线索: shortList,
    玩家诊断: shortText,
    已选方案: shortText,
    最近进展: z.string().max(500),
  }),
  事件: z.object({
    主事件: event,
    支线: z.array(event).max(2),
    已完成: z.array(event).max(20),
  }),
  关系: z.object({
    左左: relationship,
    血锯: relationship,
    血衣女士: relationship,
    小小: relationship,
    人偶夫人: relationship,
    爱丽丝: relationship,
    黑弦月: relationship,
  }),
  系统: z.object({
    当前任务: shortText,
    任务状态: z.enum(['进行中', '暂停', '完成', '无']),
    任务说明: z.string().max(500),
    最近提示: z.string().max(500),
    更新模式: z.enum(['同轮更新；可选独立预设']),
  }),
});

const registerMvuSchema = await loadSchemaBridge();

$(() => {
  registerMvuSchema(Schema);
});
