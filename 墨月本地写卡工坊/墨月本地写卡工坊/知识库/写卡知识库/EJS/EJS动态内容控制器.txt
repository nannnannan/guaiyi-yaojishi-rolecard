动态内容控制器示例（@@preprocessing + getwi）

用途：根据MVU变量值（地点、角色、事件等）动态加载对应世界书条目，避免所有条目同时激活浪费token。

结构：
@@preprocessing
<%
// 读取变量
if (typeof currentDomain === 'undefined') var currentDomain = getvar('stat_data.世界定位.当前大域', { defaults: '中央神州' });
if (typeof currentArea === 'undefined') var currentArea = getvar('stat_data.世界定位.当前区域', { defaults: '' });
if (typeof currentScene === 'undefined') var currentScene = getvar('stat_data.世界定位.当前场景', { defaults: '' });
if (typeof presentCharacters === 'undefined') var presentCharacters = getvar('stat_data.在场人物', { defaults: {} });
if (typeof messageText === 'undefined') {
  const userMessages = getChatMessages(-1, -1, 'user');
  var messageText = userMessages.length > 0 ? userMessages[userMessages.length - 1].message : '';
}
%>

// 跳过第0楼（开局消息）
<% if (!isFloorZero) { %>

// 根据大域加载地图
<% if (currentDomain.includes('中央神州')) { %>
<%- await getwi('地图_中央神州') %>
<% } else if (currentDomain.includes('东荒妖域')) { %>
<%- await getwi('地图_东荒妖域') %>
<% } %>

// 根据场景加载具体地点
<% if (currentArea.includes('万剑山脉') || currentScene.includes('剑宗')) { %>
<%- await getwi('剑宗') %>
<% } %>

// 根据事件加载指南
<% if (currentEvent === '炼丹' || messageText.includes('炼丹')) { %>
<%- await getwi('动态事件_炼丹指南') %>
<% } %>

// 根据在场角色加载人设（别名映射）
<%
if (typeof detectedCharacters === 'undefined') {
  const aliasMap = { '冬雪': '殷冬雪', '疏影': '卫疏影' /* ... */ };
  var detectedCharacters = new Set();
  if (presentCharacters && typeof presentCharacters === 'object') {
    for (const name of Object.keys(presentCharacters)) {
      detectedCharacters.add(aliasMap[name] || name);
    }
  }
  for (const alias of Object.keys(aliasMap)) {
    if (messageText.includes(alias)) detectedCharacters.add(aliasMap[alias]);
  }
  detectedCharacters = Array.from(detectedCharacters);
}
%>
<% for (const charName of detectedCharacters) { %>
<%- await getwi(charName.trim()) %>
<% } %>

<% } %>

配置：蓝灯顺序100，不勾防递归
要点：
1. 必须@@preprocessing开头
2. 用getvar读MVU变量，用getChatMessages读用户消息文本
3. 用.includes()做模糊匹配
4. 角色别名用Map映射到标准名
5. 加载的条目可以是禁用或绿灯
