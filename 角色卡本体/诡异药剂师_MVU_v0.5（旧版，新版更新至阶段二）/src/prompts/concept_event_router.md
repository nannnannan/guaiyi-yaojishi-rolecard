@@preprocessing
<%_
const __conceptEventSequence = ["E01","E02","E03","E04","E05","E06","E07","E08","E09","E10","E11","E12","E13","E14","E15","E16","E17","E18","E19","E20"];
let __conceptCurrentIndex = -1;

for (let i = 0; i < __conceptEventSequence.length; i++) {
  const state = getvar("stat_data.事件.锚点状态." + __conceptEventSequence[i] + ".状态", { defaults: "未触发" });
  if (state === "活跃") {
    __conceptCurrentIndex = i;
    break;
  }
}

if (__conceptCurrentIndex === -1) {
  const omenId = getvar("stat_data.事件.近期预兆.事件ID", { defaults: "" });
  const omenIndex = __conceptEventSequence.indexOf(omenId);
  if (omenIndex >= 0) __conceptCurrentIndex = omenIndex - 1;
}

if (__conceptCurrentIndex === -1) {
  for (let i = __conceptEventSequence.length - 1; i >= 0; i--) {
    const state = getvar("stat_data.事件.锚点状态." + __conceptEventSequence[i] + ".状态", { defaults: "未触发" });
    if (state === "完成" || state === "变形" || state === "取消") {
      __conceptCurrentIndex = i;
      break;
    }
  }
}

if (__conceptCurrentIndex === -1) __conceptCurrentIndex = 0;

const __conceptEntries = await getEnabledWorldInfoEntries();
for (const entry of __conceptEntries) {
  let eventIds = entry?.extensions?.tavernweave?.event_ids;
  if (!Array.isArray(eventIds)) {
    const titleMatch = String(entry?.content ?? "").match(/^# 概念·[^\r\n]+（事件(\[[^\r\n]+\])）/);
    if (titleMatch) {
      try {
        const parsed = JSON.parse(titleMatch[1]);
        if (Array.isArray(parsed)) eventIds = parsed;
      } catch {}
    }
  }
  if (!Array.isArray(eventIds)) continue;
  const inEventWindow = eventIds.some(eventId => {
    const eventIndex = __conceptEventSequence.indexOf(eventId);
    return eventIndex >= 0 && Math.abs(eventIndex - __conceptCurrentIndex) <= 3;
  });
  if (inEventWindow) await activewi(entry.world, entry.uid, true);
}
_%>
