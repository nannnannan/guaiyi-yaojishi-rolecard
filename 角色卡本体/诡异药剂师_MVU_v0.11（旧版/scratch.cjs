const fs = require('fs');
const path = require('path');

const initialVars = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'src/initial_variables.json'), 'utf8'));

const css = `
    .dc-grimoire {
      --dc-soul: #2ee6a8;
      --dc-soul-glow: rgba(46, 230, 168, 0.35);
      --dc-tech: #38bdf8;
      --dc-tech-glow: rgba(56, 189, 248, 0.32);
      --dc-void: #b45cff;
      --dc-void-glow: rgba(180, 92, 255, 0.35);
      --dc-blood: #ff4d6a;
      --dc-blood-glow: rgba(255, 77, 106, 0.38);
      --dc-gold: #f5c542;
      --dc-gold-glow: rgba(245, 197, 66, 0.42);
      --dc-ink: #06080e;
      --dc-deep: #0a0e17;
      --dc-card: rgba(12, 18, 28, 0.88);
      --dc-card-inner: rgba(7, 11, 19, 0.76);
      --dc-line: rgba(212, 175, 55, 0.22);
      --dc-line-glow: rgba(212, 175, 55, 0.45);
      --dc-text: #e6eef5;
      --dc-text-bright: #ffffff;
      --dc-muted: #889bb0;
      --dc-alert: #ff4d6a;
      box-sizing: border-box;
      width: 100%;
      margin: .85rem 0;
      color: var(--dc-text);
      font: 14px/1.6 ui-sans-serif, system-ui, "Cinzel", "Times New Roman", "Microsoft YaHei", "Noto Sans SC", serif, sans-serif;
    }
    .dc-grimoire * { box-sizing: border-box; }
    .dc-grimoire ::selection { background: rgba(46, 230, 168, 0.28); color: #fff; }

    .dc-tome {
      position: relative;
      overflow: hidden;
      border: 1px solid var(--dc-line);
      border-radius: 14px;
      background:
        radial-gradient(ellipse at 15% 0%, rgba(180, 92, 255, 0.14), transparent 42%),
        radial-gradient(ellipse at 85% 0%, rgba(56, 189, 248, 0.12), transparent 38%),
        radial-gradient(circle at 50% 100%, rgba(255, 77, 106, 0.09), transparent 48%),
        linear-gradient(170deg, #090e18 0%, #05070c 50%, #080c14 100%);
      box-shadow:
        0 18px 45px rgba(0, 0, 0, 0.65),
        inset 0 0 45px rgba(180, 92, 255, 0.03),
        inset 0 0 80px rgba(56, 189, 248, 0.02);
    }
    .dc-tome::before {
      content: "";
      position: absolute;
      inset: 2px;
      pointer-events: none;
      border: 1px solid rgba(245, 197, 66, 0.12);
      border-radius: 12px;
    }

    .dc-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: .8rem;
      padding: .85rem 1.15rem;
      border-bottom: 1px solid rgba(212, 175, 55, 0.2);
      background: linear-gradient(90deg, rgba(46, 230, 168, 0.04), rgba(180, 92, 255, 0.04) 50%, rgba(56, 189, 248, 0.04));
    }
    .dc-brand {
      display: flex;
      align-items: center;
      gap: .75rem;
      min-width: 0;
    }
    .dc-lamp {
      position: relative;
      width: 1rem;
      height: 1.25rem;
      flex: 0 0 auto;
      border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
      background: radial-gradient(circle at 35% 30%, #e0fff7, var(--dc-soul) 55%, #0d5f49 100%);
      box-shadow: 0 0 12px var(--dc-soul), 0 0 26px var(--dc-tech-glow);
      animation: dc-lamp-breathe 3.5s ease-in-out infinite;
    }
    .dc-lamp::after {
      content: "";
      position: absolute;
      inset: -2px;
      border-radius: inherit;
      background: radial-gradient(circle at 40% 30%, rgba(255, 255, 255, 0.6), transparent 70%);
      opacity: 0.8;
      pointer-events: none;
    }
    .dc-title {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
      letter-spacing: .08em;
      color: var(--dc-text-bright);
      text-shadow: 0 0 12px rgba(46, 230, 168, 0.35);
    }
    .dc-version {
      color: var(--dc-gold);
      font-size: .76rem;
      font-weight: 600;
      letter-spacing: .04em;
      white-space: nowrap;
      text-shadow: 0 0 8px var(--dc-gold-glow);
      padding: .15rem .5rem;
      border: 1px solid rgba(245, 197, 66, 0.35);
      border-radius: 6px;
      background: rgba(245, 197, 66, 0.08);
    }

    .dc-tabs {
      display: flex;
      gap: .45rem;
      padding: .75rem .9rem 0;
      overflow-x: auto;
      scrollbar-width: none;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .dc-tabs::-webkit-scrollbar { display: none; }
    .dc-tab {
      appearance: none;
      position: relative;
      border: 1px solid var(--dc-line);
      border-bottom: none;
      border-radius: 9px 9px 0 0;
      padding: .48rem .88rem;
      color: var(--dc-muted);
      background: rgba(10, 15, 24, 0.6);
      cursor: pointer;
      font: inherit;
      font-size: .84rem;
      font-weight: 600;
      letter-spacing: .03em;
      white-space: nowrap;
      transition: all .25s ease;
    }
    .dc-tab:hover, .dc-tab:focus-visible {
      border-color: var(--dc-line-glow);
      color: var(--dc-text-bright);
      background: rgba(20, 28, 42, 0.8);
      outline: none;
    }
    .dc-tab[aria-selected="true"] {
      color: var(--dc-text-bright);
      border-color: var(--dc-gold);
      background: linear-gradient(180deg, rgba(245, 197, 66, 0.14) 0%, rgba(12, 18, 28, 0.95) 100%);
      box-shadow: 0 -4px 16px rgba(245, 197, 66, 0.18), inset 0 1px 0 var(--dc-gold);
    }
    .dc-tab[aria-selected="true"]::after {
      content: "";
      position: absolute;
      bottom: -1px;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--dc-card);
    }

    .dc-page { padding: .95rem; }
    .dc-page[hidden] { display: none; }
    .dc-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: .75rem;
    }
    .dc-card {
      min-width: 0;
      padding: .85rem;
      border: 1px solid rgba(212, 175, 55, 0.18);
      border-radius: 10px;
      background: var(--dc-card);
      backdrop-filter: blur(10px);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
      transition: border-color .22s ease, box-shadow .22s ease;
    }
    .dc-card:hover {
      border-color: rgba(212, 175, 55, 0.38);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
    }
    .dc-card--wide { grid-column: 1 / -1; }
    .dc-card--urgent {
      border-color: rgba(255, 77, 106, 0.75);
      animation: dc-abyss-pulse 1.8s ease-in-out infinite;
    }

    .dc-label {
      margin: 0 0 .45rem;
      color: var(--dc-gold);
      font-size: .78rem;
      letter-spacing: .06em;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: .4rem;
      text-shadow: 0 0 6px rgba(245, 197, 66, 0.25);
    }
    .dc-value {
      margin: 0;
      overflow-wrap: anywhere;
      font-size: .88rem;
      color: var(--dc-text);
    }
    .dc-value + .dc-value { margin-top: .28rem; }
    .dc-muted { color: var(--dc-muted); font-size: .82rem; }

    .dc-chip {
      display: inline-flex;
      align-items: center;
      gap: .32rem;
      margin: .18rem .24rem .18rem 0;
      padding: .2rem .55rem;
      border: 1px solid rgba(56, 189, 248, 0.32);
      border-radius: 6px;
      color: #bce6ff;
      background: rgba(56, 189, 248, 0.08);
      font-size: .79rem;
      font-weight: 500;
      letter-spacing: .02em;
    }
    .dc-chip--soul {
      border-color: rgba(46, 230, 168, 0.38);
      color: #b5ffea;
      background: rgba(46, 230, 168, 0.09);
    }
    .dc-chip--purple {
      border-color: rgba(180, 92, 255, 0.4);
      color: #e5baff;
      background: rgba(180, 92, 255, 0.1);
      box-shadow: 0 0 8px rgba(180, 92, 255, 0.15);
    }
    .dc-chip--crimson {
      border-color: rgba(255, 77, 106, 0.4);
      color: #ffb8c4;
      background: rgba(255, 77, 106, 0.1);
      box-shadow: 0 0 8px rgba(255, 77, 106, 0.15);
    }
    .dc-chip--gold {
      border-color: rgba(245, 197, 66, 0.45);
      color: #ffebb0;
      background: rgba(245, 197, 66, 0.12);
      box-shadow: 0 0 10px rgba(245, 197, 66, 0.16);
    }

    .dc-badge-grid {
      display: flex;
      flex-wrap: wrap;
      gap: .48rem;
      margin-top: .6rem;
      padding-top: .5rem;
      border-top: 1px dashed rgba(212, 175, 55, 0.18);
    }
    .dc-badge {
      display: inline-flex;
      align-items: center;
      gap: .4rem;
      padding: .3rem .72rem;
      border-radius: 8px;
      font-size: .81rem;
      font-weight: 600;
      letter-spacing: .02em;
      border: 1px solid transparent;
      transition: all .2s ease;
    }
    .dc-badge--soul {
      color: #b7ffeb;
      background: rgba(46, 230, 168, 0.12);
      border-color: rgba(46, 230, 168, 0.42);
      box-shadow: 0 0 12px rgba(46, 230, 168, 0.18);
    }
    .dc-badge--blue {
      color: #bce6ff;
      background: rgba(56, 189, 248, 0.12);
      border-color: rgba(56, 189, 248, 0.42);
      box-shadow: 0 0 12px rgba(56, 189, 248, 0.18);
    }
    .dc-badge--purple {
      color: #ebd2ff;
      background: rgba(180, 92, 255, 0.14);
      border-color: rgba(180, 92, 255, 0.45);
      box-shadow: 0 0 12px rgba(180, 92, 255, 0.2);
    }
    .dc-badge--gold {
      color: #fff2c4;
      background: linear-gradient(135deg, rgba(245, 197, 66, 0.22), rgba(212, 120, 20, 0.15));
      border-color: rgba(245, 197, 66, 0.6);
      box-shadow: 0 0 16px rgba(245, 197, 66, 0.28);
      animation: dc-gold-pulse 2.8s ease-in-out infinite;
    }

    .dc-meter-row {
      display: grid;
      grid-template-columns: 4rem minmax(0, 1fr) 5rem;
      align-items: center;
      gap: .55rem;
      margin: .42rem 0;
    }
    .dc-meter-label {
      font-size: .8rem;
      font-weight: 600;
      color: var(--dc-text);
      white-space: nowrap;
    }
    .dc-meter {
      position: relative;
      height: .52rem;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.04);
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.5);
    }
    .dc-meter > span {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 0;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--dc-soul), var(--dc-tech));
      box-shadow: 0 0 8px var(--dc-soul-glow);
      transition: width .35s ease;
    }
    .dc-meter > span[data-negative="true"] {
      background: linear-gradient(90deg, var(--dc-blood), var(--dc-void));
      box-shadow: 0 0 8px var(--dc-blood-glow);
    }
    .dc-meter-text {
      color: var(--dc-muted);
      font-size: .77rem;
      text-align: right;
      font-feature-settings: "tnum";
      white-space: nowrap;
    }

    .dc-person {
      border: 1px solid rgba(212, 175, 55, 0.2);
      border-radius: 9px;
      background: var(--dc-card-inner);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      transition: border-color .2s ease;
    }
    .dc-person + .dc-person { margin-top: .58rem; }
    .dc-person:hover { border-color: rgba(212, 175, 55, 0.38); }
    .dc-person summary {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: .6rem;
      padding: .7rem .85rem;
      cursor: pointer;
      list-style: none;
      user-select: none;
    }
    .dc-person summary::-webkit-details-marker { display: none; }
    .dc-person summary:focus-visible { outline: 1px solid var(--dc-gold); outline-offset: -2px; }
    .dc-name { font-weight: 700; color: var(--dc-text-bright); font-size: .92rem; letter-spacing: .02em; }
    .dc-status { color: var(--dc-soul); font-size: .82rem; font-weight: 600; text-align: right; }
    .dc-person-body {
      padding: 0 .85rem .85rem;
      border-top: 1px dashed rgba(212, 175, 55, 0.16);
    }
    .dc-person-meta {
      margin: .6rem 0;
      color: var(--dc-muted);
      font-size: .8rem;
    }

    .dc-edge {
      padding: .6rem 0;
      border-top: 1px dashed rgba(212, 175, 55, 0.14);
    }
    .dc-edge:first-child { border-top: 0; padding-top: 0; }
    .dc-list {
      margin: .35rem 0 0;
      padding-left: 1.2rem;
      color: var(--dc-text);
      font-size: .84rem;
    }
    .dc-list li + li { margin-top: .3rem; }

    .dc-btn {
      margin-top: .6rem;
      padding: .5rem .95rem;
      border: 1px solid rgba(245, 197, 66, 0.45);
      border-radius: 8px;
      color: var(--dc-gold);
      background: linear-gradient(180deg, rgba(245, 197, 66, 0.15) 0%, rgba(20, 26, 38, 0.8) 100%);
      font: inherit;
      font-size: .84rem;
      font-weight: 600;
      letter-spacing: .03em;
      cursor: pointer;
      transition: all .25s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
    }
    .dc-btn:hover:not(:disabled), .dc-btn:focus-visible:not(:disabled) {
      border-color: var(--dc-gold);
      color: var(--dc-text-bright);
      background: linear-gradient(180deg, rgba(245, 197, 66, 0.28) 0%, rgba(35, 45, 65, 0.9) 100%);
      box-shadow: 0 0 16px rgba(245, 197, 66, 0.35);
    }
    .dc-btn:disabled { opacity: .45; cursor: not-allowed; border-color: rgba(255, 255, 255, 0.15); color: var(--dc-muted); }

    .dc-error {
      margin: .85rem;
      padding: .75rem;
      border: 1px dashed var(--dc-alert);
      border-radius: 8px;
      color: #ffc9d2;
      background: rgba(255, 77, 106, 0.08);
      font-size: .83rem;
    }
    .dc-foot {
      padding: .7rem 1.1rem .9rem;
      color: var(--dc-muted);
      font-size: .77rem;
      text-align: center;
      border-top: 1px solid rgba(212, 175, 55, 0.15);
      background: rgba(0, 0, 0, 0.15);
      letter-spacing: .02em;
    }

    @keyframes dc-lamp-breathe {
      0%, 100% { opacity: .75; transform: scale(.94); box-shadow: 0 0 10px var(--dc-soul), 0 0 20px var(--dc-tech-glow); }
      50% { opacity: 1; transform: scale(1.06); box-shadow: 0 0 16px var(--dc-soul), 0 0 32px var(--dc-soul-glow); }
    }
    @keyframes dc-abyss-pulse {
      0%, 100% { box-shadow: 0 0 0 rgba(255, 77, 106, 0); }
      50% { box-shadow: 0 0 20px rgba(255, 77, 106, 0.32); }
    }
    @keyframes dc-gold-pulse {
      0%, 100% { box-shadow: 0 0 10px rgba(245, 197, 66, 0.2); }
      50% { box-shadow: 0 0 20px rgba(245, 197, 66, 0.45); }
    }

    @media (max-width: 600px) {
      .dc-grid { grid-template-columns: 1fr; }
      .dc-card--wide { grid-column: auto; }
      .dc-meter-row { grid-template-columns: 3.5rem minmax(0, 1fr) 4.2rem; }
    }
    @media (prefers-reduced-motion: reduce) {
      .dc-grimoire *, .dc-grimoire *::before, .dc-grimoire *::after {
        animation: none !important;
        transition: none !important;
        scroll-behavior: auto !important;
      }
    }
`;

