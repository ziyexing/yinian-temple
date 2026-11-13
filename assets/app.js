/* ===== 一念 · 线上AI寺庙 · 交互层 ===== */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const K = 'yinian.temple.v1';

  /* ---------- 数据 ---------- */
  const DEFAULT = { wishes: [], incense: 0, merit: 0, meritToday: 0, dayKey: '', best: 0, days: [], qianCount: 0, chat: [], ai: { mode: 'local', base: '', model: '', key: '' }, muted: false };
  let S = (function () {
    try {
      const o = JSON.parse(localStorage.getItem(K) || '{}');
      const s = Object.assign({}, DEFAULT, o);
      s.ai = Object.assign({}, DEFAULT.ai, o.ai || {});
      if (!Array.isArray(s.wishes)) s.wishes = [];
      if (!Array.isArray(s.chat)) s.chat = [];
      if (!Array.isArray(s.days)) s.days = [];
      return s;
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULT)); }
  })();
  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { try { localStorage.setItem(K, JSON.stringify(S)); } catch (e) { } }, 100);
  }
  const pad = n => String(n).padStart(2, '0');
  const dkey = (d = new Date()) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  function ensureDay() {
    const k = dkey();
    if (S.dayKey !== k) { S.dayKey = k; S.meritToday = 0; }
    if (S.days.indexOf(k) < 0) { S.days.push(k); if (S.days.length > 400) S.days = S.days.slice(-400); }
  }
  ensureDay();
  const nowHM = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const SHICHEN = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const shichenNow = () => SHICHEN[Math.floor(((new Date().getHours() + 1) % 24) / 2)];

  /* ---------- 音声（全部由点击触发，不自动播放） ---------- */
  const Audio1 = (function () {
    let ctx = null;
    function ensure() {
      if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; try { ctx = new AC(); } catch (e) { return null; } }
      if (ctx.state === 'suspended') ctx.resume().catch(() => { });
      return ctx;
    }
    function noise(c, dur) {
      const b = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return b;
    }
    function tok() {
      if (S.muted) return; const c = ensure(); if (!c) return;
      const t = c.currentTime;
      const src = c.createBufferSource(); src.buffer = noise(c, 0.09);
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 860; bp.Q.value = 5.5;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      src.connect(bp).connect(g).connect(c.destination); src.start(t); src.stop(t + 0.14);
      const o = c.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(430, t); o.frequency.exponentialRampToValueAtTime(170, t + 0.1);
      const g2 = c.createGain(); g2.gain.setValueAtTime(0.22, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      o.connect(g2).connect(c.destination); o.start(t); o.stop(t + 0.15);
    }
    function bell() {
      if (S.muted) return; const c = ensure(); if (!c) return;
      const t = c.currentTime;
      [[528, 0.26], [792, 0.14], [1056, 0.07]].forEach(([f, v], i) => {
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(v, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4 + i * 0.1);
        o.connect(g).connect(c.destination); o.start(t); o.stop(t + 2.6);
      });
    }
    function clack(count) {
      if (S.muted) return; const c = ensure(); if (!c) return;
      const t0 = c.currentTime + 0.02;
      for (let i = 0; i < (count || 4); i++) {
        const t = t0 + i * 0.19;
        const src = c.createBufferSource(); src.buffer = noise(c, 0.055);
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2300 + Math.random() * 700; bp.Q.value = 2.2;
        const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
        src.connect(bp).connect(g).connect(c.destination); src.start(t); src.stop(t + 0.07);
      }
    }
    return { tok, bell, clack, ensure };
  })();

  /* ---------- 提示 / 静音 ---------- */
  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast'); if (!el) return;
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }
  const ICON_SOUND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 9c1.2 1.7 1.2 4.3 0 6"/><path d="M19.5 6.5c2.2 3 2.2 8 0 11"/></svg>';
  const ICON_MUTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.8 8.2 21 12.4M21 8.2 16.8 12.4" stroke-width="1.4"/></svg>';
  const muteBtn = $('#muteBtn');
  function paintMute() {
    muteBtn.setAttribute('aria-pressed', String(!!S.muted));
    muteBtn.setAttribute('aria-label', S.muted ? '开启声音' : '静音');
    muteBtn.innerHTML = S.muted ? ICON_MUTE : ICON_SOUND;
    muteBtn.style.color = S.muted ? 'var(--muted-2)' : '';
  }
  paintMute();
  muteBtn.addEventListener('click', () => {
    S.muted = !S.muted; paintMute(); save();
    if (!S.muted) { Audio1.ensure(); toast('声音已开'); } else { toast('已静音'); }
  });

  /* ---------- 顶栏时辰 ---------- */
  function paintClock() { const el = $('#shichen'); if (el) el.textContent = shichenNow() + '时 · 寺门未关'; }
  paintClock(); setInterval(paintClock, 60000);

  /* ---------- 山门数字 ---------- */
  function paintStats() {
    const a = $('#m-incense'), b = $('#m-merit'), c = $('#m-qian');
    if (a) a.textContent = S.incense;
    if (b) b.textContent = S.merit;
    if (c) c.textContent = S.qianCount;
  }
  paintStats();

  /* =====================================================
     殿一 · 敬香
     ===================================================== */
  const smokeCv = $('#smoke');
  const sctx = smokeCv ? smokeCv.getContext('2d') : null;
  const ANCHORS = [[0.365, 0.305], [0.445, 0.288], [0.505, 0.305]];
  let parts = [], raf = null, lit = false, lastT = 0, emitAcc = 0, visible = true;

  function sizeSmoke() {
    if (!smokeCv) return;
    const box = smokeCv.parentElement.getBoundingClientRect();
    if (!box.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    smokeCv.width = Math.round(box.width * dpr);
    smokeCv.height = Math.round(box.height * dpr);
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function emit(w, h) {
    const a = ANCHORS[Math.floor(Math.random() * ANCHORS.length)];
    parts.push({
      x: a[0] * w + (Math.random() - 0.5) * w * 0.03,
      y: a[1] * h + (Math.random() - 0.5) * h * 0.02,
      vx: (Math.random() * 0.22 + 0.12),
      vy: -(Math.random() * 0.5 + 0.55),
      r: Math.random() * 8 + 7,
      life: 0, max: 2400 + Math.random() * 1800, seed: Math.random() * 6.28
    });
    if (parts.length > 110) parts.shift();
  }
  function drawSmoke(t) {
    if (!sctx) return;
    const w = smokeCv.clientWidth, h = smokeCv.clientHeight;
    if (!w) return;
    const dt = lastT ? Math.min(t - lastT, 48) : 16; lastT = t;
    sctx.clearRect(0, 0, w, h);
    if (lit && visible) {
      emitAcc += dt;
      const gap = 150;
      while (emitAcc > gap) { emit(w, h); emitAcc -= gap; }
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      if (p.life > p.max) { parts.splice(i, 1); continue; }
      const k = p.life / p.max;
      p.x += (p.vx * dt / 16) + Math.sin((p.life / 420) + p.seed) * 0.35;
      p.y += p.vy * dt / 16;
      p.vy *= 0.9985;
      const alpha = 0.16 * Math.sin(Math.PI * Math.min(k * 1.25, 1)) * (1 - k * 0.25);
      const rr = p.r * (1 + k * 2.4);
      const g = sctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr);
      g.addColorStop(0, 'rgba(226,224,212,' + alpha.toFixed(3) + ')');
      g.addColorStop(0.55, 'rgba(210,208,196,' + (alpha * 0.45).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(200,198,188,0)');
      sctx.fillStyle = g;
      sctx.beginPath(); sctx.arc(p.x, p.y, rr, 0, 6.2832); sctx.fill();
    }
    if (lit && !REDUCE) raf = requestAnimationFrame(drawSmoke);
    else raf = null;
  }
  function startSmoke() {
    if (!smokeCv || REDUCE) return;
    sizeSmoke();
    if (!raf) { lastT = 0; raf = requestAnimationFrame(drawSmoke); }
  }
  if (smokeCv) {
    sizeSmoke();
    window.addEventListener('resize', () => { sizeSmoke(); if (lit) startSmoke(); }, { passive: true });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => { es.forEach(e => { visible = e.isIntersecting; if (visible && lit) startSmoke(); }); }, { threshold: 0.12 })
        .observe(smokeCv.parentElement);
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) { visible = false; } else if (lit) { visible = true; startSmoke(); } });
  }

  function lightOn(silent) {
    lit = true;
    if (smokeCv) smokeCv.classList.add('on');
    const tip = $('#ashTip'); if (tip) { tip.textContent = '香已点着 · 不必再添'; tip.classList.add('on'); }
    const st = $('#incenseState'); if (st) st.innerHTML = '香已点着 · 已敬 <b>' + S.incense + '</b> 炷';
    startSmoke();
    if (!silent) Audio1.bell();
  }

  function renderWall() {
    const wall = $('#wall'), cnt = $('#wallCount');
    if (!wall) return;
    wall.innerHTML = '';
    if (!S.wishes.length) {
      const e = document.createElement('div');
      e.className = 'wall-empty';
      e.textContent = '此处尚空。第一炷香，由你点起。';
      wall.appendChild(e);
      if (cnt) cnt.textContent = '尚无人留下话';
      return;
    }
    const list = S.wishes.slice(0, 12);
    list.forEach((w, i) => {
      const d = document.createElement('div');
      d.className = 'plaque';
      const txt = document.createElement('div'); txt.className = 'txt';
      const chunks = String(w.t).match(/[\s\S]{1,4}/g) || [];
      chunks.slice(0, 7).forEach(c => {
        const col = document.createElement('span'); col.className = 'col'; col.textContent = c;
        txt.appendChild(col);
      });
      d.appendChild(txt);
      const foot = document.createElement('div'); foot.className = 'pfoot';
      const no = document.createElement('span'); no.className = 'no'; no.textContent = '第' + (S.wishes.length - i) + '愿';
      const tm = document.createElement('span'); tm.className = 'tm'; tm.textContent = w.d || '';
      foot.appendChild(no); foot.appendChild(tm); d.appendChild(foot);
      const del = document.createElement('button');
      del.className = 'del'; del.type = 'button'; del.setAttribute('aria-label', '化去这条愿望'); del.textContent = '×';
      del.addEventListener('click', () => { removeWish(w.id); });
      d.appendChild(del);
      wall.appendChild(d);
    });
    if (cnt) cnt.textContent = '已留 ' + S.wishes.length + ' 愿 · 仅存本机';
  }

  function addWish(text) {
    S.wishes.unshift({ id: Date.now() + '-' + Math.random().toString(36).slice(2, 6), t: text, d: nowHM() });
    if (S.wishes.length > 30) S.wishes = S.wishes.slice(0, 30);
    save(); renderWall();
  }
  function removeWish(id) {
    S.wishes = S.wishes.filter(w => w.id !== id);
    save(); renderWall(); toast('已化去');
  }

  const wishInput = $('#wishInput');
  if (wishInput) {
    wishInput.addEventListener('input', () => { $('#wishCount').textContent = wishInput.value.length; });
  }
  const clearWish = $('#clearWish');
  if (clearWish) clearWish.addEventListener('click', () => { wishInput.value = ''; $('#wishCount').textContent = '0'; wishInput.focus(); });

  function doIncense() {
    const txt = (wishInput.value || '').trim();
    S.incense += 1; save(); paintStats();
    lightOn(false);
    if (txt) {
      addWish(txt);
      wishInput.value = ''; $('#wishCount').textContent = '0';
      toast('香已上，愿已挂');
      const wall = $('#wall'); if (wall) wall.scrollIntoView({ block: 'nearest', behavior: REDUCE ? 'auto' : 'smooth' });
    } else {
      toast('香已点着。话留在心里，也算说过了');
    }
  }
  const lightBtn = $('#lightBtn');
  if (lightBtn) lightBtn.addEventListener('click', doIncense);
  const ashHit = $('#ashHit');
  if (ashHit) {
    ashHit.addEventListener('click', () => { if (!lit) { S.incense += 1; save(); paintStats(); lightOn(false); toast('三炷香点着了'); } else { toast('香还在燃'); } });
    ashHit.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ashHit.click(); } });
  }
  renderWall();

  /* =====================================================
     殿二 · 求签
     ===================================================== */
  const QIAN = window.YN_DATA.QIAN;
  const LEVEL_CLASS = { '上上': 'up-up', '上': 'up', '中上': 'up', '中': 'mid', '中下': 'mid-low' };
  let busy = false, curQian = -1, lastQian = -1;

  function showQian(idx) {
    const q = QIAN[idx], box = $('#qianResult');
    const poem = q.p.map(line => '<p>' + line + '</p>').join('');
    box.innerHTML =
      '<div class="qian-meta">' +
      '<span class="level ' + LEVEL_CLASS[q.l] + '">' + q.l + '签</span>' +
      '<span class="qian-no">' + q.n + '</span>' +
      '</div>' +
      '<h3 class="qian-title">' + q.t + '</h3>' +
      '<div class="rule"></div>' +
      '<div class="qian-poem">' + poem + '</div>' +
      '<div class="rule"></div>' +
      '<div class="yiji"><span>宜 <b>' + q.yi + '</b></span><span>忌 <b>' + q.ji + '</b></span></div>' +
      '<div id="readingBox"><div class="reading">' + q.r + '</div></div>' +
      '<div class="panel-foot" style="margin-top:16px">' +
      '<button class="btn btn-ghost" id="interpretBtn">请师父解这支签</button>' +
      '<span class="sub-line" id="interpretNote">签是老签，事是新事</span>' +
      '</div>';
    $('#interpretBtn').addEventListener('click', interpret);
    const st = $('#qianStatus');
    if (st) st.textContent = '已求 ' + S.qianCount + ' 签 · 签文二十四支';
    paintStats();
  }

  async function interpret() {
    if (curQian < 0) return;
    const q = QIAN[curQian];
    const ask = ($('#askInput').value || '').trim();
    const note = $('#interpretNote');
    const box = $('#readingBox');
    if (!aiReady()) {
      const tone = (q.l === '上上' || q.l === '上')
        ? '此签偏顺。可以往前走一步，但别把劲一次用尽——顺的时候最容易走岔。'
        : (q.l === '中下'
          ? '此签偏滞。此刻强求容易折损，先收一收，等风向变了再说。'
          : '此签不强不弱。先把眼前最小的一步做掉，再看它长成什么样。');
      const line = ask ? '你问的是「' + escapeHTML(ask) + '」。' : '你还没说所问何事，那就按心里最放不下的那件来解。';
      box.innerHTML = '<div class="reading">' + line + '\n' + tone +
        '\n\n今天可以做的：把这件事写成一行字——只写"我怕的是什么"。写不出，说明它还没到该处理的时候。' +
        '\n\n（宜 ' + q.yi + '；忌 ' + q.ji + '）</div>';
      note.textContent = '本地解语 · 接入大模型可现写';
      toast('本地模式：签意已解。接入大模型可更贴你的事');
      return;
    }
    note.textContent = '师父正在翻签谱…';
    box.innerHTML = '<div class="reading" style="color:var(--muted)">…</div>';
    const msgs = [
      { role: 'system', content: QIAN_SYS },
      { role: 'user', content: '签：' + q.n + '「' + q.t + '」' + q.l + '签。签诗：' + q.p.join('，') + '。签意：' + q.r + '\n我所问：' + (ask || '（未明说，只说心里不安）') }
    ];
    const r = await callAI(msgs, null, 400);
    if (r.ok) {
      box.innerHTML = '<div class="reading"><span class="ai-tag">师父现解</span><br>' + escapeHTML(r.text) + '</div>';
      note.textContent = '由大模型现写 · 只作参考';
    } else {
      box.innerHTML = '<div class="reading">' + q.r + '\n\n宜：' + q.yi + '；忌：' + q.ji + '。</div>';
      note.textContent = '模型未应答（' + escapeHTML(r.reason) + '），已改用本地解语';
    }
  }

  function shake() {
    if (busy) return;
    busy = true;
    const tube = $('#tubeBox'), pop = $('#stickPop'), tip = $('#tubeTip');
    Audio1.clack(4);
    tube.classList.remove('tube-shake'); void tube.offsetWidth; tube.classList.add('tube-shake');
    if (tip) tip.textContent = '摇…';
    setTimeout(() => {
      let idx = Math.floor(Math.random() * QIAN.length);
      if (QIAN.length > 1 && idx === lastQian) idx = (idx + 1 + Math.floor(Math.random() * (QIAN.length - 1))) % QIAN.length;
      lastQian = idx; curQian = idx;
      S.qianCount += 1; save();
      $('#stickNo').textContent = QIAN[idx].n.replace('第', '').replace('签', '');
      pop.classList.remove('gone'); pop.classList.add('up');
      Audio1.clack(1);
      setTimeout(() => { showQian(idx); pop.classList.add('gone'); pop.classList.remove('up'); }, 620);
      setTimeout(() => {
        busy = false;
        if (tip) tip.textContent = '轻点签筒 · 再摇一支';
        if ($('#shakeBtn')) $('#shakeBtn').textContent = '再摇一支';
      }, 1500);
    }, 760);
  }
  const shakeBtn = $('#shakeBtn');
  if (shakeBtn) shakeBtn.addEventListener('click', shake);
  const tubeTap = $('#tubeTap');
  if (tubeTap) {
    tubeTap.addEventListener('click', shake);
    tubeTap.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); shake(); } });
  }

  /* =====================================================
     殿三 · 木鱼
     ===================================================== */
  let streak = 0, streakTimer = null, lastTok = 0;
  function paintMerit() {
    $('#meritNum').textContent = S.merit;
    $('#meritToday').textContent = S.meritToday;
    $('#meritBest').textContent = S.best;
    $('#meritDays').textContent = S.days.length;
  }
  paintMerit();
  const muyuBtn = $('#muyuBtn');
  if (muyuBtn) {
    muyuBtn.addEventListener('click', () => {
      ensureDay();
      S.merit += 1; S.meritToday += 1;
      streak += 1; if (streak > S.best) S.best = streak;
      clearTimeout(streakTimer); streakTimer = setTimeout(() => { streak = 0; }, 2200);
      thump();
      save(); paintMerit(); paintStats();
    });
  }
  function thump() {
    const f = $('#meritFloat');
    if (f) { f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
    const b = $('#muyuBtn');
    if (b) { b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 180); }
    const now = Date.now();
    if (now - lastTok > 45) { lastTok = now; Audio1.tok(); }
  }
  const muyuReset = $('#muyuReset');
  if (muyuReset) muyuReset.addEventListener('click', () => {
    S.meritToday = 0; streak = 0; save(); paintMerit(); toast('今日已合账，功德不减');
  });

  /* =====================================================
     殿四 · 问禅
     ===================================================== */
  const CHAT_SYS = '你是一念寺的扫地僧，法号一念。你说话短、稳、不热络，像一位见过很多事的长辈。\n规则：1) 每次回复不超过 60 字，最多三句；2) 不灌鸡汤，不用"加油""你一定可以""相信自己"这类话；3) 先接住对方具体的情绪或处境，再给一个视角或一个很小的动作；4) 可以反问一句，但不要连问；5) 不做医疗、心理诊断、法律、投资方面的建议；6) 不评判对方的家人朋友；7) 对方若提到自伤、轻生，立刻放下禅语，温和而直接地请他联系身边能到场的人，或拨打全国心理援助热线 12356；8) 简体中文，不用 emoji，不用列表，不分点。';
  const QIAN_SYS = '你是寺院里替人解签的人，把古签文译成当下能用的话。\n要求：1) 先一语点明签意（趋势、阻碍、转机），用平实的话，不用佛偈腔；2) 结合对方所问，给一个方向判断，但不做绝对断言；3) 最后给一件今天就能做的、很小的具体事；4) 全文 90–140 字，两到三段，不用标题、不用列表、不用 emoji；5) 不涉及医疗、法律、投资的具体结论；6) 不用"命中注定""必成大业"这类断言。';

  const CRISIS_RE = /(自杀|轻生|不想活|活不下去|活着没意思|结束生命|死了算了|跳楼|割腕|自我了断|一了百了)/;
  const CRISIS_REPLY = '这话我接不住，也不该由我接。\n\n如果你此刻真的撑不住了，先做一件事：拨 12356（全国心理援助热线），或者立刻告诉一个能马上到你身边的人，让他过来陪你。\n\n我不走，你回来，我还在这。';

  const WISDOM = window.YN_DATA.WISDOM;
  function localReply(text) {
    let cat = 'default';
    if (/(在吗|你好|您好|哈喽|hello|hi\b)/i.test(text)) cat = 'hi';
    else if (/(睡|失眠|夜里|熬夜|睡不着)/.test(text)) cat = 'sleep';
    else if (/(工作|老板|同事|上班|辞职|裁员|面试|跳槽|项目|客户)/.test(text)) cat = 'work';
    else if (/(他|她|爸|妈|爸妈|孩子|老公|老婆|男朋友|女朋友|朋友|家人|家里|吵|冷战|分手)/.test(text)) cat = 'relation';
    else if (/(焦虑|慌|烦|压力|难受|崩溃|害怕|担心|紧张|不安|情绪)/.test(text)) cat = 'anxiety';
    else if (/(迷茫|不知道|想要什么|方向|意义|未来|选择)/.test(text)) cat = 'lost';
    const arr = WISDOM[cat] || WISDOM.default;
    const it = arr[Math.floor(Math.random() * arr.length)];
    return it.s + '\n\n' + it.q;
  }

  const chatEl = $('#chat');
  const chatInput = $('#chatInput');
  function msgEl(role, text) {
    const wrap = document.createElement('div');
    wrap.className = 'msg ' + role;
    const b = document.createElement('div');
    b.className = 'bubble';
    b.textContent = text; wrap.appendChild(b);
    return wrap;
  }
  const GREET = '坐。夜里风大，先把门掩上。\n\n有话就说，说不出也没关系，坐着也是坐着。';
  function renderChat() {
    chatEl.innerHTML = '';
    chatEl.appendChild(msgEl('master', GREET));
    if (S.chat.length) {
      S.chat.slice(-16).forEach(m => chatEl.appendChild(msgEl(m.r, m.t)));
    }
    const sys = msgEl('sys', '以下是你们说过的话，只留在本机。');
    if (S.chat.length) chatEl.appendChild(sys);
    scrollChat();
  }
  function scrollChat() { chatEl.scrollTop = chatEl.scrollHeight; }
  renderChat();

  function typingOn() {
    const t = document.createElement('div');
    t.className = 'msg master'; t.id = 'typing';
    const b = document.createElement('div'); b.className = 'bubble';
    b.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
    t.appendChild(b);
    chatEl.appendChild(t); scrollChat();
  }
  function typingOff() { const t = $('#typing'); if (t) t.remove(); }

  let sending = false;
  async function send(text) {
    text = (text || '').trim();
    if (!text || sending) return;
    sending = true;
    chatEl.appendChild(msgEl('user', text));
    S.chat.push({ r: 'user', t: text }); if (S.chat.length > 40) S.chat = S.chat.slice(-40); save();
    scrollChat();
    chatInput.value = ''; autoGrow();

    if (CRISIS_RE.test(text)) {
      typingOn();
      await wait(500);
      typingOff();
      chatEl.appendChild(msgEl('master', CRISIS_REPLY));
      S.chat.push({ r: 'master', t: CRISIS_REPLY }); save(); scrollChat();
      sending = false; return;
    }

    typingOn();
    let reply = '';
    if (aiReady()) {
      const history = S.chat.slice(-8).map(m => ({ role: m.r === 'user' ? 'user' : 'assistant', content: m.t }));
      const r = await callAI([{ role: 'system', content: CHAT_SYS }].concat(history), null, 300);
      reply = r.ok ? r.text : '';
      if (!r.ok) { reply = localReply(text); toast('模型未应答，师父先用老话接你'); }
    } else {
      await wait(650 + Math.random() * 600);
      reply = localReply(text);
    }
    typingOff();
    chatEl.appendChild(msgEl('master', reply));
    S.chat.push({ r: 'master', t: reply }); if (S.chat.length > 40) S.chat = S.chat.slice(-40); save();
    scrollChat(); sending = false;
  }
  function wait(ms) { return new Promise(res => setTimeout(res, ms)); }
  const sendBtn = $('#sendBtn');
  if (sendBtn) sendBtn.addEventListener('click', () => send(chatInput.value));
  function autoGrow() { chatInput.style.height = 'auto'; chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px'; }
  chatInput.addEventListener('input', autoGrow);
  chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(chatInput.value); }
  });
  $$('#chips .chip').forEach(c => c.addEventListener('click', () => send(c.getAttribute('data-say'))));

  /* =====================================================
     大模型接入
     ===================================================== */
  function aiReady() { const a = S.ai; return a.mode === 'ai' && !!String(a.key || '').trim() && !!String(a.base || '').trim() && !!String(a.model || '').trim(); }
  function paintMode() {
    const p = $('#modePill'); if (!p) return;
    if (aiReady()) { p.textContent = '大模型 · ' + S.ai.model.slice(0, 18); p.classList.add('on'); }
    else { p.textContent = '本地禅语'; p.classList.remove('on'); }
  }
  paintMode();

  async function callAI(messages, cfg, maxTokens) {
    cfg = cfg || S.ai;
    const base = String(cfg.base || '').trim().replace(/\/+$/, '');
    const model = String(cfg.model || '').trim();
    const key = String(cfg.key || '').trim();
    if (!base || !model || !key) return { ok: false, reason: '未配置完整' };
    const url = /\/chat\/completions$/.test(base) ? base : base + '/chat/completions';
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({ model: model, messages: messages, temperature: 0.75, max_tokens: maxTokens || 500 }),
        signal: ctrl.signal
      });
      if (!res.ok) { const t = await res.text(); return { ok: false, reason: 'HTTP ' + res.status + ' ' + t.replace(/\s+/g, ' ').slice(0, 90) }; }
      const j = await res.json();
      const txt = (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || (j && j.output && j.output.text) || '';
      if (!txt) return { ok: false, reason: '返回为空' };
      return { ok: true, text: String(txt).trim() };
    } catch (e) {
      return { ok: false, reason: e && e.name === 'AbortError' ? '请求超时（30s）' : ('网络或跨域失败 ' + (e && e.message ? e.message : '')) };
    } finally { clearTimeout(to); }
  }

  const PRESETS = {
    ark: { base: 'https://ark.cn-beijing.volces.com/api/v3', model: '', hint: '填方舟里的推理接入点 ID，如 ep-2024xxxx' },
    deepseek: { base: 'https://api.deepseek.com', model: 'deepseek-chat', hint: '' },
    openai: { base: 'https://api.openai.com/v1', model: 'gpt-4o-mini', hint: '' },
    custom: { base: '', model: '', hint: '' }
  };
  const sheetMask = $('#sheetMask');
  function openSheet() {
    $('#baseUrl').value = S.ai.base || '';
    $('#modelName').value = S.ai.model || '';
    $('#apiKey').value = S.ai.key || '';
    setMode(S.ai.mode || 'local');
    $('#sheetMsg').textContent = ''; $('#sheetMsg').className = 'sheet-msg';
    sheetMask.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeSheet() { sheetMask.classList.remove('open'); document.body.style.overflow = ''; }
  function setMode(m) {
    $$('#modeSeg button').forEach(b => b.classList.toggle('on', b.getAttribute('data-mode') === m));
    $('#aiFields').classList.toggle('hide', m !== 'ai');
  }
  $('#setBtn').addEventListener('click', openSheet);
  $('#sheetClose').addEventListener('click', closeSheet);
  sheetMask.addEventListener('click', e => { if (e.target === sheetMask) closeSheet(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheetMask.classList.contains('open')) closeSheet(); });
  $$('#modeSeg button').forEach(b => b.addEventListener('click', () => setMode(b.getAttribute('data-mode'))));
  $$('#presetRow button').forEach(b => b.addEventListener('click', () => {
    const p = PRESETS[b.getAttribute('data-p')];
    $$('#presetRow button').forEach(x => x.classList.toggle('on', x === b));
    if (p.base) $('#baseUrl').value = p.base;
    if (p.model) $('#modelName').value = p.model;
  }));

  $('#saveCfg').addEventListener('click', () => {
    const btnOn = $('#modeSeg button.on');
    const mode = btnOn ? btnOn.getAttribute('data-mode') : 'local';
    S.ai = { mode: mode, base: $('#baseUrl').value.trim(), model: $('#modelName').value.trim(), key: $('#apiKey').value.trim() };
    save(); paintMode();
    const m = $('#sheetMsg');
    if (mode === 'ai' && !aiReady()) { m.textContent = '已保存，但配置不完整，先按本地模式运行'; m.className = 'sheet-msg err'; }
    else { m.textContent = mode === 'ai' ? '已保存，下次说话就由模型应答' : '已切回本地禅语'; m.className = 'sheet-msg ok'; }
    toast(mode === 'ai' && aiReady() ? '已接入大模型' : '已保存');
  });

  $('#testCfg').addEventListener('click', async () => {
    const m = $('#sheetMsg');
    const tmp = { base: $('#baseUrl').value.trim(), model: $('#modelName').value.trim(), key: $('#apiKey').value.trim() };
    if (!tmp.base || !tmp.model || !tmp.key) { m.textContent = '三项都要填才能测'; m.className = 'sheet-msg err'; return; }
    m.textContent = '正在试…'; m.className = 'sheet-msg';
    const r = await callAI([{ role: 'user', content: '只回两个字：安好' }], tmp, 24);
    if (r.ok) { m.textContent = '通了。模型回了：' + r.text.slice(0, 20); m.className = 'sheet-msg ok'; }
    else { m.textContent = '没通：' + r.reason; m.className = 'sheet-msg err'; }
  });

  /* =====================================================
     导航 / 进场
     ===================================================== */
  const secs = $$('main section[id]');
  const links = $$('.rail a, .dock a');
  if ('IntersectionObserver' in window) {
    const navObs = new IntersectionObserver(es => {
      es.forEach(e => {
        if (e.isIntersecting) {
          const id = e.target.id;
          links.forEach(l => l.classList.toggle('on', l.getAttribute('href') === '#' + id));
        }
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    secs.forEach(s => navObs.observe(s));

    const revObs = new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); revObs.unobserve(e.target); } });
    }, { threshold: 0.14 });
    $$('.reveal').forEach(el => revObs.observe(el));
  } else {
    $$('.reveal').forEach(el => el.classList.add('in'));
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  save();
})();
