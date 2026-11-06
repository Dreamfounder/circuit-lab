/* Circuit Lab — canvas renderer and mobile UI. */
(function () {
  'use strict';

  const CL = window.CL;
  const E = CL.Engine;
  const S = E.state;
  const DEFS = CL.DEFS;

  window.__errors = [];
  window.addEventListener('error', (event) => {
    window.__errors.push(String(event.message || event.error || 'unknown'));
  });
  window.addEventListener('unhandledrejection', (event) => {
    window.__errors.push('unhandled: ' + String(event.reason || 'unknown'));
  });

  const $ = (id) => document.getElementById(id);
  const FONT = '-apple-system, "Segoe UI", Roboto, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';
  const MONO = '"Cascadia Code", "SFMono-Regular", "Roboto Mono", Consolas, monospace';
  const clamp = CL.clamp;

  const dom = {
    app: $('app'),
    topbar: $('topbar'),
    stage: $('stage'),
    board: $('board'),
    palette: $('palette'),
    paletteList: $('paletteList'),
    paletteToggle: $('paletteToggle'),
    paletteClose: $('paletteClose'),
    levelPill: $('levelPill'),
    levelPillText: $('levelPillText'),
    undoBtn: $('undoBtn'),
    redoBtn: $('redoBtn'),
    soundBtn: $('soundBtn'),
    helpBtn: $('helpBtn'),
    menuBtn: $('menuBtn'),
    emptyHint: $('emptyHint'),
    goalCard: $('goalCard'),
    goalEyebrow: $('goalEyebrow'),
    goalTitle: $('goalTitle'),
    goalObjective: $('goalObjective'),
    goalTable: $('goalTable'),
    goalCheck: $('goalCheck'),
    goalLesson: $('goalLesson'),
    goalToggle: $('goalToggle'),
    monitor: $('monitor'),
    zoomIn: $('zoomIn'),
    zoomOut: $('zoomOut'),
    fitView: $('fitView'),
    toast: $('toast'),
    fxLayer: $('fxLayer'),
    runBtn: $('runBtn'),
    stepBtn: $('stepBtn'),
    deleteBtn: $('deleteBtn'),
    truthBtn: $('truthBtn'),
    checkBtn: $('checkBtn'),
    toolbar: $('toolbar'),
    scrim: $('scrim'),
    sheetWrap: $('sheetWrap'),
    sheet: $('sheet'),
    sheetEyebrow: $('sheetEyebrow'),
    sheetTitle: $('sheetTitle'),
    sheetBody: $('sheetBody'),
    sheetFoot: $('sheetFoot'),
    sheetClose: $('sheetClose'),
    modalWrap: $('modalWrap'),
    modal: $('modal')
  };
  const canvas = dom.board;
  const ctx = canvas.getContext('2d', { alpha: false });

  let W = 1, H = 1, DPR = 1;
  let lastW = 0, lastH = 0;
  let lastDraw = 0;
  let lastChromeKey = '';
  let lastGoalKey = '';
  let goalCollapsed = false;
  let hoverPin = null;
  let hoverNode = null;
  let pointers = new Map();
  let mode = 'idle';
  let drag = null;
  let pinch = null;
  let toastTimer = null;
  let audioCtx = null;
  let soundOn = true;
  let sheetOpen = false;
  let modalOpen = false;
  let paletteOpen = false;
  let lastTruth = null;
  let bootDone = false;
  let initialFitDone = false;
  let hasUserCamera = false;
  let welcomeShowing = false;
  let lessonsSeen = {};
  let lessonShowing = false;
  let lessonLevelId = null;
  let lessonFromPicker = false;

  /* ------------------------------------------------------------------ utils */
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function valText(v, width) { return CL.valueText(v, width); }
  function nodeName(node) {
    if (!node) return '—';
    if (node.name) return node.name;
    return DEFS[node.type].label;
  }
  function displayName(node) {
    if (!node) return '—';
    return node.name ? node.name : DEFS[node.type].label;
  }
  function widthOfName(name) {
    const n = E.findByPortName(name);
    if (!n) return 1;
    return (n.type === 'NIB' || n.type === 'HEX') ? 4 : 1;
  }
  function setUse(btn, href) {
    const use = btn.querySelector('use');
    if (use) use.setAttribute('href', href);
  }
  function haptic(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms || 7); } catch (e) { /* ignore */ }
  }
  function ensureAudio() {
    if (!soundOn) return;
    try {
      if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audioCtx = new AC();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { audioCtx = null; }
  }
  function tone(freq, dur, type, volume, delay) {
    if (!soundOn) return;
    ensureAudio();
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime + (delay || 0);
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume || 0.035, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + (dur || 0.06));
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + (dur || 0.06) + 0.02);
  }
  function sfxConnect() { tone(660, 0.05, 'sine', 0.028); tone(990, 0.07, 'sine', 0.022, 0.045); haptic(8); }
  function sfxTap() { tone(480, 0.035, 'triangle', 0.018); haptic(5); }
  function sfxDelete() { tone(220, 0.06, 'sawtooth', 0.02); haptic(10); }
  function sfxError() { tone(150, 0.09, 'sawtooth', 0.025); haptic(16); }
  function sfxSuccess() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.16, 'sine', 0.035, i * 0.085));
    haptic([12, 30, 18]);
  }

  function showToast(message, kind) {
    if (!dom.toast) return;
    clearTimeout(toastTimer);
    dom.toast.textContent = message;
    dom.toast.className = 'toast show' + (kind ? ' ' + kind : '');
    toastTimer = setTimeout(() => {
      dom.toast.className = 'toast' + (kind ? ' ' + kind : '');
    }, 2400);
  }

  function burstConfetti() {
    if (!dom.fxLayer) return;
    const colors = ['#40f2b0', '#55c9ff', '#ffc857', '#ff7e9f', '#c18bff', '#d7fff4'];
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight * 0.38;
    for (let i = 0; i < 46; i++) {
      const p = document.createElement('i');
      p.className = 'particle';
      p.style.left = (cx + (Math.random() - 0.5) * 90) + 'px';
      p.style.top = (cy + (Math.random() - 0.5) * 30) + 'px';
      p.style.setProperty('--pc', colors[i % colors.length]);
      p.style.setProperty('--dx', ((Math.random() - 0.5) * 340) + 'px');
      p.style.setProperty('--dy', ((Math.random() * 260) + 80) + 'px');
      p.style.setProperty('--rot', ((Math.random() - 0.5) * 900) + 'deg');
      p.style.animationDelay = (Math.random() * 0.12) + 's';
      p.style.width = (5 + Math.random() * 5) + 'px';
      p.style.height = (8 + Math.random() * 9) + 'px';
      dom.fxLayer.appendChild(p);
      setTimeout(() => p.remove(), 1900);
    }
  }

  function copyText(text) {
    const done = () => showToast('已复制到剪贴板');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
        return;
      }
    } catch (e) { /* ignore */ }
    fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      done();
    } catch (e) {
      showToast('复制失败，请截图保存', 'warn');
    }
  }

  /* --------------------------------------------------------------- viewport */
  function screenOf(x, y) {
    const s = S.camera.scale;
    return { x: (x - S.camera.x) * s + W / 2, y: (y - S.camera.y) * s + H / 2 };
  }
  function worldOf(sx, sy) {
    const s = S.camera.scale;
    return { x: (sx - W / 2) / s + S.camera.x, y: (sy - H / 2) / s + S.camera.y };
  }
  function eventPoint(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function zoomAt(factor, sx, sy) {
    const before = worldOf(sx, sy);
    const next = clamp(S.camera.scale * factor, 0.28, 2.8);
    if (Math.abs(next - S.camera.scale) < 0.0001) return;
    S.camera.scale = next;
    S.camera.x = before.x - (sx - W / 2) / next;
    S.camera.y = before.y - (sy - H / 2) / next;
    hasUserCamera = true;
  }
  function fitView(userInitiated) {
    E.fitCamera(W, H);
    hasUserCamera = !!userInitiated;
    render(performance.now());
  }
  function resizeCanvas() {
    const rect = dom.stage.getBoundingClientRect();
    const nw = Math.max(1, Math.round(rect.width));
    const nh = Math.max(1, Math.round(rect.height));
    const oldW = W, oldH = H;
    W = nw; H = nh;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (!initialFitDone && bootDone && W > 2 && H > 2) {
      initialFitDone = true;
      if (S.nodes.length) E.fitCamera(W, H);
      render(performance.now());
    } else if (oldW > 2 && oldH > 2 && ((oldW < oldH) !== (W < H))) {
      setTimeout(() => { if (!hasUserCamera) fitView(); }, 220);
    }
    lastW = W; lastH = H;
    render(performance.now());
  }

  /* ---------------------------------------------------------------- palette */
  function glyphFor(key) {
    return ({
      IN: '1/0', NIB: '4b', CONST: '1', CLK: '∿',
      AND: '&', OR: '≥1', NOT: '¬', NAND: '⊼', NOR: '⊽', XOR: '⊕', XNOR: '⊙',
      SPLIT: '1→4', MERGE: '4→1', MUX2: 'MUX', ADD4: '+',
      DFF: 'D', REG4: 'R4', OUT: 'LED', HEX: '7s'
    })[key] || key;
  }

  function gatePaletteIcon(type) {
    const base = type.replace(/3$/, '');
    const bubble = (cx) => '<circle cx="' + cx + '" cy="14" r="2.4"/>';
    let shape = '';
    if (base === 'AND' || base === 'NAND') {
      shape = '<path d="M5 5h14a9 9 0 0 1 0 18H5Z"/>';
      if (base === 'NAND') shape += bubble(31);
    } else if (base === 'OR' || base === 'NOR' || base === 'XOR' || base === 'XNOR') {
      shape = '<path d="M4 4c11 0 20 4 28 10-8 6-17 10-28 10 6-6 6-14 0-20Z"/>';
      if (base === 'XOR' || base === 'XNOR') shape += '<path d="M1 4c6 6 6 14 0 20"/>';
      if (base === 'NOR' || base === 'XNOR') shape += bubble(35);
    } else if (base === 'NOT') {
      shape = '<path d="M7 4 27 14 7 24Z"/>' + bubble(30);
    }
    if (type.endsWith('3')) {
      shape += '<path d="M1 7h4M1 14h4M1 21h4"/>';
    }
    return '<svg viewBox="0 0 40 28" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + shape + '</svg>';
  }

  function buildPalette() {
    dom.paletteList.innerHTML = '';
    for (const section of CL.PALETTE) {
      const wrap = document.createElement('section');
      wrap.className = 'pal-section';
      const title = document.createElement('h3');
      title.className = 'pal-section-title';
      title.textContent = section.section;
      wrap.appendChild(title);
      const grid = document.createElement('div');
      grid.className = 'pal-grid';
      for (const key of section.keys) {
        const def = DEFS[key];
        const fam = CL.FAMILIES[def.family];
        const btn = document.createElement('button');
        btn.className = 'pal-item';
        btn.dataset.key = key;
        btn.style.setProperty('--c', fam.color);
        btn.title = def.hint;
        const isGate = def.family === 'logic';
        btn.innerHTML =
          '<span class="pal-glyph' + (isGate ? ' gate-glyph' : '') + '">' + (isGate ? gatePaletteIcon(key) : esc(glyphFor(key))) + '</span>' +
          '<span class="pal-name">' + esc(def.label) + '</span>' +
          '<svg class="lock"><use href="#i-lock"/></svg>';
        btn.addEventListener('click', () => addComponent(key));
        grid.appendChild(btn);
      }
      wrap.appendChild(grid);
      dom.paletteList.appendChild(wrap);
    }
    updatePaletteLocks();
  }

  function levelAllowed(key) {
    if (S.mode !== 'level') return true;
    const lv = CL.levelById(S.levelId);
    if (!lv) return true;
    if (!Array.isArray(lv.allowed)) return false;
    if (lv.allowed.includes(key)) return true;
    // Three-input gates are variants of the base gate, so a level that allows
    // AND also allows AND3 (same for OR / NAND / NOR / XOR / XNOR).
    return key.endsWith('3') && lv.allowed.includes(key.slice(0, -1));
  }

  function updatePaletteLocks() {
    let allowedCount = 0;
    dom.paletteList.querySelectorAll('.pal-item').forEach((btn) => {
      const ok = levelAllowed(btn.dataset.key);
      btn.classList.toggle('locked', !ok);
      btn.setAttribute('aria-disabled', ok ? 'false' : 'true');
      if (ok) allowedCount++;
    });
    const foot = dom.palette.querySelector('.palette-foot span:last-child');
    if (foot) {
      if (S.mode === 'level' && allowedCount === 0) foot.textContent = '本关只需连线';
      else foot.textContent = '点击放入画布';
    }
  }

  function addComponent(key) {
    if (!levelAllowed(key)) {
      showToast('本关不提供这个元件', 'warn');
      sfxError();
      return;
    }
    const def = DEFS[key];
    const h = Math.max(def.minH || 86, 44);
    let wx = S.camera.x - def.w / 2;
    let wy = S.camera.y - h / 2;
    let attempt = 0;
    const overlaps = (x, y) => S.nodes.some((n) => {
      const w = CL.NODE_WIDTH(n);
      const nh = CL.nodeHeight(n);
      return !(x + def.w + 12 < n.x || x > n.x + w + 12 || y + h + 12 < n.y || y > n.y + nh + 12);
    });
    while (overlaps(wx, wy) && attempt < 14) {
      attempt++;
      wx += 26;
      wy += 26;
    }
    const node = E.addNode(key, wx, wy);
    E.setSelected({ kind: 'node', id: node.id });
    sfxTap();
    showToast('已添加 ' + def.label + ' · 拖动端口开始连线');
    if (isMobilePalette()) closePalette();
    requestRender();
  }

  function isMobilePalette() {
    return window.matchMedia('(max-width: 760px)').matches;
  }
  function openPalette() {
    if (isMobilePalette()) {
      paletteOpen = true;
      dom.palette.classList.add('open');
      dom.scrim.classList.remove('hidden');
    } else {
      dom.app.classList.remove('palette-collapsed');
    }
  }
  function closePalette() {
    paletteOpen = false;
    dom.palette.classList.remove('open');
    dom.scrim.classList.add('hidden');
    if (!isMobilePalette()) dom.app.classList.add('palette-collapsed');
  }
  function togglePalette() {
    if (isMobilePalette()) {
      if (paletteOpen) closePalette(); else openPalette();
    } else {
      const collapsed = dom.app.classList.toggle('palette-collapsed');
      if (collapsed) showToast('元件库已收起，点左上角网格图标展开');
    }
  }

  /* ------------------------------------------------------------ chrome / UI */
  function updateChrome(force) {
    syncToolUI();
    updateLevelPill();
    updateRunUI();
    updateUndoRedo();
    updateSelectionUI();
    updateMonitor();
    dom.emptyHint.classList.toggle('hidden', S.nodes.length > 0);
    dom.checkBtn.querySelector('span').textContent = S.mode === 'level' ? '验证' : '自检';
    const key = S.mode + ':' + (S.levelId || '');
    if (force || key !== lastChromeKey) {
      lastChromeKey = key;
      updatePaletteLocks();
      updateGoalCard();
    }
    dom.goalCard.classList.toggle('hidden', S.mode !== 'level');
  }

  function syncToolUI() {
    document.querySelectorAll('.tool-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.tool === S.tool);
    });
    document.body.classList.toggle('tool-wire', S.tool === 'wire');
    document.body.classList.toggle('tool-erase', S.tool === 'erase');
  }

  function updateLevelPill() {
    const lv = S.mode === 'level' ? CL.levelById(S.levelId) : null;
    if (lv) {
      dom.levelPillText.textContent = '关卡 ' + lv.num + ' · ' + lv.title;
      dom.levelPill.classList.add('is-level');
      dom.levelPill.title = '打开关卡选择';
    } else {
      dom.levelPillText.textContent = '自由沙盒';
      dom.levelPill.classList.remove('is-level');
      dom.levelPill.title = '打开关卡选择 / 自由沙盒';
    }
  }

  function updateRunUI() {
    dom.runBtn.classList.toggle('running', S.running);
    dom.runBtn.classList.toggle('paused', !S.running);
    setUse(dom.runBtn, S.running ? '#i-pause' : '#i-play');
    dom.runBtn.querySelector('span').textContent = S.running ? '运行中' : '已暂停';
  }
  function updateUndoRedo() {
    dom.undoBtn.disabled = !E.canUndo();
    dom.redoBtn.disabled = !E.canRedo();
  }
  function updateSelectionUI() {
    const has = !!(S.selected && (S.selected.kind === 'node' || S.selected.kind === 'wire'));
    dom.deleteBtn.classList.toggle('hidden', !has);
  }

  function updateMonitor() {
    const inputs = S.nodes.filter((n) => (n.type === 'IN' || n.type === 'NIB' || n.type === 'CONST') && n.name)
      .slice().sort((a, b) => (a.x - b.x) || (a.y - b.y));
    const outputs = S.nodes.filter((n) => (n.type === 'OUT' || n.type === 'HEX') && n.name)
      .slice().sort((a, b) => (a.x - b.x) || (a.y - b.y));
    if (!inputs.length && !outputs.length) {
      dom.monitor.classList.add('hidden');
      dom.monitor.replaceChildren();
      return;
    }
    dom.monitor.classList.remove('hidden');
    const frag = document.createDocumentFragment();
    for (const node of inputs) {
      const width = node.type === 'NIB' ? 4 : 1;
      const v = node.value | 0;
      const el = document.createElement('button');
      el.className = 'io-chip input' + (v ? ' high' : '') + (width === 4 ? ' bus' : '');
      el.title = node.frozen
        ? '固定常量 ' + node.name + ' = ' + v
        : width === 4
          ? '点击 +1 改变 ' + node.name + '（当前十进制 ' + v + '）'
          : '点击切换 ' + node.name + ' 的值';
      el.dataset.input = node.name;
      el.innerHTML = '<span class="io-label">' + esc(node.name) + '</span><span class="io-val">' + esc(valText(v, width)) + '</span>';
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const changed = E.toggleNode(node.id);
        if (changed) {
          sfxTap();
          if (node.type === 'NIB') showToast(node.name + ' = 0x' + (node.value | 0).toString(16).toUpperCase());
        }
      });
      frag.appendChild(el);
    }
    if (inputs.length && outputs.length) {
      const arrow = document.createElement('span');
      arrow.className = 'io-arrow';
      arrow.textContent = '→';
      frag.appendChild(arrow);
    }
    for (const node of outputs) {
      const width = node.type === 'HEX' ? 4 : 1;
      const v = E.readNamedOutput(node);
      const el = document.createElement('div');
      el.className = 'io-chip output' + (v ? ' high' : '') + (width === 4 ? ' bus' : '');
      el.title = width === 4 ? node.name + ' 的十进制值：' + v : node.name + ' = ' + v;
      el.innerHTML = '<span class="io-label">' + esc(node.name) + '</span><span class="io-val">' + esc(valText(v, width)) + '</span>';
      frag.appendChild(el);
    }
    dom.monitor.replaceChildren(frag);
  }

  function updateGoalCard() {
    const lv = S.mode === 'level' ? CL.levelById(S.levelId) : null;
    if (!lv) return;
    const goalKey = S.levelId;
    if (goalKey !== lastGoalKey) {
      lastGoalKey = goalKey;
      // On phone-sized stages the expanded card would cover the output nodes.
      // Start collapsed; the title and a tap are enough to open the full goal.
      goalCollapsed = (W < 760 || H < 320);
    }
    dom.goalEyebrow.textContent = 'LEVEL ' + lv.num + ' · ' + lv.tag;
    dom.goalTitle.textContent = lv.title;
    dom.goalObjective.textContent = lv.objective;
    dom.goalTable.innerHTML = miniTableHTML(lv);
    dom.goalCard.classList.toggle('collapsed', goalCollapsed);
    dom.goalCard.querySelector('#goalToggle use').setAttribute('href', goalCollapsed ? '#i-target' : '#i-chevron');
    dom.goalToggle.title = goalCollapsed ? '展开关卡目标' : '收起关卡目标';
  }

  function miniTableHTML(lv) {
    const tests = lv.tests;
    const inWidths = tests.inputs.map((name) => widthOfName(name));
    const outWidths = tests.outputs.map((name) => widthOfName(name));
    const sequence = Array.isArray(tests.sequence);
    let html = '<table class="mini-table"><thead><tr><th></th>';
    tests.inputs.forEach((name, i) => {
      html += '<th>' + esc(name) + (inWidths[i] === 4 ? '·4' : '') + '</th>';
    });
    if (sequence) html += '<th>CLK</th>';
    tests.outputs.forEach((name, i) => {
      html += '<th>' + esc(name) + (outWidths[i] === 4 ? '·4' : '') + '</th>';
    });
    html += '</tr></thead><tbody>';
    const rows = sequence ? tests.sequence : tests.vectors;
    rows.forEach((v, idx) => {
      html += '<tr><td class="row-num">' + (idx + 1) + '</td>';
      tests.inputs.forEach((name, i) => {
        html += '<td>' + esc(valText(v[name] | 0, inWidths[i])) + '</td>';
      });
      if (sequence) {
        const prev = rows[idx - 1];
        const clk = v.clock ? (prev && prev.clock ? '1' : '↑') : '0';
        html += '<td class="out">' + clk + '</td>';
      }
      tests.outputs.forEach((name, i) => {
        html += '<td class="out">' + esc(valText(v[name] | 0, outWidths[i])) + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    return html;
  }

  function toggleGoal() {
    goalCollapsed = !goalCollapsed;
    dom.goalCard.classList.toggle('collapsed', goalCollapsed);
    dom.goalCard.querySelector('#goalToggle use').setAttribute('href', goalCollapsed ? '#i-target' : '#i-chevron');
    dom.goalToggle.title = goalCollapsed ? '展开关卡目标' : '收起关卡目标';
  }

  /* --------------------------------------------------------------- drawing */
  function requestRender() { /* the animation loop draws continuously */ }

  function roundRectPath(c, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }
  function font(px, weight, mono) {
    return (weight || 500) + ' ' + Math.max(6, px) + 'px ' + (mono ? MONO : FONT);
  }
  function rgba(hex, a) {
    const v = hex.replace('#', '');
    const n = parseInt(v.length === 3 ? v.split('').map((x) => x + x).join('') : v, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function drawBackground(t) {
    const g = ctx.createRadialGradient(W * 0.64, H * 0.22, 0, W * 0.64, H * 0.22, Math.max(W, H) * 0.85);
    g.addColorStop(0, '#0a2739');
    g.addColorStop(0.5, '#061827');
    g.addColorStop(1, '#030e19');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const s = S.camera.scale;
    let minor = 28;
    if (minor * s < 13) minor *= 2;
    if (minor * s < 9) minor *= 2;
    const left = S.camera.x - W / (2 * s);
    const right = S.camera.x + W / (2 * s);
    const top = S.camera.y - H / (2 * s);
    const bottom = S.camera.y + H / (2 * s);
    const startX = Math.ceil(left / minor) * minor;
    const startY = Math.ceil(top / minor) * minor;
    ctx.lineWidth = 1;
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      for (let x = startX; x <= right; x += minor) {
        const major = Math.round(x / minor) % 5 === 0;
        if ((pass === 0) !== major) continue;
        const sx = Math.round((x - S.camera.x) * s + W / 2) + 0.5;
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, H);
      }
      for (let y = startY; y <= bottom; y += minor) {
        const major = Math.round(y / minor) % 5 === 0;
        if ((pass === 0) !== major) continue;
        const sy = Math.round((y - S.camera.y) * s + H / 2) + 0.5;
        ctx.moveTo(0, sy);
        ctx.lineTo(W, sy);
      }
      ctx.strokeStyle = pass === 0 ? 'rgba(100,190,195,0.035)' : 'rgba(100,200,205,0.065)';
      ctx.stroke();
    }

    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,6,12,0.38)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    if (S.unstable) {
      const label = '⚠ 电路振荡 · 检查反馈环路';
      ctx.font = font(11, 700);
      const tw = ctx.measureText(label).width;
      const bw = tw + 24;
      roundRectPath(ctx, W / 2 - bw / 2, 10, bw, 26, 13);
      ctx.fillStyle = 'rgba(47, 16, 24, 0.92)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,110,118,.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#ffb4b8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, W / 2, 23);
    }
  }

  function cubicPoint(p0, c1, c2, p1, t) {
    const u = 1 - t;
    return {
      x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x,
      y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y
    };
  }

  function wireGeom(wire) {
    const aNode = E.nodeById(wire.from.n);
    const bNode = E.nodeById(wire.to.n);
    if (!aNode || !bNode) return null;
    const aDef = DEFS[aNode.type];
    const bDef = DEFS[bNode.type];
    const ai = aDef.outputs.findIndex((p) => p.id === wire.from.p);
    const bi = bDef.inputs.findIndex((p) => p.id === wire.to.p);
    if (ai < 0 || bi < 0) return null;
    const aw = CL.outputPortPos(aNode, ai);
    const bw = CL.inputPortPos(bNode, bi);
    const a = screenOf(aw.x, aw.y);
    const b = screenOf(bw.x, bw.y);
    const s = S.camera.scale;
    let bend = Math.max(34, Math.min(130, Math.abs(b.x - a.x) * 0.48));
    if (b.x < a.x + 20) bend = Math.max(60, bend);
    const c1 = { x: a.x + bend, y: a.y };
    const c2 = { x: b.x - bend, y: b.y };
    const pts = [];
    for (let i = 0; i <= 28; i++) pts.push(cubicPoint(a, c1, c2, b, i / 28));
    const mid = cubicPoint(a, c1, c2, b, 0.5);
    const del = cubicPoint(a, c1, c2, b, 0.62);
    return { a, b, c1, c2, pts, mid, del, width: aDef.outputs[ai].width };
  }

  function wireValue(wire) {
    const n = E.nodeById(wire.from.n);
    if (!n || !n._out) return 0;
    return n._out[wire.from.p] | 0;
  }

  function drawWire(wire, t, selected) {
    const ge = wireGeom(wire);
    if (!ge) return;
    wire._geo = ge;
    wire._del = null;
    const v = wireValue(wire);
    const bus = ge.width === 4;
    let color = bus ? (v ? '#ffc857' : '#66512e') : (v ? '#40f2b0' : '#31566a');
    if (selected) color = '#d8fff3';
    const baseW = bus ? 4.6 : 2.7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // dark underlay for contrast
    ctx.beginPath();
    ctx.moveTo(ge.a.x, ge.a.y);
    ctx.bezierCurveTo(ge.c1.x, ge.c1.y, ge.c2.x, ge.c2.y, ge.b.x, ge.b.y);
    ctx.strokeStyle = 'rgba(2,9,16,0.9)';
    ctx.lineWidth = baseW + 3.2;
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(ge.a.x, ge.a.y);
    ctx.bezierCurveTo(ge.c1.x, ge.c1.y, ge.c2.x, ge.c2.y, ge.b.x, ge.b.y);
    if (v || selected) {
      ctx.shadowColor = color;
      ctx.shadowBlur = selected ? 12 : 8;
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = selected ? baseW + 1 : baseW;
    ctx.stroke();
    ctx.restore();
    if (selected) {
      ctx.save();
      ctx.setLineDash([4, 5]);
      ctx.lineDashOffset = -t / 40;
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    }
    if (v && !bus) {
      const u = ((t / 2100 + (wire.id * 0.137) % 1) % 1);
      const p = cubicPoint(ge.a, ge.c1, ge.c2, ge.b, u);
      ctx.save();
      ctx.fillStyle = '#d8fff3';
      ctx.shadowColor = '#40f2b0';
      ctx.shadowBlur = 9;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (bus && S.camera.scale > 0.5) {
      const p = ge.mid;
      const label = valText(v, 4);
      roundRectPath(ctx, p.x - 11, p.y - 8, 22, 16, 4);
      ctx.fillStyle = 'rgba(19,15,6,.94)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,200,87,.48)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#ffd77d';
      ctx.font = font(9, 700, true);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, p.x, p.y + 0.5);
    }
    if (selected) {
      const p = ge.del;
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(38,12,18,.96)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,110,118,.85)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.strokeStyle = '#ffb4b8';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(p.x - 4, p.y - 4);
      ctx.lineTo(p.x + 4, p.y + 4);
      ctx.moveTo(p.x + 4, p.y - 4);
      ctx.lineTo(p.x - 4, p.y + 4);
      ctx.stroke();
      ctx.restore();
      wire._del = { x: p.x, y: p.y, r: 15 };
    }
  }

  function nodeScreen(node) {
    const s = S.camera.scale;
    return {
      x: (node.x - S.camera.x) * s + W / 2,
      y: (node.y - S.camera.y) * s + H / 2,
      w: CL.NODE_WIDTH(node) * s,
      h: CL.nodeHeight(node) * s,
      s
    };
  }

  function nodeIsHot(node) {
    const d = DEFS[node.type];
    if (d.display) {
      if (node.type === 'OUT') return (E.readInput(node, 'X') & 1) === 1;
      if (node.type === 'HEX') return (E.readInput(node, 'D') & 15) !== 0;
      return false;
    }
    if (!node._out) return false;
    return d.outputs.some((p) => (node._out[p.id] | 0) !== 0);
  }

  /* Standard schematic gate symbols, drawn as the node itself. */
  function drawGateNode(node, t, r, selected, hot, fam) {
    const type = node.type;
    const baseType = type.replace(/3$/, '');
    const def = DEFS[type];
    const s = r.s;
    const x = r.x, y = r.y, w = r.w, h = r.h;
    const isNot = baseType === 'NOT';
    const isOrFamily = baseType === 'OR' || baseType === 'NOR' || baseType === 'XOR' || baseType === 'XNOR';
    const hasBubble = baseType === 'NAND' || baseType === 'NOR' || baseType === 'XNOR' || baseType === 'NOT';
    const outputY = y + (CL.portY(node, 0, def.outputs.length) - node.y) * s;
    const inputYs = def.inputs.map((p, i) =>
      y + (CL.portY(node, i, def.inputs.length) - node.y) * s
    );
    const bodyH = (isNot ? 60 : (def.inputs.length >= 3 ? 92 : 70)) * s;
    const top = outputY - bodyH / 2;
    const bottom = outputY + bodyH / 2;
    const left = x + (isNot ? 26 : 22) * s;
    const tip = x + w - (hasBubble ? 24 : 14) * s;
    const bubbleR = 5.5 * s;
    const bubbleCx = tip + bubbleR + 2 * s;
    const outputEdge = hasBubble ? bubbleCx + bubbleR : tip;

    // Pin leads.
    ctx.strokeStyle = rgba(fam.color, 0.48);
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    inputYs.forEach((iy) => {
      ctx.beginPath();
      ctx.moveTo(x, iy);
      ctx.lineTo(isOrFamily ? left + 8 * s : left, iy);
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.moveTo(outputEdge, outputY);
    ctx.lineTo(x + w, outputY);
    ctx.stroke();

    // Gate body path.
    const gatePath = () => {
      ctx.beginPath();
      if (isNot) {
        ctx.moveTo(left, top);
        ctx.lineTo(tip, outputY);
        ctx.lineTo(left, bottom);
        ctx.closePath();
      } else if (isOrFamily) {
        const bodyW = tip - left;
        ctx.moveTo(left, top);
        ctx.bezierCurveTo(left + bodyW * 0.55, top, tip - bodyW * 0.18, outputY - bodyH * 0.28, tip, outputY);
        ctx.bezierCurveTo(tip - bodyW * 0.18, outputY + bodyH * 0.28, left + bodyW * 0.55, bottom, left, bottom);
        ctx.quadraticCurveTo(left + bodyW * 0.20, outputY, left, top);
        ctx.closePath();
      } else {
        const midX = tip - bodyH / 2;
        ctx.moveTo(left, top);
        ctx.lineTo(midX, top);
        ctx.arc(midX, outputY, bodyH / 2, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(left, bottom);
        ctx.closePath();
      }
    };

    gatePath();
    const fill = ctx.createLinearGradient(0, top, 0, bottom);
    fill.addColorStop(0, 'rgba(11,42,62,.96)');
    fill.addColorStop(1, 'rgba(5,22,36,.96)');
    ctx.save();
    if (hot || selected) {
      ctx.shadowColor = selected ? 'rgba(216,255,243,.5)' : rgba(fam.color, 0.38);
      ctx.shadowBlur = selected ? 18 : 12;
    }
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();
    gatePath();
    ctx.strokeStyle = selected ? 'rgba(216,255,243,.95)' : rgba(fam.color, hot ? 0.95 : 0.72);
    ctx.lineWidth = selected ? 2.1 : 1.7;
    ctx.stroke();

    // XOR/XNOR get the second, separate input curve.
    if (baseType === 'XOR' || baseType === 'XNOR') {
      ctx.beginPath();
      ctx.moveTo(left - 7 * s, top + 1.5 * s);
      ctx.quadraticCurveTo(left + 3 * s, outputY, left - 7 * s, bottom - 1.5 * s);
      ctx.strokeStyle = rgba(fam.color, 0.9);
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    // Inversion bubble.
    if (hasBubble) {
      ctx.beginPath();
      ctx.arc(bubbleCx, outputY, bubbleR, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(5,22,36,.98)';
      ctx.fill();
      ctx.strokeStyle = rgba(fam.color, 0.88);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Name above the symbol and pin labels.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (s > 0.34) {
      ctx.font = font(Math.min(9, Math.max(6, 8.5 * s)), 650);
      ctx.fillStyle = rgba(fam.color, 0.86);
      ctx.fillText(s > 0.58 ? def.en + ' · ' + def.label : def.en, x + w / 2, top - 10 * s);
    }
    if (s > 0.42) {
      ctx.textAlign = 'left';
      ctx.font = font(Math.min(8.5, Math.max(6, 7.5 * s)), 650, true);
      ctx.fillStyle = 'rgba(165,199,207,.82)';
      def.inputs.forEach((p, i) => {
        ctx.fillText(p.label, left + (isOrFamily ? 12 : 6) * s, inputYs[i] + 0.5);
      });
      ctx.textAlign = 'right';
      const val = node._out ? (node._out.Y | 0) : 0;
      ctx.fillStyle = val ? '#c8ffec' : 'rgba(126,166,174,.68)';
      ctx.fillText(String(val), x + w - 7 * s, outputY - 10 * s);
    }

    if (selected) {
      ctx.save();
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = 'rgba(216,255,243,.42)';
      ctx.lineWidth = 1;
      roundRectPath(ctx, x - 3, y - 3, w + 6, h + 6, 9 * s);
      ctx.stroke();
      ctx.restore();
    }

    drawPorts(node, x, y, w, h, s, t);
  }

  function drawNode(node, t) {
    const def = DEFS[node.type];
    const fam = CL.FAMILIES[def.family];
    const r = nodeScreen(node);
    const s = r.s;
    if (r.x + r.w < -50 || r.y + r.h < -50 || r.x > W + 50 || r.y > H + 50) return;
    const selected = S.selected && S.selected.kind === 'node' && S.selected.id === node.id;
    const hot = nodeIsHot(node);
    if (def.family === 'logic') {
      drawGateNode(node, t, r, selected, hot, fam);
      return;
    }
    const x = r.x, y = r.y, w = r.w, h = r.h;
    const radius = Math.max(6, 12 * s);
    ctx.save();
    if (hot || selected) {
      ctx.shadowColor = selected ? 'rgba(216,255,243,.45)' : rgba(fam.color, 0.25);
      ctx.shadowBlur = selected ? 20 : 14;
    }
    roundRectPath(ctx, x, y, w, h, radius);
    const bg = ctx.createLinearGradient(x, y, x, y + h);
    bg.addColorStop(0, selected ? '#12394d' : '#0b2a3e');
    bg.addColorStop(1, selected ? '#0a2436' : '#071928');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.restore();

    roundRectPath(ctx, x, y, w, h, radius);
    ctx.strokeStyle = selected ? 'rgba(216,255,243,.9)' : rgba(fam.color, hot ? 0.55 : 0.34);
    ctx.lineWidth = selected ? 1.8 : 1.2;
    ctx.stroke();
    if (selected) {
      roundRectPath(ctx, x - 2.5, y - 2.5, w + 5, h + 5, radius + 2);
      ctx.strokeStyle = 'rgba(64,242,176,.22)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // family hairline across the top
    const accent = ctx.createLinearGradient(x + 8, y, x + w - 8, y);
    accent.addColorStop(0, 'rgba(0,0,0,0)');
    accent.addColorStop(0.5, rgba(fam.color, 0.7));
    accent.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = accent;
    ctx.fillRect(x + 8, y + 1, Math.max(0, w - 16), 1.5);

    const head = node.name ? node.name + ' · ' + def.en : def.en;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = font(Math.min(9.5, Math.max(6, 8.5 * s)), 700, true);
    ctx.fillStyle = rgba(fam.color, 0.82);
    ctx.fillText(head, x + 10 * s, y + 13 * s);

    if (s > 0.34) drawNodeContent(node, x, y, w, h, s, fam, hot);
    else if (node.type === 'NIB') node._bitAreas = null;
    drawPortLabels(node, x, y, w, h, s, fam);
    drawPorts(node, x, y, w, h, s, t);
  }

  function drawNodeContent(node, x, y, w, h, s, fam, hot) {
    const type = node.type;
    const cx = x + w * 0.48;
    const cy = y + h * 0.56;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (type === 'IN' || type === 'CONST') {
      ctx.textAlign = 'left';
      ctx.font = font(Math.min(27, 24 * s), 750);
      ctx.fillStyle = type === 'CONST' ? (node.value ? fam.color : '#7b97a1') : '#eafff9';
      ctx.fillText(type === 'CONST' ? (node.value ? '1' : '0') : node.name || 'A', x + 13 * s, y + h * 0.58);
      if (type === 'IN') {
        const sw = Math.min(40 * s, w * 0.38);
        const sh = Math.max(11, 18 * s);
        const sx = x + w - sw - 12 * s;
        const sy = y + h * 0.58 - sh / 2;
        roundRectPath(ctx, sx, sy, sw, sh, sh / 2);
        ctx.fillStyle = node.value ? 'rgba(64,242,176,.22)' : 'rgba(126,190,200,.08)';
        ctx.fill();
        ctx.strokeStyle = node.value ? 'rgba(64,242,176,.72)' : 'rgba(126,190,200,.28)';
        ctx.lineWidth = 1;
        ctx.stroke();
        const kr = sh / 2 - 3;
        ctx.beginPath();
        ctx.arc(node.value ? sx + sw - kr - 3 : sx + kr + 3, sy + sh / 2, kr, 0, Math.PI * 2);
        ctx.fillStyle = node.value ? fam.color : '#5d7f89';
        ctx.fill();
      }
      if (s > 0.62) {
        ctx.textAlign = 'left';
        ctx.font = font(8, 600);
        ctx.fillStyle = 'rgba(126,166,174,.8)';
        ctx.fillText(type === 'IN' ? (node.value ? 'HIGH' : 'LOW') : (node.frozen ? 'FIXED' : 'CONSTANT'), x + 13 * s, y + h + -7 * s);
      }
      return;
    }

    if (type === 'NIB') {
      ctx.textAlign = 'left';
      ctx.font = font(Math.min(26, 22 * s), 750, true);
      ctx.fillStyle = fam.color;
      ctx.fillText((node.value | 0).toString(16).toUpperCase(), x + 13 * s, y + h * 0.49);
      if (s > 0.58) {
        ctx.textAlign = 'right';
        ctx.font = font(8, 550);
        ctx.fillStyle = 'rgba(126,166,174,.85)';
        ctx.fillText('0x' + (node.value | 0).toString(16).toUpperCase() + ' = ' + (node.value | 0), x + w - 13 * s, y + h * 0.47);
      }
      const n = 4;
      const gap = 3 * s;
      const left = x + 10 * s;
      const areaW = w - 20 * s;
      const cw = (areaW - gap * 3) / 4;
      const ch = Math.max(13, 19 * s);
      const cy2 = y + h - ch - 8 * s;
      node._bitAreas = [];
      for (let i = 0; i < n; i++) {
        const bit = 3 - i;
        const on = ((node.value | 0) >> bit) & 1;
        const bx = left + i * (cw + gap);
        roundRectPath(ctx, bx, cy2, cw, ch, Math.min(4, ch / 3));
        ctx.fillStyle = on ? 'rgba(255,200,87,.17)' : 'rgba(5,20,32,.5)';
        ctx.fill();
        ctx.strokeStyle = on ? 'rgba(255,200,87,.6)' : 'rgba(126,190,200,.15)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.font = font(Math.min(8, Math.max(6, 6.5 * s)), 700, true);
        ctx.fillStyle = on ? '#ffe0a0' : '#54717d';
        ctx.fillText(String(1 << bit), bx + cw / 2, cy2 + ch / 2 + 0.5);
        node._bitAreas.push({ index: i, x: bx, y: cy2, w: cw, h: ch });
      }
      return;
    }

    if (type === 'CLK') {
      const cx0 = x + 12 * s;
      const cy0 = y + h * 0.54;
      const ww = Math.min(54 * s, w - 30 * s);
      const amp = 11 * s;
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const p = i / 40;
        const high = Math.floor(p * 3) % 2 === 0;
        const px = cx0 + p * ww;
        const py = cy0 + (high ? -amp : amp);
        if (i === 0) ctx.moveTo(px, py);
        else {
          const prevHigh = Math.floor(((i - 1) / 40) * 3) % 2 === 0;
          if (high !== prevHigh) ctx.lineTo(px, cy0 + (prevHigh ? -amp : amp));
          ctx.lineTo(px, py);
        }
      }
      ctx.strokeStyle = hot ? fam.color : 'rgba(126,190,200,.36)';
      ctx.lineWidth = 1.6;
      ctx.shadowColor = hot ? fam.color : 'transparent';
      ctx.shadowBlur = hot ? 7 : 0;
      ctx.stroke();
      ctx.shadowBlur = 0;
      if (s > 0.56) {
        ctx.textAlign = 'left';
        ctx.font = font(8, 600, true);
        ctx.fillStyle = 'rgba(126,166,174,.8)';
        ctx.fillText('1 Hz', x + 13 * s, y + h - 8 * s);
      }
      return;
    }

    if (type === 'AND' || type === 'OR' || type === 'NOT' || type === 'NAND' || type === 'NOR' || type === 'XOR' || type === 'XNOR') {
      const sym = { AND: '&', OR: '≥1', NOT: '¬', NAND: '⊼', NOR: '⊽', XOR: '⊕', XNOR: '⊙' }[type];
      ctx.font = '800 ' + Math.max(15, 23 * s) + 'px ' + FONT;
      ctx.fillStyle = fam.color;
      ctx.shadowColor = rgba(fam.color, 0.35);
      ctx.shadowBlur = 8;
      ctx.fillText(sym, cx - 2 * s, cy + 1 * s);
      ctx.shadowBlur = 0;
      if (s > 0.6) {
        ctx.font = font(Math.min(8.5, Math.max(6, 7.5 * s)), 550);
        ctx.fillStyle = 'rgba(174,207,211,.75)';
        ctx.fillText(DEFS[type].label, cx - 2 * s, y + h - 7 * s);
      }
      return;
    }

    if (type === 'SPLIT' || type === 'MERGE') {
      const busColor = 'rgba(255,200,87,.28)';
      ctx.strokeStyle = busColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (type === 'SPLIT') {
        const inY = CL.portY(node, 0, 1) - node.y;
        const py = y + inY * s;
        const bx = x + Math.min(23 * s, w * 0.2);
        ctx.moveTo(x, py);
        ctx.lineTo(bx, py);
        for (let i = 0; i < 4; i++) {
          const oy = y + (CL.portY(node, i, 4) - node.y) * s;
          ctx.moveTo(bx, py);
          ctx.lineTo(bx, oy);
          ctx.lineTo(x + w, oy);
        }
      } else {
        const outY = CL.portY(node, 0, 1) - node.y;
        const py = y + outY * s;
        const bx = x + w - Math.min(23 * s, w * 0.2);
        ctx.moveTo(x + w, py);
        ctx.lineTo(bx, py);
        for (let i = 0; i < 4; i++) {
          const iy = y + (CL.portY(node, i, 4) - node.y) * s;
          ctx.moveTo(x, iy);
          ctx.lineTo(bx, iy);
          ctx.lineTo(bx, py);
        }
      }
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = font(Math.min(10, 9 * s), 700, true);
      ctx.fillStyle = 'rgba(255,200,87,.72)';
      if (type === 'SPLIT') ctx.fillText('1 → 4', x + w / 2, y + 16 * s + 2);
      else ctx.fillText('4 → 1', x + w / 2, y + 16 * s + 2);
      return;
    }

    if (type === 'MUX2') {
      ctx.font = '800 ' + Math.max(12, 17 * s) + 'px ' + FONT;
      ctx.fillStyle = fam.color;
      ctx.fillText('MUX', x + w / 2, y + h * 0.49);
      ctx.font = font(Math.min(7.5, 6.5 * s), 600, true);
      ctx.fillStyle = 'rgba(255,200,87,.72)';
      ctx.fillText('S ? B : A', x + w / 2, y + h * 0.7);
      return;
    }

    if (type === 'ADD4') {
      ctx.font = '800 ' + Math.max(16, 25 * s) + 'px ' + FONT;
      ctx.fillStyle = fam.color;
      ctx.fillText('+', x + w * 0.37, y + h * 0.56);
      ctx.font = font(Math.min(8.5, 7.5 * s), 700, true);
      ctx.fillStyle = 'rgba(255,200,87,.8)';
      ctx.fillText('A+B+Ci', x + w * 0.58, y + h * 0.58);
      return;
    }

    if (type === 'DFF') {
      ctx.font = font(Math.min(12, 10 * s), 700, true);
      ctx.fillStyle = fam.color;
      ctx.fillText('D → Q', x + w / 2, y + h * 0.48);
      ctx.font = '800 ' + Math.max(15, 20 * s) + 'px ' + FONT;
      ctx.fillStyle = node._state && node._state.Q ? '#40f2b0' : 'rgba(193,139,255,.6)';
      ctx.fillText(node._state && node._state.Q ? '1' : '0', x + w / 2, y + h * 0.7);
      return;
    }

    if (type === 'REG4') {
      ctx.font = font(Math.min(11, 9 * s), 700, true);
      ctx.fillStyle = fam.color;
      ctx.fillText('REG 4', x + w / 2, y + h * 0.45);
      ctx.font = '800 ' + Math.max(14, 19 * s) + 'px ' + FONT;
      ctx.fillStyle = '#ffc857';
      ctx.fillText(node._state ? (node._state.Q | 0).toString(16).toUpperCase() : '0', x + w / 2, y + h * 0.69);
      return;
    }

    if (type === 'OUT') {
      const on = (E.readInput(node, 'X') & 1) === 1;
      const lx = x + w - 31 * s;
      const ly = y + h * 0.62;
      const rad = Math.max(8, 12 * s);
      if (on) {
        const glow = ctx.createRadialGradient(lx, ly, 1, lx, ly, rad * 2.3);
        glow.addColorStop(0, 'rgba(64,242,176,.95)');
        glow.addColorStop(0.35, 'rgba(64,242,176,.35)');
        glow.addColorStop(1, 'rgba(64,242,176,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(lx, ly, rad * 2.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(lx, ly, rad, 0, Math.PI * 2);
      ctx.fillStyle = on ? '#40f2b0' : 'rgba(6,23,35,.9)';
      ctx.fill();
      ctx.strokeStyle = on ? '#b8ffe6' : 'rgba(255,126,159,.45)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.font = font(Math.min(23, 20 * s), 750);
      ctx.fillStyle = on ? '#d9fff0' : '#d9e9e6';
      ctx.fillText(node.name || 'Y', x + 13 * s, y + h * 0.4);
      if (s > 0.6) {
        ctx.font = font(8, 600, true);
        ctx.fillStyle = on ? 'rgba(64,242,176,.9)' : 'rgba(126,166,174,.7)';
        ctx.fillText(on ? 'HIGH' : 'LOW', x + 13 * s, y + h - 8 * s);
      }
      return;
    }

    if (type === 'HEX') {
      const d = E.readInput(node, 'D') & 15;
      const bx = x + 10 * s;
      const by = y + 31 * s;
      const bw = w - 20 * s;
      const bh = h - 70 * s;
      roundRectPath(ctx, bx, by, bw, bh, 7 * s);
      ctx.fillStyle = 'rgba(2,12,20,.75)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,200,87,.24)';
      ctx.lineWidth = 1;
      ctx.stroke();
      drawSevenSeg(bx + bw * 0.2, by + bh * 0.12, bw * 0.6, bh * 0.76, d, s);
      return;
    }

    // leftover label
    ctx.font = font(Math.min(10, 9 * s), 600);
    ctx.fillStyle = 'rgba(174,207,211,.6)';
    ctx.fillText(defLabel(type), x + w / 2, y + h * 0.55);
  }

  function defLabel(type) { return DEFS[type] ? DEFS[type].label : type; }

  const SEGMENTS = {
    0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg',
    6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
    10: 'abcefg', 11: 'cdefg', 12: 'adef', 13: 'bcdeg', 14: 'adefg', 15: 'aefg'
  };
  function drawSevenSeg(x, y, w, h, value, s) {
    const on = SEGMENTS[value & 15] || '';
    const t = Math.max(2.2, Math.min(w, h) * 0.075);
    const coords = {
      a: [x + w * 0.12, y, x + w * 0.88, y],
      b: [x + w, y + h * 0.08, x + w, y + h * 0.46],
      c: [x + w, y + h * 0.54, x + w, y + h * 0.92],
      d: [x + w * 0.88, y + h, x + w * 0.12, y + h],
      e: [x, y + h * 0.92, x, y + h * 0.54],
      f: [x, y + h * 0.46, x, y + h * 0.08],
      g: [x + w * 0.12, y + h * 0.5, x + w * 0.88, y + h * 0.5]
    };
    ctx.lineCap = 'round';
    for (const k of 'abcdefg') {
      const p = coords[k];
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(p[2], p[3]);
      const active = on.includes(k);
      ctx.strokeStyle = active ? '#ffd36a' : 'rgba(255,200,87,.09)';
      ctx.lineWidth = t;
      ctx.shadowColor = active ? 'rgba(255,200,87,.65)' : 'transparent';
      ctx.shadowBlur = active ? 7 : 0;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
    ctx.font = font(Math.min(9, 7.5 * s), 600, true);
    ctx.fillStyle = 'rgba(255,200,87,.7)';
    ctx.fillText('HEX', x - w * 0.08, y + h + 10 * s);
  }

  function drawPortLabels(node, x, y, w, h, s, fam) {
    const def = DEFS[node.type];
    ctx.textBaseline = 'middle';
    ctx.font = font(Math.min(9.5, Math.max(6, 8 * s)), 650, true);
    def.inputs.forEach((p, i) => {
      const py = y + (CL.portY(node, i, def.inputs.length) - node.y) * s;
      ctx.textAlign = 'left';
      ctx.fillStyle = p.width === 4 ? 'rgba(255,200,87,.78)' : 'rgba(154,194,201,.82)';
      ctx.fillText(p.label, x + 10 * s, py + 0.5);
    });
    def.outputs.forEach((p, i) => {
      const py = y + (CL.portY(node, i, def.outputs.length) - node.y) * s;
      const v = node._out ? (node._out[p.id] | 0) : 0;
      ctx.textAlign = 'right';
      if (node.type === 'IN' || node.type === 'NIB' || node.type === 'CONST' || node.type === 'CLK') {
        ctx.font = font(Math.min(8.5, Math.max(6, 7.5 * s)), 700, true);
        ctx.fillStyle = v ? fam.color : 'rgba(126,166,174,.7)';
        ctx.fillText(valText(v, p.width), x + w - 10 * s, py - 11 * s);
      } else {
        if (s > 0.52) {
          const label = p.label;
          ctx.fillStyle = v ? (p.width === 4 ? '#ffd77d' : '#bfffe9') : 'rgba(126,166,174,.7)';
          ctx.fillText(label, x + w - 10 * s, py);
          const labelW = ctx.measureText(label).width;
          ctx.fillStyle = v ? (p.width === 4 ? '#ffc857' : '#40f2b0') : 'rgba(126,166,174,.42)';
          ctx.font = font(Math.min(8.5, Math.max(6, 7.5 * s)), 700, true);
          ctx.fillText(valText(v, p.width), x + w - 14 * s - labelW, py);
        }
      }
    });
  }

  function pinScreen(node, dir, index) {
    const def = DEFS[node.type];
    const p = dir === 'in' ? CL.inputPortPos(node, index) : CL.outputPortPos(node, index);
    return screenOf(p.x, p.y);
  }

  function drawPorts(node, x, y, w, h, s, t) {
    const def = DEFS[node.type];
    const pending = S.pending;
    const drawOne = (dir, p, i) => {
      const pos = pinScreen(node, dir, i);
      const width = p.width;
      const r = Math.max(3.4, (width === 4 ? 5.4 : 4.5) * Math.max(0.65, s));
      let value = 0;
      let connected = true;
      if (dir === 'in') {
        connected = !!E.inputWire(node.id, p.id);
        value = E.readInput(node, p.id) | 0;
      } else {
        value = node._out ? (node._out[p.id] | 0) : 0;
      }
      const bus = width === 4;
      const high = value > 0;
      const color = bus ? '#ffc857' : '#40f2b0';
      const isHover = hoverPin && hoverPin.node.id === node.id && hoverPin.dir === dir && hoverPin.index === i;
      const compatible = pending && pending.dir !== dir && pending.width === width;
      if (compatible) {
        const pulse = 4 + Math.sin(t / 140) * 2.5;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r + pulse, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(64,242,176,.35)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      if (dir === 'in' && !connected) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r + 2.5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,200,87,.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fillStyle = high ? color : (bus ? 'rgba(47,36,14,.95)' : 'rgba(5,23,35,.96)');
      ctx.fill();
      ctx.strokeStyle = isHover ? '#ffffff' : (connected || dir === 'out' ? rgba(color, 0.8) : 'rgba(255,200,87,.6)');
      ctx.lineWidth = isHover ? 2 : 1.3;
      ctx.stroke();
      if (high) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r * 0.38, 0, Math.PI * 2);
        ctx.fillStyle = '#eafff8';
        ctx.fill();
      }
      if (isHover) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r + 5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,.55)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    };
    def.inputs.forEach((p, i) => drawOne('in', p, i));
    def.outputs.forEach((p, i) => drawOne('out', p, i));
  }

  function drawPending(t) {
    const p = S.pending;
    if (!p) return;
    const node = E.nodeById(p.nodeId);
    if (!node) { S.pending = null; return; }
    const def = DEFS[node.type];
    const arr = p.dir === 'out' ? def.outputs : def.inputs;
    const idx = arr.findIndex((x) => x.id === p.port);
    if (idx < 0) { S.pending = null; return; }
    const src = pinScreen(node, p.dir, idx);
    const targetPin = hoverPin && hoverPin.dir !== p.dir && hoverPin.width === p.width ? hoverPin : null;
    let end = targetPin ? pinScreen(targetPin.node, targetPin.dir, targetPin.index) : screenOf(p.pointer.x, p.pointer.y);
    let a = src, b = end;
    if (p.dir === 'in') { a = end; b = src; }
    const bend = Math.max(30, Math.min(110, Math.abs(b.x - a.x) * 0.45));
    const c1 = { x: a.x + bend, y: a.y };
    const c2 = { x: b.x - bend, y: b.y };
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -t / 45;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.x, b.y);
    ctx.strokeStyle = 'rgba(64,242,176,.9)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(64,242,176,.6)';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(src.x, src.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#40f2b0';
    ctx.fill();
    if (targetPin) {
      ctx.beginPath();
      ctx.arc(end.x, end.y, 7, 0, Math.PI * 2);
      ctx.strokeStyle = '#d8fff3';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function drawScene(t) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawBackground(t);
    const selectedWire = S.selected && S.selected.kind === 'wire' ? S.selected.id : null;
    const wires = S.wires;
    for (const w of wires) if (w.id !== selectedWire) drawWire(w, t, false);
    for (const w of wires) if (w.id === selectedWire) drawWire(w, t, true);
    for (const n of S.nodes) drawNode(n, t);
    drawPending(t);
  }

  function render(t) {
    lastDraw = t;
    drawScene(t);
  }

  /* --------------------------------------------------------------- hit test */
  function dist2(ax, ay, bx, by) {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  }
  function pointSegmentDist(px, py, a, b) {
    const vx = b.x - a.x, vy = b.y - a.y;
    const wx = px - a.x, wy = py - a.y;
    const len2 = vx * vx + vy * vy;
    let t = len2 ? (wx * vx + wy * vy) / len2 : 0;
    t = clamp(t, 0, 1);
    const x = a.x + t * vx, y = a.y + t * vy;
    return Math.sqrt(dist2(px, py, x, y));
  }

  function findPinAt(px, py) {
    // Pick the nearest pin, not merely the first one. At low zoom two pins can
    // be only a few screen pixels apart; nearest-wins keeps the touch predictable.
    let best = null;
    let bestDist = Infinity;
    for (let ni = S.nodes.length - 1; ni >= 0; ni--) {
      const node = S.nodes[ni];
      const def = DEFS[node.type];
      for (let i = 0; i < def.inputs.length; i++) {
        const pos = pinScreen(node, 'in', i);
        const d = dist2(px, py, pos.x, pos.y);
        const limit = def.inputs[i].width === 4 ? 17 : 14;
        if (d <= limit * limit && d < bestDist) {
          bestDist = d;
          best = { node, dir: 'in', port: def.inputs[i].id, index: i, width: def.inputs[i].width, pos };
        }
      }
      for (let i = 0; i < def.outputs.length; i++) {
        const pos = pinScreen(node, 'out', i);
        const d = dist2(px, py, pos.x, pos.y);
        const limit = def.outputs[i].width === 4 ? 17 : 14;
        if (d <= limit * limit && d < bestDist) {
          bestDist = d;
          best = { node, dir: 'out', port: def.outputs[i].id, index: i, width: def.outputs[i].width, pos };
        }
      }
    }
    return best;
  }

  function findNodeAt(px, py) {
    for (let i = S.nodes.length - 1; i >= 0; i--) {
      const n = S.nodes[i];
      const r = nodeScreen(n);
      if (px >= r.x - 2 && px <= r.x + r.w + 2 && py >= r.y - 2 && py <= r.y + r.h + 2) return n;
    }
    return null;
  }

  function findBitAt(node, px, py) {
    if (!node._bitAreas) return null;
    for (const a of node._bitAreas) {
      if (px >= a.x && px <= a.x + a.w && py >= a.y && py <= a.y + a.h) return a.index;
    }
    return null;
  }

  function findWireAt(px, py) {
    for (let i = S.wires.length - 1; i >= 0; i--) {
      const w = S.wires[i];
      if (!w._geo) continue;
      const pts = w._geo.pts;
      for (let j = 0; j < pts.length - 1; j++) {
        if (pointSegmentDist(px, py, pts[j], pts[j + 1]) < 9) return w;
      }
    }
    return null;
  }

  function findDeleteAt(px, py) {
    if (!S.selected || S.selected.kind !== 'wire') return null;
    for (const w of S.wires) {
      if (w.id === S.selected.id && w._del) {
        if (dist2(px, py, w._del.x, w._del.y) <= w._del.r * w._del.r) return w;
      }
    }
    return null;
  }

  /* -------------------------------------------------------------- connecting */
  function canConnect(pin) {
    const p = S.pending;
    return !!(p && p.dir !== pin.dir && p.width === pin.width && p.nodeId !== pin.node.id || (p && p.dir !== pin.dir && p.width === pin.width));
  }
  function tryConnect(pin) {
    const p = S.pending;
    if (!p) return false;
    let from, to;
    if (p.dir === 'out') {
      from = p; to = pin;
    } else {
      from = pin; to = p;
    }
    if (from.dir !== 'out' || to.dir !== 'in') {
      showToast('输出端口要接到输入端口', 'warn');
      sfxError();
      return false;
    }
    if (from.width !== to.width) {
      showToast('位宽不匹配：4 位总线不能直接接 1 位线', 'warn');
      sfxError();
      return false;
    }
    const res = E.connect(from.nodeId, from.port, to.node.id, to.port);
    if (res.ok) {
      S.pending = null;
      hoverPin = null;
      if (res.replaced) showToast('已替换该输入原来的连线');
      else showToast('已连接 · ' + nodeName(from.node) + ' → ' + nodeName(to.node));
      if (res.wire) E.setSelected({ kind: 'wire', id: res.wire.id });
      sfxConnect();
      requestRender();
      return true;
    }
    showToast(res.reason || '无法连接', 'warn');
    sfxError();
    return false;
  }
  function beginPin(pin) {
    const p = S.pending;
    if (p) {
      if (p.dir === pin.dir) {
        if (p.nodeId === pin.node.id && p.port === pin.port) {
          S.pending = null;
          showToast('已取消连线');
          requestRender();
          return true;
        }
        S.pending = {
          nodeId: pin.node.id, dir: pin.dir, port: pin.port, width: pin.width,
          pointer: worldOf(pin.pos.x, pin.pos.y), dragging: false, startedAt: performance.now()
        };
        hoverPin = pin;
        requestRender();
        return true;
      }
      return tryConnect(pin);
    }
    S.pending = {
      nodeId: pin.node.id, dir: pin.dir, port: pin.port, width: pin.width,
      pointer: worldOf(pin.pos.x, pin.pos.y), dragging: false, startedAt: performance.now()
    };
    hoverPin = pin;
    requestRender();
    return true;
  }

  /* ------------------------------------------------------------- interactions */
  function currentPointersArray() {
    return Array.from(pointers.values());
  }
  function startPinch() {
    const arr = currentPointersArray();
    if (arr.length < 2) return;
    if (mode === 'node' && drag && drag.moved) {
      E.autosave();
      E.emit();
    }
    drag = null;
    S.pending = null;
    mode = 'pinch';
    const a = arr[0], b = arr[1];
    const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    pinch = {
      startDist: dist,
      startScale: S.camera.scale,
      world: worldOf(mid.x, mid.y)
    };
    hoverPin = null;
    hoverNode = null;
    dom.app.classList.remove('dragging');
  }

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    ensureAudio();
    const p = eventPoint(e);
    pointers.set(e.pointerId, p);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (pointers.size >= 2) { startPinch(); return; }
    if (mode !== 'idle') return;

    const delWire = findDeleteAt(p.x, p.y);
    if (delWire) {
      E.removeWire(delWire.id);
      sfxDelete();
      requestRender();
      return;
    }

    const pin = findPinAt(p.x, p.y);
    if (S.pending) {
      if (pin) {
        if (S.pending.dir === pin.dir) {
          beginPin(pin);
        } else {
          tryConnect(pin);
        }
        return;
      }
      S.pending = null;
      requestRender();
    }

    if (S.tool === 'erase') {
      const w = findWireAt(p.x, p.y);
      if (w) {
        E.removeWire(w.id);
        sfxDelete();
        requestRender();
        return;
      }
      const n = findNodeAt(p.x, p.y);
      if (n) {
        if (n.locked) { showToast('关卡固定的输入/输出不能删除', 'warn'); sfxError(); }
        else { E.removeNode(n.id); sfxDelete(); }
        requestRender();
        return;
      }
      mode = 'pan';
      drag = { kind: 'pan', startX: p.x, startY: p.y, camX: S.camera.x, camY: S.camera.y };
      return;
    }

    if (pin) {
      beginPin(pin);
      mode = 'pin';
      drag = {
        kind: 'pin',
        startX: p.x, startY: p.y,
        moved: false
      };
      return;
    }

    const node = findNodeAt(p.x, p.y);
    if (node) {
      E.setSelected({ kind: 'node', id: node.id });
      const bitIndex = node.type === 'NIB' ? findBitAt(node, p.x, p.y) : null;
      const world = worldOf(p.x, p.y);
      drag = {
        kind: 'node', node, startX: p.x, startY: p.y,
        startNodeX: node.x, startNodeY: node.y,
        moved: false, bitIndex
      };
      mode = 'node';
      return;
    }

    const wire = findWireAt(p.x, p.y);
    if (wire) {
      E.setSelected({ kind: 'wire', id: wire.id });
      mode = 'idle';
      sfxTap();
      return;
    }

    E.setSelected(null);
    mode = 'pan';
    drag = { kind: 'pan', startX: p.x, startY: p.y, camX: S.camera.x, camY: S.camera.y };
  }

  function onPointerMove(e) {
    const p = eventPoint(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);

    if (mode === 'pinch') {
      const arr = currentPointersArray();
      if (arr.length < 2) return;
      const a = arr[0], b = arr[1];
      const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const scale = clamp(pinch.startScale * (dist / pinch.startDist), 0.28, 2.8);
      S.camera.scale = scale;
      S.camera.x = pinch.world.x - (mid.x - W / 2) / scale;
      S.camera.y = pinch.world.y - (mid.y - H / 2) / scale;
      hasUserCamera = true;
      return;
    }

    if (mode === 'pan' && drag) {
      const s = S.camera.scale;
      S.camera.x = drag.camX - (p.x - drag.startX) / s;
      S.camera.y = drag.camY - (p.y - drag.startY) / s;
      hasUserCamera = true;
      return;
    }

    if (mode === 'node' && drag) {
      const dx = p.x - drag.startX;
      const dy = p.y - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) > 4) {
        drag.moved = true;
        E.remember();
        dom.app.classList.add('dragging');
      }
      if (drag.moved) {
        const s = S.camera.scale;
        let nx = drag.startNodeX + dx / s;
        let ny = drag.startNodeY + dy / s;
        nx = Math.round(nx / 5) * 5;
        ny = Math.round(ny / 5) * 5;
        E.moveNode(drag.node.id, nx, ny, { noHistory: true, silent: true });
      }
      return;
    }

    if (mode === 'pin' && S.pending) {
      const dx = p.x - drag.startX;
      const dy = p.y - drag.startY;
      if (Math.hypot(dx, dy) > 5) S.pending.dragging = true;
      const hover = findPinAt(p.x, p.y);
      hoverPin = hover && hover.dir !== S.pending.dir && hover.width === S.pending.width ? hover : null;
      const target = hoverPin ? hoverPin.pos : p;
      const wpt = worldOf(target.x, target.y);
      S.pending.pointer = wpt;
      return;
    }

    // hover state while idle
    const hover = findPinAt(p.x, p.y);
    const changed = (!!hover !== !!hoverPin) ||
      (hover && hoverPin && (hover.node.id !== hoverPin.node.id || hover.dir !== hoverPin.dir || hover.port !== hoverPin.port));
    hoverPin = hover;
    const n = hover ? null : findNodeAt(p.x, p.y);
    if (n !== hoverNode) hoverNode = n;
    if (changed) requestRender();
  }

  function onPointerUp(e) {
    const p = eventPoint(e);
    pointers.delete(e.pointerId);
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }

    if (mode === 'pinch') {
      if (pointers.size < 2) { mode = 'idle'; pinch = null; }
      return;
    }

    if (mode === 'node' && drag) {
      if (drag.moved) {
        E.autosave();
        E.emit();
      } else {
        const n = drag.node;
        if (drag.bitIndex != null) {
          E.toggleNodeBit(n.id, drag.bitIndex);
          sfxTap();
        } else if (n.type === 'IN' || n.type === 'CONST' || n.type === 'NIB') {
          E.toggleNode(n.id);
          sfxTap();
        }
      }
      drag = null;
      mode = 'idle';
      dom.app.classList.remove('dragging');
      return;
    }

    if (mode === 'pin' && S.pending) {
      const pin = findPinAt(p.x, p.y);
      const samePin = pin && pin.node.id === S.pending.nodeId && pin.port === S.pending.port && pin.dir === S.pending.dir;
      if (samePin) {
        if (S.pending.dragging) {
          S.pending = null;
          requestRender();
          showToast('连线取消');
        } else {
          showToast(S.pending.dir === 'out' ? '再点一个输入端口完成连线' : '再点一个输出端口完成连线');
        }
      } else if (pin && pin.dir !== S.pending.dir) {
        tryConnect(pin);
      } else if (pin && pin.dir === S.pending.dir) {
        showToast('两个同方向的端口不能相连', 'warn');
      } else if (!S.pending.dragging) {
        showToast(S.pending.dir === 'out' ? '再点一个输入端口完成连线' : '再点一个输出端口完成连线');
      } else {
        S.pending = null;
        requestRender();
        showToast('连线取消');
      }
      drag = null;
      mode = 'idle';
      return;
    }

    if (mode === 'pan') {
      drag = null;
      mode = 'idle';
      return;
    }
    mode = 'idle';
    drag = null;
  }

  function onPointerCancel(e) {
    pointers.delete(e.pointerId);
    if (mode === 'pinch') {
      if (pointers.size < 2) { mode = 'idle'; pinch = null; }
      return;
    }
    if (mode === 'pin') S.pending = null;
    if (mode === 'node' && drag && drag.moved) { E.autosave(); E.emit(); }
    drag = null;
    mode = 'idle';
    dom.app.classList.remove('dragging');
  }

  function onWheel(e) {
    e.preventDefault();
    const p = eventPoint(e);
    zoomAt(Math.exp(-e.deltaY * 0.0011), p.x, p.y);
    requestRender();
  }

  function onPointerLeave() {
    if (pointers.size) return;
    hoverPin = null;
    hoverNode = null;
  }

  /* ------------------------------------------------------------------ tools */
  function setTool(tool) {
    if (S.pending) { S.pending = null; }
    E.setTool(tool);
    document.querySelectorAll('.tool-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.tool === tool);
    });
    document.body.classList.toggle('tool-wire', tool === 'wire');
    document.body.classList.toggle('tool-erase', tool === 'erase');
    requestRender();
  }

  /* ----------------------------------------------------------------- panels */
  function openSheet(eyebrow, title, bodyHTML, footHTML) {
    closeModal();
    dom.sheetEyebrow.textContent = eyebrow || 'RESULTS';
    dom.sheetTitle.textContent = title || '';
    dom.sheetBody.innerHTML = bodyHTML || '';
    dom.sheetFoot.innerHTML = footHTML || '';
    dom.sheetWrap.classList.remove('hidden');
    dom.sheetWrap.setAttribute('aria-hidden', 'false');
    dom.sheetBody.scrollTop = 0;
    sheetOpen = true;
    if (isMobilePalette()) closePalette();
  }
  function closeSheet() {
    dom.sheetWrap.classList.add('hidden');
    dom.sheetWrap.setAttribute('aria-hidden', 'true');
    sheetOpen = false;
  }

  function openModal(html) {
    closeSheet();
    lessonShowing = false;
    lessonLevelId = null;
    lessonFromPicker = false;
    dom.modal.innerHTML = html;
    dom.modal.scrollTop = 0;
    dom.modalWrap.classList.remove('hidden');
    dom.modalWrap.setAttribute('aria-hidden', 'false');
    modalOpen = true;
    if (isMobilePalette()) closePalette();
  }
  function closeModal() {
    dom.modalWrap.classList.add('hidden');
    dom.modalWrap.setAttribute('aria-hidden', 'true');
    dom.modal.innerHTML = '';
    modalOpen = false;
    if (welcomeShowing) {
      welcomeShowing = false;
      E.setSetting('onboarded', true);
    }
    if (lessonShowing && lessonLevelId) {
      lessonsSeen[lessonLevelId] = true;
      E.setSetting('lessonsSeen', lessonsSeen);
    }
    lessonShowing = false;
    lessonLevelId = null;
    lessonFromPicker = false;
  }

  function openTruthSheet() {
    const lv = S.mode === 'level' ? CL.levelById(S.levelId) : null;
    if (!S.nodes.length) {
      openSheet('RESULTS · TRUTH TABLE', '真值表', emptyPanelHTML('画布是空的', '先放一个开关和一盏灯，再来观察它的真值表。'), '<button class="btn" data-close-sheet>关闭</button>');
      bindSheetBasics();
      return;
    }
    const data = E.enumerateTruthTable();
    lastTruth = data;
    const inputBits = data.inputs || [];
    const outputs = data.outputs || [];
    if (!outputs.length) {
      openSheet('RESULTS · TRUTH TABLE', '真值表', emptyPanelHTML('还没有输出元件', '放一盏指示灯或一个数码管，才能读取电路的结果。'), '<button class="btn" data-close-sheet>关闭</button>');
      bindSheetBasics();
      return;
    }
    if (data.tooMany) {
      openSheet('RESULTS · TRUTH TABLE', '真值表',
        '<div class="diagnostic warn"><span class="dot"></span><div><b>输入太多，无法完整枚举</b><br>最多支持 6 个 1 位输入（64 行）。请减少输入，或使用“验证”针对测试向量检查。</div></div>',
        '<button class="btn" data-close-sheet>关闭</button>');
      bindSheetBasics();
      return;
    }
    let expectedMap = null;
    if (lv) {
      const tests = lv.tests;
      const canMap = Array.isArray(tests.vectors) &&
        tests.inputs.every((name) => inputBits.some((i) => i.name === name)) &&
        tests.outputs.every((name) => outputs.some((o) => o.name === name));
      if (canMap) {
        expectedMap = {};
        for (const v of tests.vectors) {
          expectedMap[inputBits.map((i) => v[i.name] | 0).join('|')] = v;
        }
      }
    }
    const showStatus = !!expectedMap;
    let html = '';
    if (data.unstable) html += '<div class="diagnostic error"><span class="dot"></span><div><b>电路存在振荡</b><br>组合反馈没有稳定，表中的值可能不可靠。</div></div>';
    if (data.buses.length) {
      html += '<div class="diagnostic warn"><span class="dot"></span><div>4 位输入 ' + data.buses.map((b) => esc(b.name) + '=' + esc(valText(b.value, 4))).join('、') + ' 保持当前值，未展开枚举。粗金色线表示 4 位总线。</div></div>';
    }
    html += '<div class="truth-scroll"><table class="truth-table"><thead><tr><th>#</th>';
    inputBits.forEach((i) => { html += '<th class="in">' + esc(i.name) + '</th>'; });
    outputs.forEach((o) => { html += '<th class="out">' + esc(o.name) + (o.width === 4 ? '·4' : '') + '</th>'; });
    if (showStatus) html += '<th>结果</th>';
    html += '<th></th></tr></thead><tbody>';
    data.rows.forEach((row) => {
      const cur = row.index === data.currentIndex;
      let statusOK = true;
      let hasExpected = false;
      let expected = null;
      if (expectedMap) {
        const key = inputBits.map((i) => row.inputs[i.name] | 0).join('|');
        expected = expectedMap[key] || null;
        if (expected) {
          hasExpected = true;
          for (const o of outputs) {
            if ((row.outputs[o.name] | 0) !== (expected[o.name] | 0)) { statusOK = false; break; }
          }
        }
      }
      const rowClass = 'truth-row' + (cur ? ' current' : '') + (hasExpected && !statusOK ? ' fail' : '');
      html += '<tr class="' + rowClass + '" data-row="' + row.index + '"><td class="row-num">' + (row.index + 1) + '</td>';
      inputBits.forEach((i) => { html += '<td>' + esc(valText(row.inputs[i.name], 1)) + '</td>'; });
      outputs.forEach((o) => {
        const v = row.outputs[o.name] | 0;
        let cls = '';
        if (hasExpected) cls = ((expected[o.name] | 0) === v) ? ' ok' : ' bad';
        html += '<td class="' + cls + '">' + esc(valText(v, o.width)) + '</td>';
      });
      if (showStatus) {
        if (!hasExpected) html += '<td class="mut">—</td>';
        else html += '<td class="' + (statusOK ? 'ok' : 'bad') + '">' + (statusOK ? '✓' : '✗') + '</td>';
      }
      html += '<td><span class="apply">应用</span></td></tr>';
    });
    html += '</tbody></table></div>';
    html += '<p class="table-note">' + (inputBits.length ? '点击任意一行，把这些输入值应用到电路。' : '没有 1 位输入，当前输入组合固定。') + ' 4 位数值以十六进制显示。</p>';
    if (showStatus) html += '<div class="table-legend"><span><i class="legend-dot" style="background:#40f2b0"></i>与关卡目标一致</span><span><i class="legend-dot" style="background:#ff6e76"></i>与关卡目标不一致</span></div>';
    if (S.nodes.some((n) => n.type === 'DFF' || n.type === 'REG4')) {
      html += '<div class="diagnostic"><span class="dot"></span><div>电路包含时序元件，真值表只反映当前状态；请用底部的单步按钮观察时钟边沿。</div></div>';
    }
    const foot = '<button class="btn small" id="copyTruth">复制表格</button>' +
      (lv ? '<button class="btn small primary" id="truthVerify">运行验证</button>' : '') +
      '<button class="btn small" data-close-sheet>关闭</button>';
    openSheet('RESULTS · TRUTH TABLE', (lv ? lv.title + ' · ' : '') + '真值表', html, foot);
    bindSheetBasics();
    const copyBtn = $('copyTruth');
    if (copyBtn) copyBtn.addEventListener('click', () => copyTruth(data, lv));
    const ver = $('truthVerify');
    if (ver) ver.addEventListener('click', () => { closeSheet(); runLevelCheck(); });
    dom.sheetBody.querySelectorAll('tr[data-row]').forEach((tr) => {
      tr.addEventListener('click', () => {
        const idx = Number(tr.dataset.row);
        applyTruthRow(data, idx);
      });
    });
  }

  function emptyPanelHTML(title, copy) {
    return '<div class="hero" style="padding:20px 0 8px">' +
      '<div class="pass-ring" style="border-color:rgba(126,221,224,.22);background:rgba(126,221,224,.05);color:#7f9eac"><svg><use href="#i-table"/></svg></div>' +
      '<h2 style="font-size:17px">' + esc(title) + '</h2><p style="max-width:360px;margin:7px auto 0">' + esc(copy) + '</p></div>';
  }

  function applyTruthRow(data, index) {
    const row = data.rows.find((r) => r.index === index);
    if (!row) return;
    const summary = [];
    for (const i of data.inputs) {
      E.setInput(i.name, row.inputs[i.name]);
      summary.push(i.name + '=' + valText(row.inputs[i.name], 1));
    }
    closeSheet();
    showToast('已应用输入 ' + (summary.join(' ') || '（固定）'));
    sfxTap();
  }

  function copyTruth(data, lv) {
    const lines = [];
    lines.push(['#'].concat(data.inputs.map((i) => i.name), data.outputs.map((o) => o.name)).join('\t'));
    data.rows.forEach((row) => {
      lines.push([row.index + 1]
        .concat(data.inputs.map((i) => valText(row.inputs[i.name], 1)))
        .concat(data.outputs.map((o) => valText(row.outputs[o.name], o.width)))
        .join('\t'));
    });
    copyText(lines.join('\n'));
  }

  function openSelfCheck() {
    const report = E.structuralReport();
    const stats = E.getStats();
    const inputs = S.nodes.filter((n) => (n.type === 'IN' || n.type === 'NIB') && n.name);
    const outputs = S.nodes.filter((n) => (n.type === 'OUT' || n.type === 'HEX') && n.name);
    let html = '<div class="stat-row">' +
      '<div class="stat"><div class="k">元件</div><div class="v">' + stats.nodes + '</div></div>' +
      '<div class="stat"><div class="k">连线</div><div class="v">' + stats.wires + '</div></div>' +
      '<div class="stat"><div class="k">输入 / 输出</div><div class="v">' + inputs.length + ' <small>/</small> ' + outputs.length + '</div></div></div>';
    if (!S.nodes.length) {
      html += '<div class="diagnostic warn" style="margin-top:12px"><span class="dot"></span><div><b>画布还没有元件</b><br>从元件库放一个开关和一盏灯，再用线连起来。</div></div>';
    } else {
      if (report.unstable) html += '<div class="diagnostic error"><span class="dot"></span><div><b>电路正在振荡</b><br>发现没有稳定的组合反馈环路，结果会持续跳变。</div></div>';
      if (report.floating.length) {
        const list = report.floating.slice(0, 8).map((f) => displayName(f.node) + '.' + f.port).join('、');
        html += '<div class="diagnostic warn"><span class="dot"></span><div><b>' + report.floating.length + ' 个输入端口悬空</b><br>' + esc(list) + (report.floating.length > 8 ? ' 等' : '') + '。悬空输入按 0 处理，但通常不是你想要的结果。</div></div>';
      }
      if (report.orphans.length) {
        const list = report.orphans.slice(0, 8).map((o) => displayName(o.node)).join('、');
        html += '<div class="diagnostic"><span class="dot"></span><div><b>' + report.orphans.length + ' 个元件输出未使用</b><br>' + esc(list) + (report.orphans.length > 8 ? ' 等' : '') + '。如果只是调试中间值，可以忽略。</div></div>';
      }
      if (!report.floating.length && !report.orphans.length && !report.unstable) {
        html += '<div class="diagnostic"><span class="dot"></span><div><b>结构检查通过</b><br>没有悬空输入，所有元件输出都已接入电路，仿真结果稳定。</div></div>';
      }
      if (!inputs.length) html += '<div class="diagnostic warn"><span class="dot"></span><div>还没有命名的输入元件。真值表需要开关或 4 位输入。</div></div>';
      if (!outputs.length) html += '<div class="diagnostic warn"><span class="dot"></span><div>还没有指示灯或数码管。放一个输出元件才能读数。</div></div>';
      html += '<div class="section-title"><span>CURRENT VALUES</span><div class="line"></div></div>';
      html += '<div class="truth-scroll" style="max-height:30dvh"><table class="truth-table"><thead><tr><th>类型</th><th>名称</th><th>值</th></tr></thead><tbody>';
      inputs.forEach((n) => {
        const w = n.type === 'NIB' ? 4 : 1;
        html += '<tr><td class="mut">输入</td><td>' + esc(n.name) + '</td><td class="ok">' + esc(valText(n.value, w)) + '</td></tr>';
      });
      outputs.forEach((n) => {
        const w = n.type === 'HEX' ? 4 : 1;
        html += '<tr><td class="mut">输出</td><td>' + esc(n.name) + '</td><td class="ok">' + esc(valText(E.readNamedOutput(n), w)) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }
    const foot = '<button class="btn small" id="selfTruth"><svg><use href="#i-table"/></svg>打开真值表</button>' +
      '<button class="btn small" data-close-sheet>关闭</button>';
    openSheet('TOOLS · SELF CHECK', '电路自检', html, foot);
    bindSheetBasics();
    const b = $('selfTruth');
    if (b) b.addEventListener('click', () => { closeSheet(); openTruthSheet(); });
  }

  function formatVector(vec, names) {
    return names.map((n) => n + '=' + valText(vec[n] | 0, widthOfName(n))).join(' ');
  }

  function openFailModal(result, lv) {
    let html = '<div class="pass-hero fail-hero"><div class="pass-ring"><svg><use href="#i-close"/></svg></div>' +
      '<h2>还差一点</h2><p>通过 ' + result.passed + ' / ' + result.total + ' 组测试。</p></div>';
    if (result.missingInputs.length || result.missingOutputs.length) {
      html += '<div class="diagnostic error"><span class="dot"></span><div><b>缺少命名端口</b><br>' +
        (result.missingInputs.length ? '输入：' + esc(result.missingInputs.join('、')) + '。' : '') +
        (result.missingOutputs.length ? '输出：' + esc(result.missingOutputs.join('、')) + '。' : '') +
        '关卡固定的端口不能被删除。</div></div>';
    }
    if (result.missingRequired && result.missingRequired.length) {
      html += '<div class="diagnostic error"><span class="dot"></span><div><b>缺少本关要求的元件</b><br>' +
        result.missingRequired.map((m) => esc(DEFS[m.type] ? DEFS[m.type].label : m.type) + ' ×' + m.need).join('、') +
        '。请从元件库添加并接入电路。</div></div>';
    }
    if (result.missingUsed && result.missingUsed.length) {
      html += '<div class="diagnostic error"><span class="dot"></span><div><b>有元件没有真正参与电路</b><br>' +
        result.missingUsed.map((m) => esc(DEFS[m.type] ? DEFS[m.type].label : m.type) + ' 的输出没有接到任何输入').join('、') +
        '。</div></div>';
    }
    if (result.unstable) {
      html += '<div class="diagnostic error"><span class="dot"></span><div><b>电路振荡</b><br>仿真没有稳定，先检查反馈环路。</div></div>';
    }
    if (result.failures.length) {
      html += '<div class="section-title"><span>MISMATCHES</span><div class="line"></div></div><div class="fail-list">';
      result.failures.slice(0, 4).forEach((f) => {
        const mism = f.mismatch.map((m) => m.name + ' 期望 ' + valText(m.expected, m.width) + ' / 实际 ' + valText(m.actual, m.width)).join(' · ');
        const clockText = f.vector.clock !== undefined ? ' CLK=' + (f.vector.clock ? '1' : '0') : '';
        html += '<div class="fail-row"><span class="fail-tag">#' + (f.index + 1) + '</span><span>' + esc(formatVector(f.vector, lv.tests.inputs) + clockText) + '</span><span class="arrow">→</span><b>' + esc(mism) + '</b></div>';
      });
      html += '</div>';
      if (result.failures.length > 4) html += '<p class="table-note">还有 ' + (result.failures.length - 4) + ' 组不一致，先在真值表里检查。</p>';
    }
    html += '<div class="modal-actions"><button class="btn primary" id="failClose">继续修改</button><button class="btn" id="failTruth">查看真值表</button></div>';
    openModal(html);
    const c = $('failClose'); if (c) c.addEventListener('click', closeModal);
    const t = $('failTruth'); if (t) t.addEventListener('click', () => { closeModal(); openTruthSheet(); });
  }

  function openPassModal(result, lv) {
    const stats = E.getStats();
    const next = CL.LEVELS[lv.index + 1];
    const html = '<div class="pass-hero"><div class="pass-ring"><svg><use href="#i-check"/></svg></div>' +
      '<h2>电路通过</h2><p>' + esc(lv.title) + ' · ' + result.passed + ' / ' + result.total + ' 组测试全部正确</p></div>' +
      '<div class="stat-row" style="margin-top:14px">' +
      '<div class="stat"><div class="k">元件</div><div class="v">' + stats.nodes + '</div></div>' +
      '<div class="stat"><div class="k">连线</div><div class="v">' + stats.wires + '</div></div>' +
      '<div class="stat"><div class="k">关卡</div><div class="v">' + lv.num + ' <small>/ ' + CL.LEVELS.length + '</small></div></div></div>' +
      '<p class="table-note" style="text-align:center;margin-top:12px">' + esc(lv.concept || '') + '</p>' +
      '<div class="modal-actions">' +
      (next ? '<button class="btn primary" id="nextLevel">下一关 · ' + esc(next.title) + '</button>' : '<button class="btn primary" id="passFree">全部完成，去自由沙盒</button>') +
      '<button class="btn" id="passStay">留在这里</button></div>';
    openModal(html);
    setTimeout(burstConfetti, 100);
    const n = $('nextLevel');
    if (n) n.addEventListener('click', () => {
      closeModal();
      E.loadLevel(next.id);
      fitView();
      updateChrome(true);
      showToast('LEVEL ' + next.num + ' · ' + next.objective);
      maybeOpenLesson(next);
    });
    const f = $('passFree');
    if (f) f.addEventListener('click', () => { closeModal(); switchToFree(); });
    const s = $('passStay');
    if (s) s.addEventListener('click', closeModal);
  }

  function runLevelCheck() {
    const lv = S.mode === 'level' ? CL.levelById(S.levelId) : null;
    if (!lv) { openSelfCheck(); return; }
    const result = E.runLevelTests(lv);
    E.refresh();
    if (!result) { showToast('验证失败：缺少关卡数据', 'error'); return; }
    if (result.ok) {
      E.markComplete(lv.id, E.getStats());
      sfxSuccess();
      openPassModal(result, lv);
      updateChrome();
    } else {
      sfxError();
      openFailModal(result, lv);
    }
  }

  /* --------------------------------------------------------------- lessons */
  function lessonTableData(lv) {
    if (lv.lesson && lv.lesson.table) return lv.lesson.table;
    const tests = lv.tests;
    if (tests.vectors) {
      const head = tests.inputs.map((n) => n + (widthOfName(n) === 4 ? '·4' : ''))
        .concat(tests.outputs.map((n) => n + (widthOfName(n) === 4 ? '·4' : '')));
      const rows = tests.vectors.map((v) => tests.inputs.map((n) => valText(v[n] | 0, widthOfName(n)))
        .concat(tests.outputs.map((n) => valText(v[n] | 0, widthOfName(n)))));
      return { head, rows };
    }
    if (tests.sequence) {
      const head = ['步'].concat(tests.inputs.map((n) => n + (widthOfName(n) === 4 ? '·4' : '')), ['CLK'])
        .concat(tests.outputs.map((n) => n + (widthOfName(n) === 4 ? '·4' : '')));
      const rows = tests.sequence.map((v, i) => {
        const prev = tests.sequence[i - 1];
        let clk = '0';
        if (v.clock) clk = prev && prev.clock ? '1' : '↑';
        return [String(i + 1)].concat(tests.inputs.map((n) => valText(v[n] | 0, widthOfName(n))), [clk])
          .concat(tests.outputs.map((n) => valText(v[n] | 0, widthOfName(n))));
      });
      return { head, rows };
    }
    return null;
  }

  function lessonSymbolHTML(lv) {
    const lesson = lv.lesson || {};
    if (lesson.symbol && DEFS[lesson.symbol]) {
      return '<div class="lesson-symbol" style="color:' + CL.FAMILIES.logic.color + '">' + gatePaletteIcon(lesson.symbol) + '</div>';
    }
    if (lesson.component && DEFS[lesson.component]) {
      const def = DEFS[lesson.component];
      const fam = CL.FAMILIES[def.family];
      return '<div class="lesson-symbol block" style="color:' + fam.color + ';border-color:' + rgba(fam.color, 0.28) + '">' +
        '<b>' + esc(def.en) + '</b><span>' + esc(def.label) + '</span></div>';
    }
    return '<div class="lesson-symbol block" style="color:' + CL.FAMILIES.data.color + '"><b>LEVEL ' + esc(lv.num) + '</b><span>' + esc(lv.tag) + '</span></div>';
  }

  function openLesson(lv, opts) {
    if (!lv) return;
    const fromPicker = !!(opts && opts.fromPicker);
    const lesson = lv.lesson || {};
    const table = lessonTableData(lv);
    let html = '<button class="icon-btn lesson-close" data-close-modal aria-label="关闭教学"><svg><use href="#i-close"/></svg></button>' +
      '<div class="lesson-hero">' + lessonSymbolHTML(lv) +
      '<div class="lesson-hero-copy"><div class="eyebrow">LEVEL ' + esc(lv.num) + ' · ' + esc(lv.group) + '</div>' +
      '<h2>' + esc(lv.title) + '</h2><div class="en">' + esc(lv.en) + '</div>' +
      '<p class="lesson-objective">' + esc(lv.objective) + '</p></div></div>';
    if (lesson.analogy) {
      const an = lesson.analogy;
      html += '<div class="analogy-card"><div class="analogy-kicker">生活小剧场</div><h3>' + esc(an.title) + '</h3>' +
        '<p class="analogy-scene">' + esc(an.scene) + '</p><div class="analogy-flow">';
      const tokens = an.tokens || [];
      tokens.forEach((token, i) => {
        if (i) html += '<span class="analogy-join">' + esc(an.joiner || '+') + '</span>';
        html += '<span class="analogy-chip">' + esc(token) + '</span>';
      });
      html += '<span class="analogy-arrow">→</span><span class="analogy-chip result">' + esc(an.result) + '</span></div></div>';
    }
    if (lesson.why) {
      html += '<div class="lesson-section"><h3>为什么</h3><p>' + esc(lesson.why) + '</p>';
      if (lesson.formula) html += '<div class="lesson-formula">' + esc(lesson.formula) + '</div>';
      html += '</div>';
    }
    if (table) {
      html += '<div class="lesson-section"><h3>真值 / 时序表</h3><div class="lesson-table-wrap"><table class="lesson-table"><thead><tr>';
      table.head.forEach((h) => { html += '<th>' + esc(h) + '</th>'; });
      html += '</tr></thead><tbody>';
      table.rows.forEach((row) => {
        html += '<tr>';
        row.forEach((cell) => { html += '<td>' + esc(cell) + '</td>'; });
        html += '</tr>';
      });
      html += '</tbody></table></div></div>';
    }
    if (lesson.steps && lesson.steps.length) {
      html += '<div class="lesson-section"><h3>动手步骤</h3><ol class="lesson-steps">';
      lesson.steps.forEach((s) => { html += '<li>' + esc(s) + '</li>'; });
      html += '</ol></div>';
    }
    if (lesson.mistakes && lesson.mistakes.length) {
      html += '<div class="lesson-section"><h3>常见错误</h3><ul class="lesson-mistakes">';
      lesson.mistakes.forEach((s) => { html += '<li>' + esc(s) + '</li>'; });
      html += '</ul></div>';
    }
    if (fromPicker) {
      html += '<p class="lesson-preview-note">当前是关卡介绍预览。点“开始这一关”会载入这一关的电路和存档。</p>';
    }
    html += '<div class="modal-actions"><button class="btn primary" id="lessonStart">' + (fromPicker ? '开始这一关' : '开始连线') + '</button><button class="btn" data-close-modal>关闭</button></div>';
    openModal(html);
    lessonShowing = true;
    lessonLevelId = lv.id;
    lessonFromPicker = fromPicker;
    bindModalBasics();
    const start = $('lessonStart');
    if (start) start.addEventListener('click', () => {
      const targetId = lv.id;
      closeModal();
      if (fromPicker) {
        E.loadLevel(targetId);
        fitView();
        updateChrome(true);
        showToast('LEVEL ' + lv.num + ' · ' + lv.title);
      }
    });
  }

  function maybeOpenLesson(lv) {
    if (!lv || !lv.lesson || lessonsSeen[lv.id]) return;
    setTimeout(() => {
      if (lessonsSeen[lv.id] || lessonShowing) return;
      if (modalOpen || sheetOpen || paletteOpen) return;
      if (S.mode !== 'level' || S.levelId !== lv.id) return;
      openLesson(lv);
    }, 260);
  }

  function componentCoverage() {
    // Three-input gates are extensions of the base gate lessons, not separate
    // curriculum components; keep the 19-core-component coverage count.
    const all = Object.keys(DEFS).filter((t) => !t.endsWith('3'));
    const map = {};
    for (const lv of CL.LEVELS) {
      const types = new Set();
      (lv.covers || []).forEach((t) => types.add(t));
      lv.setup.forEach((s) => types.add(s.type));
      (lv.allowed || []).forEach((t) => types.add(t));
      if (lv.requirements && lv.requirements.types) Object.keys(lv.requirements.types).forEach((t) => types.add(t));
      for (const t of types) if (!map[t]) map[t] = lv;
    }
    const missing = all.filter((t) => !map[t]);
    return { all, map, missing };
  }

  function openCoverage() {
    const cov = componentCoverage();
    const byFamily = {};
    for (const key of cov.all) {
      const def = DEFS[key];
      (byFamily[def.family] = byFamily[def.family] || []).push(key);
    }
    let html = '<div class="hero" style="padding-top:0"><div class="pass-ring" style="width:54px;height:54px"><svg><use href="#i-grid"/></svg></div>' +
      '<h2 style="font-size:21px">元件覆盖</h2><p>' + cov.all.length + ' 个元件 · ' + (cov.all.length - cov.missing.length) + ' 个已安排教学关卡</p></div>';
    html += '<div class="truth-scroll" style="max-height:52dvh"><table class="coverage-table"><thead><tr><th>元件</th><th>类别</th><th>第一次教学</th></tr></thead><tbody>';
    for (const family of Object.keys(CL.FAMILIES)) {
      for (const key of byFamily[family] || []) {
        const def = DEFS[key];
        const lv = cov.map[key];
        html += '<tr><td class="mono">' + esc(def.en) + ' · ' + esc(def.label) + '</td><td>' + esc(CL.FAMILIES[family].label) + '</td><td>' +
          (lv ? '<span class="yes">LEVEL ' + esc(lv.num) + ' · ' + esc(lv.title) + '</span>' : '<span style="color:#ff9ba0">未覆盖</span>') +
          '</td></tr>';
      }
    }
    html += '</tbody></table></div>';
    html += '<p class="table-note">这一版共 ' + cov.all.length + ' 个核心元件、' + CL.LEVELS.length + ' 个关卡，所有核心元件都至少有一个关卡会实际使用它。三输入门（AND3 / OR3 / NAND3 / NOR3 / XOR3 / XNOR3）是基础门的扩展，可在自由沙盒和对应关卡中直接使用。</p>' +
      '<div class="modal-actions"><button class="btn primary" data-close-modal>知道了</button></div>';
    openModal(html);
    bindModalBasics();
  }

  /* ------------------------------------------------------------ level select */
  function openLevelSheet() {
    const completed = CL.LEVELS.filter((l) => E.isCompleted(l.id)).length;
    const cov = componentCoverage();
    let html = '<button class="menu-item" id="freeSandbox" style="margin-bottom:10px"><svg><use href="#i-bolt"/></svg><div><b>自由沙盒</b><span>没有标准答案，随意搭建和验证 · 自动保存</span></div></button>';
    html += '<button class="coverage-card" id="coverageBtn"><span class="coverage-big">' + (cov.all.length - cov.missing.length) + '/' + cov.all.length + '</span>' +
      '<span class="coverage-copy"><b>元件覆盖</b><span>' + (cov.missing.length ? '还有 ' + cov.missing.length + ' 个元件未覆盖' : cov.all.length + ' 个元件都有对应关卡') + '</span></span><span class="icon-btn small"><svg><use href="#i-grid"/></svg></span></button>';
    html += '<div class="section-title" style="margin-top:10px"><span>CHALLENGES · ' + completed + ' / ' + CL.LEVELS.length + ' COMPLETE</span><div class="line"></div></div>';
    for (const group of CL.GROUPS) {
      const list = CL.LEVELS.filter((l) => l.group === group);
      if (!list.length) continue;
      html += '<div class="level-group"><div class="level-group-title">' + esc(group) + '<span>' + list.length + ' 关</span></div><div class="level-grid">';
      for (const lv of list) {
        const done = E.isCompleted(lv.id);
        const cur = S.mode === 'level' && S.levelId === lv.id;
        html += '<div class="level-item' + (done ? ' done' : '') + (cur ? ' current' : '') + '">' +
          '<button class="level-open" data-level="' + lv.id + '">' +
          '<div class="num">LEVEL ' + lv.num + ' · ' + esc(lv.en) + '</div>' +
          '<h3>' + esc(lv.title) + '</h3><p>' + esc(lv.objective) + '</p>' +
          '</button>' +
          '<div class="level-foot"><span class="tag">' + esc(lv.tag) + '</span>' +
          (lv.lesson ? '<button class="level-intro" data-intro="' + lv.id + '" title="查看本关介绍"><svg><use href="#i-help"/></svg>介绍</button>' : '') +
          '</div></div>';
      }
      html += '</div></div>';
    }
    openSheet('CHALLENGES', '关卡', html, '<button class="btn small" data-close-sheet>关闭</button>');
    bindSheetBasics();
    const free = $('freeSandbox');
    if (free) free.addEventListener('click', () => { closeSheet(); switchToFree(); });
    const covBtn = $('coverageBtn');
    if (covBtn) covBtn.addEventListener('click', openCoverage);
    dom.sheetBody.querySelectorAll('[data-level]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.level;
        closeSheet();
        E.loadLevel(id);
        fitView();
        updateChrome(true);
        const lv = CL.levelById(id);
        showToast('关卡 ' + lv.num + ' · ' + lv.title);
        maybeOpenLesson(lv);
      });
    });
    dom.sheetBody.querySelectorAll('[data-intro]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const lv = CL.levelById(btn.dataset.intro);
        if (lv) openLesson(lv, { fromPicker: true });
      });
    });
  }

  function switchToFree() {
    E.openFree();
    fitView();
    updateChrome(true);
    showToast('自由沙盒 · 没有标准答案，结果实时刷新');
  }

  /* ------------------------------------------------------------------- menus */
  function openHelp() {
    const html = '<div class="hero" style="padding:2px 0 6px"><div class="pass-ring" style="width:52px;height:52px;border-color:rgba(64,242,176,.3)"><svg><use href="#i-help"/></svg></div>' +
      '<h2 style="font-size:21px">怎么玩</h2><p>把端口连起来，让信号从输入流到输出。</p></div>' +
      '<div class="help-cols">' +
      '<div class="help-section"><h3>连线</h3><ul>' +
      '<li>从输出端口（右侧圆点）拖到输入端口（左侧圆点）。</li>' +
      '<li>也可以先点一个端口，再点另一个端口；适合单手操作。</li>' +
      '<li>4 位总线是<span style="color:#ffc857">金色粗线</span>，不能直接接到 1 位端口。</li>' +
      '<li>拖动元件本体可以移动位置；拖动空白可以平移画布。</li>' +
      '<li>点选导线后按「删除」；切到剪刀工具可直接剪断导线或删除元件。</li>' +
      '<li>双指缩放；右下角按钮可以放大、缩小、适应画布。</li></ul></div>' +
      '<div class="help-section"><h3>看结果</h3><ul>' +
      '<li>绿色线代表信号 1，暗蓝线代表 0，金色总线上的小牌显示十六进制值。</li>' +
      '<li>底部监视条实时显示命名输入 / 输出，点输入可以直接改值。</li>' +
      '<li><b>真值表</b>会枚举 1 位输入的所有组合，点击一行可应用这组输入。</li>' +
      '<li><b>验证</b>会运行关卡的标准测试向量，逐项检查你的电路。</li>' +
      '<li>每关第一次进入会打开<b>介绍/教学</b>；目标卡的“介绍”、关卡列表每张卡的“介绍”、菜单里的“重看本关介绍”都能再次打开。</li>' +
      '<li>菜单 → <b>元件覆盖清单</b> 可以查看 19 个核心元件分别在哪一关教学；三输入门是基础门的扩展变体。</li></ul></div>' +
      '<div class="help-section"><h3>元件速查</h3><ul>' +
      '<li><code>4b</code> 是 4 位输入，点底部四个小格切换 8/4/2/1。</li>' +
      '<li><code>AND3 / OR3 / NAND3 / NOR3 / XOR3 / XNOR3</code> 是三输入门，A/B/C 三条输入线；用于 x·y·z′ 这类三变量式子。</li>' +
      '<li><code>SPLIT / MERGE</code> 拆分或合并 4 位总线。</li>' +
      '<li><code>DFF</code> 在时钟上升沿锁存 D；暂停后按单步观察。</li>' +
      '<li>锁定元件是关卡给出的输入/输出，不能删除，但可以移动。</li></ul></div>' +
      '<div class="help-section"><h3>快捷键（外接键盘）</h3><ul>' +
      '<li><code>1 / 2 / 3</code> 选择 / 连线 / 剪刀工具</li>' +
      '<li><code>Space</code> 运行或暂停 · <code>T</code> 真值表</li>' +
      '<li><code>Delete</code> 删除选中元件或线 · <code>Esc</code> 取消</li>' +
      '<li><code>Ctrl+Z / Ctrl+Y</code> 撤销 / 重做</li></ul></div></div>' +
      '<div class="modal-actions"><button class="btn primary" data-close-modal>知道了</button></div>';
    openModal(html);
    bindModalBasics();
  }

  function openMenu() {
    const lv = S.mode === 'level' ? CL.levelById(S.levelId) : null;
    let html = '<div class="eyebrow">CIRCUIT LAB · MENU</div><h2 style="margin:5px 0 0;font-size:22px">' + (lv ? '关卡 ' + lv.num + ' · ' + esc(lv.title) : '自由沙盒') + '</h2>' +
      '<p class="table-note" style="margin-top:4px">所有改动都会自动保存到本机。</p><div class="menu-list">' +
      '<button class="menu-item" data-menu="levels"><svg><use href="#i-chapter"/></svg><div><b>关卡选择</b><span>' + (lv ? '切换关卡或回到自由沙盒' : '从基础逻辑门到 4 位加法器') + '</span></div></button>' +
      '<button class="menu-item" data-menu="coverage"><svg><use href="#i-grid"/></svg><div><b>元件覆盖清单</b><span>19 个核心元件与对应教学关卡</span></div></button>' +
      '<button class="menu-item" data-menu="help"><svg><use href="#i-help"/></svg><div><b>玩法说明</b><span>连线、位宽、真值表、快捷键</span></div></button>';
    if (lv) {
      html += '<button class="menu-item" data-menu="intro"><svg><use href="#i-help"/></svg><div><b>重看本关介绍</b><span>生活类比、公式、真值表、接线步骤</span></div></button>' +
        '<button class="menu-item" data-menu="restart"><svg><use href="#i-undo"/></svg><div><b>重新开始本关</b><span>清空自建元件，保留关卡输入输出</span></div></button>' +
        '<button class="menu-item" data-menu="free"><svg><use href="#i-bolt"/></svg><div><b>返回自由沙盒</b><span>本关自动保存，可随时回来</span></div></button>';
    } else {
      html += '<button class="menu-item" data-menu="clear"><svg><use href="#i-trash"/></svg><div><b>清空画布</b><span>删除所有元件和连线</span></div></button>';
    }
    html += '<button class="menu-item danger" data-menu="reset"><svg><use href="#i-undo"/></svg><div><b>重置关卡进度</b><span>清除所有通关记录</span></div></button>' +
      '<button class="menu-item" data-menu="about"><svg><use href="#i-bolt"/></svg><div><b>关于 Circuit Lab</b><span>离线数字电路实验场 · v1.5</span></div></button>' +
      '</div><div class="modal-actions"><button class="btn" data-close-modal>关闭</button></div>';
    openModal(html);
    bindModalBasics();
    dom.modal.querySelectorAll('[data-menu]').forEach((el) => {
      el.addEventListener('click', () => {
        const action = el.dataset.menu;
        if (action === 'levels') { closeModal(); openLevelSheet(); }
        else if (action === 'intro') { closeModal(); openLesson(lv); }
        else if (action === 'coverage') { closeModal(); openCoverage(); }
        else if (action === 'help') { closeModal(); openHelp(); }
        else if (action === 'free') { closeModal(); switchToFree(); }
        else if (action === 'restart') { closeModal(); confirmRestart(); }
        else if (action === 'clear') { closeModal(); confirmClear(); }
        else if (action === 'reset') { closeModal(); confirmResetProgress(); }
        else if (action === 'about') { closeModal(); openAbout(); }
      });
    });
  }

  function confirmRestart() {
    const lv = CL.levelById(S.levelId);
    openModal('<div class="pass-hero fail-hero" style="padding-top:0"><div class="pass-ring"><svg><use href="#i-lock"/></svg></div><h2>重新开始本关？</h2><p>会清空你在「' + esc(lv ? lv.title : '') + '」里搭的电路。</p></div>' +
      '<div class="modal-actions"><button class="btn danger" id="confirmYes">重新开始</button><button class="btn" data-close-modal>取消</button></div>');
    bindModalBasics();
    const y = $('confirmYes');
    if (y) y.addEventListener('click', () => {
      closeModal();
      E.loadLevel(S.levelId, { fresh: true });
      fitView();
      updateChrome(true);
      showToast('本关已重置');
    });
  }
  function confirmClear() {
    openModal('<div class="pass-hero fail-hero" style="padding-top:0"><div class="pass-ring"><svg><use href="#i-trash"/></svg></div><h2>清空画布？</h2><p>所有元件和连线都会被删除。这个操作可以撤销。</p></div>' +
      '<div class="modal-actions"><button class="btn danger" id="confirmYes">清空</button><button class="btn" data-close-modal>取消</button></div>');
    bindModalBasics();
    const y = $('confirmYes');
    if (y) y.addEventListener('click', () => {
      closeModal();
      E.clearCurrent();
      updateChrome();
      showToast('画布已清空');
    });
  }
  function confirmResetProgress() {
    openModal('<div class="pass-hero fail-hero" style="padding-top:0"><div class="pass-ring"><svg><use href="#i-undo"/></svg></div><h2>重置关卡进度？</h2><p>所有关卡的 ✓ 通关记录都会被清除，电路本身仍会保留。</p></div>' +
      '<div class="modal-actions"><button class="btn danger" id="confirmYes">重置进度</button><button class="btn" data-close-modal>取消</button></div>');
    bindModalBasics();
    const y = $('confirmYes');
    if (y) y.addEventListener('click', () => {
      closeModal();
      E.resetProgress();
      updateChrome(true);
      showToast('关卡进度已重置');
    });
  }
  function openAbout() {
    openModal('<div class="hero" style="padding-top:0"><div class="pass-ring" style="width:56px;height:56px"><svg><use href="#i-bolt"/></svg></div>' +
      '<h2 style="font-size:22px">Circuit Lab</h2><p>逻辑电路实验室 · 离线版</p></div>' +
      '<div style="margin-top:12px"><div class="about-line"><span>版本</span><b>1.5 · 三输入门与 19 关教学</b></div>' +
      '<div class="about-line"><span>运行方式</span><b>完全离线 · 本机存储</b></div>' +
      '<div class="about-line"><span>适合</span><b>数字逻辑 · 计算机组成原理</b></div>' +
      '<div class="about-line"><span>数据</span><b>不上传、不联网</b></div></div>' +
      '<p class="table-note">用真值表和测试向量检验你的计算。遇到和课本不一致的结果时，先检查输入是否悬空、位宽是否匹配，以及时钟是否在运行。</p>' +
      '<div class="modal-actions"><button class="btn primary" data-close-modal>知道了</button></div>');
    bindModalBasics();
  }

  function openWelcome() {
    welcomeShowing = true;
    openModal('<div class="hero"><svg class="hero-mark" viewBox="0 0 44 44"><path d="M7 10h30"/><path d="M12 36 22 14l10 22"/></svg>' +
      '<h1>CIRCUIT <b>LAB</b></h1><div class="hero-sub">逻辑电路实验室</div>' +
      '<p class="hero-copy">一个可以自由连线、实时看结果，并用真值表验证计算的数字电路沙盒。</p></div>' +
      '<div class="welcome-steps">' +
      '<div class="welcome-step"><span class="n">01</span><div><b>放元件，连端口</b><span>从输出圆点拖到输入圆点；也能先点一下再点一下。</span></div></div>' +
      '<div class="welcome-step"><span class="n">02</span><div><b>实时看 0 和 1</b><span>绿色线是 1，金色粗线是 4 位总线，底部监视条同步刷新。</span></div></div>' +
      '<div class="welcome-step"><span class="n">03</span><div><b>用真值表 / 验证对照</b><span>枚举所有输入组合，或者跑一遍关卡标准答案。</span></div></div></div>' +
      '<div class="modal-actions"><button class="btn primary" id="welcomeFree">开始自由搭建</button><button class="btn" id="welcomeLevel">先玩第 1 关</button><button class="btn ghost" id="welcomeHelp">玩法</button></div>');
    bindModalBasics();
    const done = () => { E.setSetting('onboarded', true); closeModal(); };
    const free = $('welcomeFree'); if (free) free.addEventListener('click', done);
    const lvl = $('welcomeLevel'); if (lvl) lvl.addEventListener('click', () => {
      E.setSetting('onboarded', true);
      closeModal();
      E.loadLevel('first-light');
      fitView();
      updateChrome(true);
      showToast('目标：把开关 A 接到灯 Y');
      maybeOpenLesson(CL.levelById('first-light'));
    });
    const help = $('welcomeHelp'); if (help) help.addEventListener('click', () => { done(); openHelp(); });
  }

  function bindSheetBasics() {
    dom.sheetBody.querySelectorAll('[data-close-sheet]').forEach((b) => b.addEventListener('click', closeSheet));
    dom.sheetFoot.querySelectorAll('[data-close-sheet]').forEach((b) => b.addEventListener('click', closeSheet));
  }
  function bindModalBasics() {
    dom.modal.querySelectorAll('[data-close-modal]').forEach((b) => b.addEventListener('click', closeModal));
  }

  function closeOverlays() {
    if (modalOpen) closeModal();
    if (sheetOpen) closeSheet();
    if (paletteOpen) closePalette();
  }

  /* ---------------------------------------------------------------- keyboard */
  function onKeyDown(e) {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (modalOpen) closeModal();
      else if (sheetOpen) closeSheet();
      else if (paletteOpen) closePalette();
      else if (S.pending) { S.pending = null; requestRender(); }
      else if (S.selected) E.setSelected(null);
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) E.redo(); else E.undo();
        updateChrome();
        return;
      }
      if (e.key.toLowerCase() === 'y') {
        e.preventDefault();
        E.redo();
        updateChrome();
        return;
      }
    }
    if (modalOpen || sheetOpen) return;
    if (e.key === '1' || e.key === '2' || e.key === '3') {
      setTool(['select', 'wire', 'erase'][Number(e.key) - 1]);
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      toggleRun();
      return;
    }
    if (e.key === 't' || e.key === 'T') { e.preventDefault(); openTruthSheet(); return; }
    if (e.key === 'f' || e.key === 'F') { e.preventDefault(); fitView(true); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      deleteSelection();
      return;
    }
  }

  function toggleRun() {
    E.setRunning(!S.running);
    updateChrome();
    showToast(S.running ? '仿真继续 · 时钟运行中' : '仿真已暂停 · 可按单步观察触发器');
    sfxTap();
  }

  function deleteSelection() {
    if (!S.selected) return;
    if (S.selected.kind === 'wire') {
      E.removeWire(S.selected.id);
      sfxDelete();
    } else if (S.selected.kind === 'node') {
      const n = E.nodeById(S.selected.id);
      if (n && n.locked) { showToast('关卡固定的输入/输出不能删除', 'warn'); sfxError(); return; }
      E.removeNode(S.selected.id);
      sfxDelete();
    }
    updateChrome();
  }

  /* -------------------------------------------------------------------- init */
  function bindUI() {
    dom.paletteToggle.addEventListener('click', togglePalette);
    dom.paletteClose.addEventListener('click', closePalette);
    dom.scrim.addEventListener('click', closePalette);
    dom.levelPill.addEventListener('click', openLevelSheet);
    dom.undoBtn.addEventListener('click', () => { E.undo(); updateChrome(); sfxTap(); });
    dom.redoBtn.addEventListener('click', () => { E.redo(); updateChrome(); sfxTap(); });
    dom.soundBtn.addEventListener('click', () => {
      soundOn = !soundOn;
      E.setSetting('sound', soundOn);
      updateSoundUI();
      if (soundOn) { ensureAudio(); tone(720, 0.06, 'sine', 0.03); }
      showToast(soundOn ? '音效已开启' : '音效已静音');
    });
    dom.helpBtn.addEventListener('click', openHelp);
    dom.menuBtn.addEventListener('click', openMenu);
    dom.goalToggle.addEventListener('click', toggleGoal);
    dom.goalTitle.addEventListener('click', () => { if (goalCollapsed) toggleGoal(); });
    dom.goalLesson.addEventListener('click', () => {
      const lv = S.mode === 'level' ? CL.levelById(S.levelId) : null;
      if (lv) openLesson(lv);
    });
    dom.goalCheck.addEventListener('click', runLevelCheck);
    dom.runBtn.addEventListener('click', toggleRun);
    dom.stepBtn.addEventListener('click', () => {
      E.stepClock();
      updateChrome();
      showToast('单步时钟：0 → 1 → 0');
      sfxTap();
    });
    dom.deleteBtn.addEventListener('click', deleteSelection);
    dom.truthBtn.addEventListener('click', openTruthSheet);
    dom.checkBtn.addEventListener('click', () => { if (S.mode === 'level') runLevelCheck(); else openSelfCheck(); });
    dom.zoomIn.addEventListener('click', () => { zoomAt(1.18, W / 2, H / 2); requestRender(); });
    dom.zoomOut.addEventListener('click', () => { zoomAt(1 / 1.18, W / 2, H / 2); requestRender(); });
    dom.fitView.addEventListener('click', () => fitView(true));
    document.querySelectorAll('.tool-btn').forEach((b) => {
      b.addEventListener('click', () => setTool(b.dataset.tool));
    });
    dom.sheetClose.addEventListener('click', closeSheet);
    dom.sheetWrap.addEventListener('click', (e) => { if (e.target === dom.sheetWrap) closeSheet(); });
    dom.modalWrap.addEventListener('click', (e) => { if (e.target === dom.modalWrap) closeModal(); });

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', () => { resizeCanvas(); });
    if (window.ResizeObserver) new ResizeObserver(resizeCanvas).observe(dom.stage);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { E.saveNow(); E.emit(); }
    });
  }

  function updateSoundUI() {
    setUse(dom.soundBtn, soundOn ? '#i-sound' : '#i-mute');
    dom.soundBtn.classList.toggle('accent', soundOn);
  }

  function handleEngineChange() {
    updateChrome(false);
    requestRender();
  }

  function maybeWelcome() {
    if (E.getSettings().onboarded) return;
    setTimeout(() => { if (!E.getSettings().onboarded) openWelcome(); }, 850);
  }

  function animationLoop(t) {
    if (!document.hidden) {
      if (E.tick(t)) updateMonitor();
      if (t - lastDraw > 32) render(t);
    }
    requestAnimationFrame(animationLoop);
  }

  function init() {
    bootDone = true;
    buildPalette();
    bindUI();
    resizeCanvas();
    E.setChangeHandler(handleEngineChange);
    E.boot();
    soundOn = E.getSettings().sound !== false;
    lessonsSeen = Object.assign({}, E.getSettings().lessonsSeen || {});
    updateSoundUI();
    resizeCanvas();
    initialFitDone = true;
    if (S.nodes.length) E.fitCamera(W, H);
    updateChrome(true);
    render(performance.now());
    setTimeout(() => { dom.boot = $('boot'); if (dom.boot) dom.boot.classList.add('hide'); }, 520);
    maybeWelcome();
    setTimeout(() => {
      if (S.mode === 'level' && !modalOpen && !sheetOpen) {
        const lv = CL.levelById(S.levelId);
        if (lv) maybeOpenLesson(lv);
      }
    }, 1200);
    requestAnimationFrame(animationLoop);
  }

  CL.handleBack = function () {
    if (modalOpen) { closeModal(); return true; }
    if (sheetOpen) { closeSheet(); return true; }
    if (paletteOpen) { closePalette(); return true; }
    if (S.pending) { S.pending = null; requestRender(); return true; }
    if (S.selected) { E.setSelected(null); return true; }
    if (S.mode === 'level') { switchToFree(); return true; }
    return false;
  };

  // Small automation/debug surface used by the desktop test harness.
  CL.debug = {
    add: (type, x, y) => E.addNode(type, x, y),
    connect: (a, ap, b, bp) => E.connect(a, ap, b, bp),
    loadLevel: (id) => { E.loadLevel(id); fitView(); updateChrome(true); },
    switchToFree,
    truth: openTruthSheet,
    selfCheck: openSelfCheck,
    check: runLevelCheck,
    lesson: () => { const lv = S.mode === 'level' ? CL.levelById(S.levelId) : null; if (lv) openLesson(lv); },
    lessonPreview: (id) => { const lv = CL.levelById(id); if (lv) openLesson(lv, { fromPicker: true }); },
    coverage: openCoverage,
    levels: openLevelSheet,
    close: closeOverlays,
    welcome: openWelcome,
    setInput: E.setInput,
    fit: () => fitView(true),
    state: S,
    render: () => render(performance.now()),
    errors: () => window.__errors
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