const htmlHead = `<body>
<section class="dc-grimoire" data-wa-status-root aria-label="死界药剂师手札 · 多模态视界仪">
  <style>${css}</style>

  <div class="dc-tome">
    <header class="dc-head">
      <div class="dc-brand">
        <span class="dc-lamp" aria-hidden="true"></span>
        <h3 class="dc-title">死界药剂师手札 · 多模态视界仪</h3>
      </div>
      <span class="dc-version">《诡异药剂师》v0.9.3</span>
    </header>

    <nav class="dc-tabs" role="tablist" aria-label="手札视界导航">
      <button class="dc-tab" type="button" role="tab" id="wa-tab-current" aria-controls="wa-current" aria-selected="true">🩸 体魄与理智</button>
      <button class="dc-tab" type="button" role="tab" id="wa-tab-events" aria-controls="wa-events" aria-selected="false" tabindex="-1">📜 大势与事件</button>
      <button class="dc-tab" type="button" role="tab" id="wa-tab-people" aria-controls="wa-people" aria-selected="false" tabindex="-1">👥 深渊人物</button>
      <button class="dc-tab" type="button" role="tab" id="wa-tab-system" aria-controls="wa-system" aria-selected="false" tabindex="-1">🔮 药囊·咒瞳与圣遗</button>
    </nav>

    <div id="wa-error" class="dc-error" role="status" hidden></div>

    <!-- 面板 1：体魄与理智 -->
    <section class="dc-page" id="wa-current" role="tabpanel" aria-labelledby="wa-tab-current">
      <div class="dc-grid">
        <article class="dc-card">
          <p class="dc-label">🌐 世界宏观阶段</p>
          <p class="dc-value" id="wa-phase">读取中……</p>
          <p class="dc-value dc-muted" id="wa-phase-progress"></p>
        </article>
        <article class="dc-card">
          <p class="dc-label">📍 地点与场景时序</p>
          <p class="dc-value" id="wa-location">读取中……</p>
          <p class="dc-value dc-muted" id="wa-time"></p>
        </article>
        <article class="dc-card">
          <p class="dc-label">👤 林恩体魄与身份</p>
          <p class="dc-value" id="wa-linen">读取中……</p>
          <div id="wa-identities"></div>
        </article>
        <article class="dc-card">
          <p class="dc-label">🎯 当前明确目标</p>
          <p class="dc-value" id="wa-task">读取中……</p>
          <p class="dc-value dc-muted" id="wa-task-note"></p>
        </article>
        <article class="dc-card dc-card--wide">
          <p class="dc-label">🧠 理智·神性与契约状态</p>
          <div id="wa-linen-status"></div>
        </article>
        <article class="dc-card dc-card--wide" id="wa-current-event-card">
          <p class="dc-label">⚡ 当前焦点事件</p>
          <p class="dc-value" id="wa-current-event">读取中……</p>
          <p class="dc-value dc-muted" id="wa-current-event-progress"></p>
        </article>
      </div>
    </section>

    <!-- 面板 2：大势与事件 -->
    <section class="dc-page" id="wa-events" role="tabpanel" aria-labelledby="wa-tab-events" hidden>
      <div class="dc-grid">
        <article class="dc-card dc-card--wide" id="wa-event-detail-card">
          <p class="dc-label">⚡ 唯一活跃重大危机事件</p>
          <p class="dc-value" id="wa-event-title">读取中……</p>
          <p class="dc-value dc-muted" id="wa-event-detail"></p>
        </article>
        <article class="dc-card">
          <p class="dc-label">👁️ 近期预兆</p>
          <p class="dc-value" id="wa-omen-title">读取中……</p>
          <p class="dc-value dc-muted" id="wa-omen-detail"></p>
          <button class="dc-btn" id="wa-advance-btn" type="button" disabled>读取中……</button>
        </article>
        <article class="dc-card">
          <p class="dc-label">📜 最近事件结算</p>
          <ul class="dc-list" id="wa-results"></ul>
        </article>
        <article class="dc-card dc-card--wide">
          <p class="dc-label">⚖️ 事件六态法则</p>
          <p class="dc-value dc-muted">
            <span class="dc-chip">未触发：尚未进入预兆</span>
            <span class="dc-chip">预兆：方向模糊、即将登场</span>
            <span class="dc-chip">活跃：唯一重大事件</span>
            <span class="dc-chip">变形：替代结果稳定收束</span>
            <span class="dc-chip">完成：正常收束</span>
            <span class="dc-chip">取消：因果不复存在</span>
          </p>
        </article>
      </div>
    </section>

    <!-- 面板 3：深渊人物 -->
    <section class="dc-page" id="wa-people" role="tabpanel" aria-labelledby="wa-tab-people" hidden>
      <div class="dc-grid">
        <article class="dc-card dc-card--wide">
          <p class="dc-label">👥 已解锁人物矩阵</p>
          <div id="wa-relations"><p class="dc-muted">读取中……</p></div>
        </article>
        <article class="dc-card dc-card--wide">
          <p class="dc-label">🕸️ 角色间关系网络</p>
          <div id="wa-edges"><p class="dc-muted">读取中……</p></div>
        </article>
      </div>
    </section>

    <!-- 面板 4：药囊·咒瞳与圣遗 -->
    <section class="dc-page" id="wa-system" role="tabpanel" aria-labelledby="wa-tab-system" hidden>
      <div class="dc-grid">
        <article class="dc-card">
          <p class="dc-label">🔮 咒瞳军械库 / 收录诅咒</p>
          <div id="wa-sys-curse-skills"></div>
        </article>
        <article class="dc-card">
          <p class="dc-label">⚡ 当前所受诅咒 / 契约</p>
          <div id="wa-sys-active-curses"></div>
        </article>
        <article class="dc-card">
          <p class="dc-label">🗡️ 随身圣遗物与医疗器具</p>
          <div id="wa-sys-relics"></div>
        </article>
        <article class="dc-card">
          <p class="dc-label">🧪 深渊行医与成长技能</p>
          <p class="dc-value" id="wa-sys-level">读取中……</p>
          <div id="wa-sys-skills"></div>
        </article>
        <article class="dc-card">
          <p class="dc-label">📖 恶灵与物品图鉴</p>
          <ul class="dc-list" id="wa-sys-codex"></ul>
        </article>
        <article class="dc-card">
          <p class="dc-label">🏆 深渊成就</p>
          <ul class="dc-list" id="wa-sys-achievements"></ul>
        </article>
        <article class="dc-card dc-card--wide">
          <p class="dc-label">💬 系统日志与世界通知</p>
          <p class="dc-value" id="wa-sys-notice">读取中……</p>
          <p class="dc-value dc-muted" id="wa-sys-event-notice"></p>
          <p class="dc-value dc-muted" id="wa-sys-task" style="display:none;"></p>
          <p class="dc-value dc-muted" id="wa-sys-task-stage" style="display:none;"></p>
          <p class="dc-value dc-muted" id="wa-sys-task-note" style="display:none;"></p>
        </article>
      </div>
    </section>

    <footer class="dc-foot">人物页只显示已解锁信息；姓名解锁不代表登场。取消态不自动推进，由正文核对局部依赖。恶堕值只随玩家明确行动推进。</footer>
  </div>
`;

