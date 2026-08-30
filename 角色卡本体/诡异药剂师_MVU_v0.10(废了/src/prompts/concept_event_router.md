@@preprocessing
<%_
await (async () => {
  const eventSequence = ["E01","E02","E03","E04","E05","E06","E07","E08","E09","E10","E11","E12","E13","E14","E15","E16","E17","E18","E19","E20","E21","E22","E23","E24","E25","E26","E27","E28","E29","E30","E31","E32","E33","E34","E35","E36","E37","E38","E39","E40","E41","E42","E43","E44","E45","E46","E47","E48","E49","E50","E51","E52","E53","E54","E55","E56","E57","E58","E59","E60","E61","E62","E63","E64","E65","E66","E67","E68","E69","E70","E71","E72","E73","E74","E75","E76","E77","E78","E79","E80","E81","E82","E83","E84","E85","E86","E87","E88","E89","E90","E91","E92","E93","E94","E95","E96","E97","E98","E99","E100","E101","E102","E103","E104","E105","E106","E107","E108","E109","E110","E111","E112","E113","E114","E115","E116","E117","E118","E119","E120","E121","E122","E123","E124","E125","E126","E127","E128","E129","E130","E131","E132","E133","E134","E135","E136","E137","E138","E139","E140","E141","E142","E143","E144","E145","E146","E147","E148","E149","E150","E151","E152","E153","E154","E155","E156","E157","E158","E159","E160","E161","E162","E163","E164","E165","E166","E167","E168","E169","E170"];
  // CHARACTER_EVENT_FALLBACK_START
  const characterEventFallback = new Map([
    [100,["E11","E12","E35","E36","E46","E78","E84","E87","E89","E92","E97","E99","E113","E117","E122","E126","E137","E139","E140","E158","E167","E168","E169","E170","E171","E173","E175","E180","E181","E182","E184","E185","E186","E187","E190","E191","E192","E193","E198","E200","E201","E202","E203","E204","E207","E208","E209","E210","E211","E212","E213","E214","E215","E216","E217","E218"]],
    [110,["E01","E18","E20","E21","E26","E29","E179","E191","E192","E193","E194"]],
    [120,["E07","E09","E11","E12","E13","E64","E176","E194","E198","E199"]],
    [130,["E05","E15","E16","E17","E18","E19","E34","E59","E83","E93","E127","E129","E130","E134","E195"]],
    [140,["E15","E18","E20","E51","E53"]],
    [150,["E22","E23","E24","E25","E26","E28","E64","E90","E91","E93","E94","E135","E177","E178","E179","E180"]],
    [160,["E22","E23","E24","E25","E26","E27","E35","E37","E38","E41","E42","E148","E156","E160","E161","E162","E163","E164","E165","E166","E200","E201","E202","E203","E204","E205","E206"]],
    [170,["E15","E16","E17","E18","E19","E34","E59","E83","E93","E129","E134","E145","E146","E172","E173","E181","E195","E199","E200","E203","E204","E205","E206"]],
    [180,["E15","E16","E17","E19","E34","E59","E83","E93","E129","E130","E131","E133","E135","E172","E173","E181","E195","E199","E200","E203","E204","E205","E206"]],
    [190,["E01","E11","E57","E61","E70","E72"]],
    [200,["E34","E43","E44","E45","E47","E49","E54","E57","E59","E93","E142","E145","E146","E147","E148","E154","E155"]],
    [210,["E33","E34","E49","E57","E58","E59","E60","E61","E83","E189","E190","E194","E195","E196","E197","E198","E199","E200"]],
    [220,["E30","E31","E32","E33","E121","E125","E155"]],
    [230,["E30","E31","E32"]],
    [240,["E25","E26","E32","E83","E147","E153","E154"]],
    [250,["E25","E28","E30","E31","E32","E34","E202"]],
    [260,["E32","E83","E153","E154"]],
    [270,["E51","E52","E53","E57","E61","E62","E63","E64","E65","E66","E67","E68","E69","E70","E71","E72","E79","E81","E85","E86","E87","E88","E135"]],
    [280,["E48","E49","E50","E55","E63","E93","E98","E106","E110","E135","E136"]],
    [290,["E42","E64"]],
    [291,["E82","E83","E84","E93","E97","E98","E99","E112","E120","E125","E126","E127","E131","E132","E133","E134","E141","E157","E158","E162","E171","E172","E173","E174","E195","E199","E200","E203","E204","E205","E206"]],
    [292,["E48","E57","E93","E143","E144","E145","E147","E149","E150","E151","E152","E153","E159","E201","E202","E205","E206"]],
    [293,["E58","E59","E71","E72","E73","E74","E75","E76","E77","E78","E80","E84","E94","E95","E134"]],
    [294,["E58","E77","E94","E95","E96","E97","E115","E116","E117","E118","E119","E125","E126","E127","E128","E129","E131","E132","E133","E172","E174","E181","E195","E199","E200","E202","E203","E204","E205","E206"]],
    [295,["E77","E78","E80","E82","E94","E95","E96","E97","E114","E120","E125","E127","E129","E131","E132","E133","E134"]],
    [296,["E44","E57","E78","E113","E114","E115","E116","E120","E121","E122","E123","E124","E125","E126","E127","E131","E132","E133","E134","E137","E138","E139","E140","E141","E145","E146","E148","E153","E154","E158","E167","E168","E169","E170","E171","E172","E173","E174","E195","E196","E199","E200","E203","E204","E205","E206"]],
    [297,["E59","E65","E94","E96","E97","E98","E120","E125","E126","E127","E128","E129"]],
    [298,["E210","E211","E212","E213","E214","E215","E216","E217","E218"]],
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
    .filter(entry => (Number(entry?.uid) === 299 || Number(entry?.uid) === 399 || String(entry?.comment ?? "").includes("事件内容激活路由")))
    .map(entry => String(entry?.world ?? "")));
  const activated = new Set();
  for (const entry of entries) {
    if (!routeWorlds.has(String(entry?.world ?? ""))) continue;
    const uid = Number(entry?.uid);
    const isCharacter = characterEventFallback.has(uid);
    let eventIds = entry?.extensions?.tavernweave?.event_ids;

    if (!Array.isArray(eventIds) && isCharacter) eventIds = characterEventFallback.get(uid);
    if (!Array.isArray(eventIds)) {
      const contentStr = String(entry?.content ?? "");
      const titleMatch = contentStr.match(/# 概念·[^\r\n]+（事件(\[[^\r\n]+\])）/);
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
