@@preprocessing
<%_
await (async () => {
  const eventSequence = ["E01","E02","E03","E04","E05","E06","E07","E08","E09","E10","E11","E12","E13","E14","E15","E16","E17","E18","E19","E20","E21","E22","E23","E24","E25","E26","E27","E28","E29","E30","E31","E32","E33","E34","E35"];
  // CHARACTER_EVENT_FALLBACK_START
  const characterEventFallback = new Map([
    [100,["E11","E12","E18","E20","E22","E23","E24","E26","E33","E35"]],
    [110,["E01","E18","E20","E21","E26","E29"]],
    [120,["E07","E09","E11","E12","E13"]],
    [130,["E05","E15","E16","E17","E18","E19","E34"]],
    [140,["E15","E18","E20"]],
    [150,["E22","E23","E24","E25","E26","E28"]],
    [160,["E22","E23","E24","E25","E26","E27","E35"]],
    [170,["E15","E16","E17","E18","E19","E34"]],
    [180,["E15","E16","E17","E19","E34"]],
    [190,["E01","E11"]],
    [200,["E34"]],
    [210,["E33","E34"]],
    [220,["E30","E31","E32","E33"]],
    [230,["E30","E31","E32"]],
    [240,["E25","E26","E32"]],
    [250,["E25","E28","E30","E31","E32","E34"]],
    [260,["E32"]]
  ]);
  // CHARACTER_EVENT_FALLBACK_END
  let currentIndex = -1;

  for (let i = 0; i < eventSequence.length; i++) {
    const state = getvar("stat_data.事件.锚点状态." + eventSequence[i] + ".状态", { defaults: "未触发" });
    if (state === "活跃") {
      currentIndex = i;
      break;
    }
  }

  if (currentIndex === -1) {
    const omenId = getvar("stat_data.事件.近期预兆.事件ID", { defaults: "" });
    const omenIndex = eventSequence.indexOf(omenId);
    if (omenIndex >= 0) currentIndex = Math.max(0, omenIndex - 1);
  }

  if (currentIndex === -1) {
    for (let i = eventSequence.length - 1; i >= 0; i--) {
      const state = getvar("stat_data.事件.锚点状态." + eventSequence[i] + ".状态", { defaults: "未触发" });
      if (state === "完成" || state === "变形" || state === "取消") {
        currentIndex = i;
        break;
      }
    }
  }

  if (currentIndex === -1) currentIndex = 0;

  const entries = await getEnabledWorldInfoEntries();
  const routeWorlds = new Set(entries
    .filter(entry => Number(entry?.uid) === 399 && String(entry?.comment ?? "") === "[机制]事件内容激活路由")
    .map(entry => String(entry?.world ?? "")));
  const activated = new Set();
  for (const entry of entries) {
    if (!routeWorlds.has(String(entry?.world ?? ""))) continue;
    const uid = Number(entry?.uid);
    const isCharacter = characterEventFallback.has(uid);
    let eventIds = entry?.extensions?.tavernweave?.event_ids;

    if (!Array.isArray(eventIds) && isCharacter) eventIds = characterEventFallback.get(uid);
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

    const inDetailWindow = eventIds.some(eventId => {
      const eventIndex = eventSequence.indexOf(eventId);
      return eventIndex >= 0 && Math.abs(eventIndex - currentIndex) <= 1;
    });
    if (!inDetailWindow) continue;

    const activationKey = String(entry?.world ?? "") + ":" + String(entry?.uid ?? "");
    if (activated.has(activationKey)) continue;
    activated.add(activationKey);
    await activewi(entry.world, entry.uid, true);
  }
})();
_%>