// Read the original v0.9 status.html to extract the exact JavaScript bridge logic and functions
const originalStatus = fs.readFileSync(path.resolve(__dirname, 'src/ui/status.html'), 'utf8');
const scriptMatch = originalStatus.match(/<script>([\s\S]*?)<\/script>/);

if (!scriptMatch) throw new Error('Could not find script block in status.html');
let jsBody = scriptMatch[1];

jsBody = jsBody.replace(/const FALLBACK_STATE = \{[\s\S]*?\n\s*\};\s*let mvuAvailable/, 'const FALLBACK_STATE = ' + JSON.stringify(initialVars, null, 2) + ';\n      let mvuAvailable');

// Update DOM selectors and classes inside JS:
// wa-person -> dc-person, wa-name -> dc-name, wa-status -> dc-status, wa-person-body -> dc-person-body, wa-person-meta -> dc-person-meta
jsBody = jsBody.replace(/details\.className = 'wa-person';/g, "details.className = 'dc-person';");
jsBody = jsBody.replace(/heading\.className = 'wa-name';/g, "heading.className = 'dc-name';");
jsBody = jsBody.replace(/status\.className = 'wa-status';/g, "status.className = 'dc-status';");
jsBody = jsBody.replace(/body\.className = 'wa-person-body';/g, "body.className = 'dc-person-body';");
jsBody = jsBody.replace(/meta\.className = 'wa-person-meta';/g, "meta.className = 'dc-person-meta';");
jsBody = jsBody.replace(/empty\.className = 'wa-muted';/g, "empty.className = 'dc-muted';");
jsBody = jsBody.replace(/li\.className = 'wa-muted';/g, "li.className = 'dc-muted';");
jsBody = jsBody.replace(/locked\.className = 'wa-muted';/g, "locked.className = 'dc-muted';");
jsBody = jsBody.replace(/cue\.className = 'wa-muted';/g, "cue.className = 'dc-muted';");
jsBody = jsBody.replace(/row\.className = 'wa-edge';/g, "row.className = 'dc-edge';");
jsBody = jsBody.replace(/title\.className = 'wa-value';/g, "title.className = 'dc-value';");
jsBody = jsBody.replace(/detail\.className = 'wa-value wa-muted';/g, "detail.className = 'dc-value dc-muted';");
jsBody = jsBody.replace(/situation\.className = 'wa-value';/g, "situation.className = 'dc-value';");
jsBody = jsBody.replace(/card\.classList\.toggle\('wa-card--urgent'/g, "if (card) card.classList.toggle('dc-card--urgent'");

// Update meter builder inside JS
jsBody = jsBody.replace(/row\.className = 'wa-meter-row';\s*const name = document\.createElement\('span'\);\s*name\.textContent = label;\s*const track = document\.createElement\('span'\);\s*track\.className = 'wa-meter';\s*const fill = document\.createElement\('span'\);\s*fill\.dataset\.negative = String\(negative\);\s*fill\.style\.left = '0%';\s*fill\.style\.width = `\$\{score\}%`;\s*track\.append\(fill\);\s*const words = document\.createElement\('span'\);\s*words\.className = 'wa-meter-text';/, `row.className = 'dc-meter-row';
        const name = document.createElement('span');
        name.className = 'dc-meter-label';
        name.textContent = label;
        const track = document.createElement('span');
        track.className = 'dc-meter';
        const fill = document.createElement('span');
        fill.dataset.negative = String(negative);
        fill.style.width = \`\${score}%\`;
        track.append(fill);
        const words = document.createElement('span');
        words.className = 'dc-meter-text';`);

// Update chip / badge classes in render()
jsBody = jsBody.replace(/chip\.className = 'wa-chip';/g, "chip.className = 'dc-chip';");
jsBody = jsBody.replace(/chip\.className = 'wa-chip wa-chip--purple';/g, "chip.className = 'dc-chip dc-chip--purple';");
jsBody = jsBody.replace(/chip\.className = 'wa-chip wa-chip--crimson';/g, "chip.className = 'dc-chip dc-chip--crimson';");
jsBody = jsBody.replace(/chip\.className = 'wa-chip wa-chip--gold';/g, "chip.className = 'dc-chip dc-chip--gold';");
jsBody = jsBody.replace(/badgeGrid\.className = 'wa-badge-grid';/g, "badgeGrid.className = 'dc-badge-grid';");
jsBody = jsBody.replace(/doll\.className = 'wa-badge wa-badge--gold';/g, "doll.className = 'dc-badge dc-badge--gold';");
jsBody = jsBody.replace(/kiss\.className = 'wa-badge wa-badge--soul';/g, "kiss.className = 'dc-badge dc-badge--soul';");
jsBody = jsBody.replace(/rootNet\.className = 'wa-badge wa-badge--purple';/g, "rootNet.className = 'dc-badge dc-badge--purple';");
jsBody = jsBody.replace(/colossus\.className = 'wa-badge wa-badge--blue';/g, "colossus.className = 'dc-badge dc-badge--blue';");
jsBody = jsBody.replace(/eye\.className = 'wa-badge wa-badge--purple';/g, "eye.className = 'dc-badge dc-badge--purple';");
jsBody = jsBody.replace(/morph\.className = 'wa-badge wa-badge--blue';/g, "morph.className = 'dc-badge dc-badge--blue';");

const finalHtml = `${htmlHead}\n  <script>${jsBody}</script>\n</section>\n</body>\n`;

fs.writeFileSync(path.resolve(__dirname, 'src/ui/status.html'), finalHtml, 'utf8');
console.log('Successfully generated status.html in v0.9.3!');

