/* Circuit Lab — data model, persistence and digital simulation.
   Values are integers: 1-bit ports use 0/1, 4-bit ports use 0..15. */
(function () {
  'use strict';

  const CL = (window.CL = window.CL || {});
  const DEFS = CL.DEFS;
  const LEVELS = CL.LEVELS;

  const KEY_FREE = 'circuitlab.free.v1';
  const KEY_LEVEL_PREFIX = 'circuitlab.level.';
  const KEY_PROGRESS = 'circuitlab.progress.v1';
  const KEY_LAST = 'circuitlab.last.v1';
  const KEY_SETTINGS = 'circuitlab.settings.v1';

  const memoryStore = Object.create(null);
  function storeGet(key) {
    try {
      if (window.AndroidBridge && window.AndroidBridge.load) {
        const v = window.AndroidBridge.load(key);
        if (v !== undefined && v !== null) return v;
      }
    } catch (e) { /* ignore */ }
    try {
      const v = localStorage.getItem(key);
      if (v !== null) return v;
    } catch (e) { /* ignore */ }
    return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
  }
  function storeSet(key, value) {
    memoryStore[key] = String(value);
    try {
      if (window.AndroidBridge && window.AndroidBridge.save) {
        window.AndroidBridge.save(key, String(value));
      }
    } catch (e) { /* ignore */ }
    try { localStorage.setItem(key, String(value)); } catch (e) { /* ignore */ }
  }
  function storeRemove(key) {
    delete memoryStore[key];
    try {
      if (window.AndroidBridge && window.AndroidBridge.remove) window.AndroidBridge.remove(key);
    } catch (e) { /* ignore */ }
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }
  function parseJSON(raw, fallback) {
    if (!raw) return fallback;
    try {
      const v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }

  const state = {
    mode: 'free',
    levelId: null,
    nodes: [],
    wires: [],
    nextId: 1,
    nextWireId: 1,
    running: true,
    clockHigh: false,
    clockSpeed: 1,
    clockOrigin: 0,
    unstable: false,
    selected: null,
    tool: 'select',
    pending: null,
    camera: { x: 450, y: 250, scale: 1 }
  };

  let inputMap = new Map();
  let history = [];
  let future = [];
  let saveTimer = null;
  let booted = false;
  let settings = { sound: true };
  let progress = { completed: {} };
  let changeHandler = null;

  function nodeById(id) {
    return state.nodes.find((n) => n.id === id) || null;
  }

  function wireById(id) {
    return state.wires.find((w) => w.id === id) || null;
  }

  function defOf(node) {
    return DEFS[node.type];
  }

  function portDef(node, port, direction) {
    const d = defOf(node);
    const list = direction === 'in' ? d.inputs : d.outputs;
    return list.find((p) => p.id === port) || null;
  }

  function rebuildInputMap() {
    inputMap = new Map();
    for (const w of state.wires) {
      inputMap.set(w.to.n + ':' + w.to.p, w);
    }
  }

  function inputWire(nodeId, port) {
    return inputMap.get(nodeId + ':' + port) || null;
  }

  function readInput(node, port) {
    const w = inputMap.get(node.id + ':' + port);
    if (!w) return 0;
    const src = nodeById(w.from.n);
    if (!src || !src._out) return 0;
    const v = src._out[w.from.p];
    return typeof v === 'number' ? v : 0;
  }

  function readInputByName(name) {
    const n = findByPortName(name);
    return n ? readNamedOutput(n) : null;
  }

  function readNamedOutput(node) {
    if (!node) return 0;
    if (node.type === 'OUT') return readInput(node, 'X') & 1;
    if (node.type === 'HEX') return readInput(node, 'D') & 15;
    return 0;
  }

  function outputWidthForName(name) {
    const n = findByPortName(name);
    if (!n) return 1;
    if (n.type === 'NIB' || n.type === 'HEX' || n.type === 'ADD4' || n.type === 'REG4') return 4;
    return 1;
  }

  function findByPortName(name) {
    if (!name) return null;
    return state.nodes.find((n) =>
      n.name === name && (n.type === 'IN' || n.type === 'NIB' || n.type === 'OUT' || n.type === 'HEX')
    ) || null;
  }

  function setNodeValue(node, value) {
    if (node.type === 'NIB') node.value = ((value | 0) % 16 + 16) % 16;
    else if (node.type === 'IN' || node.type === 'CONST') node.value = value ? 1 : 0;
  }

  function makeName(type) {
    const used = new Set(state.nodes.map((n) => n.name).filter(Boolean));
    const isOutput = type === 'OUT' || type === 'HEX';
    if (isOutput) {
      const first = type === 'HEX' ? 'S' : 'Y';
      if (!used.has(first)) return first;
      let i = 2;
      while (used.has(first + i)) i++;
      return first + i;
    }
    const pool = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    for (const c of pool) {
      if (!used.has(c)) return c;
    }
    let i = 2;
    while (used.has('X' + i)) i++;
    return 'X' + i;
  }

  function makeNode(type, x, y, opts) {
    opts = opts || {};
    const def = DEFS[type];
    if (!def) throw new Error('Unknown component: ' + type);
    const node = {
      id: opts.id != null ? opts.id : state.nextId++,
      type,
      x: Math.round(x),
      y: Math.round(y),
      name: opts.name !== undefined ? opts.name : (def.display || type === 'IN' || type === 'NIB') ? makeName(type) : undefined,
      value: opts.value != null ? opts.value : (type === 'CONST' ? 1 : 0),
      locked: !!opts.locked,
      frozen: !!opts.frozen
    };
    if (opts.id != null && opts.id >= state.nextId) state.nextId = opts.id + 1;
    if (type === 'NIB') node.value = (node.value | 0) & 15;
    if (type === 'IN' || type === 'CONST') node.value = node.value ? 1 : 0;
    if (def.seq) node._state = Object.assign({}, def.initial);
    node._out = {};
    node._in = {};
    node._lastClk = -1;
    if (opts.state && def.seq) node._state = Object.assign({}, def.initial, opts.state);
    return node;
  }

  function allOutputsEqual(node, next) {
    const d = defOf(node);
    for (const p of d.outputs) {
      const mask = p.width === 4 ? 15 : 1;
      if (((node._out[p.id] | 0) & mask) !== ((next[p.id] | 0) & mask)) return false;
    }
    return true;
  }

  function evaluateNode(node) {
    const d = defOf(node);
    const ins = {};
    for (const p of d.inputs) {
      const mask = p.width === 4 ? 15 : 1;
      ins[p.id] = readInput(node, p.id) & mask;
    }
    node._in = ins;
    if (d.display) return {};
    let out;
    try {
      out = d.comb(ins, node, state) || {};
    } catch (e) {
      out = {};
    }
    const clean = {};
    for (const p of d.outputs) {
      const mask = p.width === 4 ? 15 : 1;
      clean[p.id] = (out[p.id] | 0) & mask;
    }
    return clean;
  }

  function simulate() {
    const MAX_PASS = 48;
    // Seed sequential outputs from retained state.
    for (const node of state.nodes) {
      const d = defOf(node);
      if (d.seq) {
        if (!node._state) node._state = Object.assign({}, d.initial);
        node._out = evaluateNode(node);
      }
    }
    let unstable = false;
    for (let outer = 0; outer < 5; outer++) {
      let changed = false;
      let settled = false;
      for (let pass = 0; pass < MAX_PASS; pass++) {
        changed = false;
        for (const node of state.nodes) {
          const d = defOf(node);
          if (d.seq) continue;
          const next = evaluateNode(node);
          if (!allOutputsEqual(node, next)) {
            node._out = next;
            changed = true;
          }
        }
        if (!changed) { settled = true; break; }
      }
      if (!settled) unstable = true;

      let seqChanged = false;
      for (const node of state.nodes) {
        const d = defOf(node);
        if (!d.seq) continue;
        const clk = readInput(node, 'CLK') & 1;
        if (node._lastClk === 0 && clk === 1) {
          let nextState = null;
          if (node.type === 'DFF') {
            nextState = readInput(node, 'D') & 1;
          } else if (node.type === 'REG4') {
            if (readInput(node, 'EN') & 1) nextState = readInput(node, 'D') & 15;
          }
          if (nextState !== null && node._state.Q !== nextState) {
            node._state.Q = nextState;
            seqChanged = true;
          }
        }
        node._lastClk = clk;
        const nextOut = evaluateNode(node);
        if (!allOutputsEqual(node, nextOut)) {
          node._out = nextOut;
          seqChanged = true;
        }
      }
      if (!seqChanged && settled) break;
    }
    state.unstable = unstable;
    return unstable;
  }

  function emit() {
    if (typeof changeHandler === 'function') changeHandler();
  }

  function snapshot() {
    return {
      mode: state.mode,
      levelId: state.levelId,
      nextId: state.nextId,
      nextWireId: state.nextWireId,
      nodes: state.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        x: n.x,
        y: n.y,
        name: n.name,
        value: n.value,
        locked: !!n.locked,
        frozen: !!n.frozen,
        state: n._state ? Object.assign({}, n._state) : undefined
      })),
      wires: state.wires.map((w) => ({
        id: w.id,
        from: { n: w.from.n, p: w.from.p },
        to: { n: w.to.n, p: w.to.p }
      }))
    };
  }

  function remember() {
    history.push(snapshot());
    if (history.length > 100) history.shift();
    future = [];
  }

  function restoreSnapshot(snap) {
    state.mode = snap.mode === 'level' ? 'level' : 'free';
    state.levelId = snap.levelId || null;
    state.nextId = snap.nextId || 1;
    state.nextWireId = snap.nextWireId || 1;
    state.nodes = (snap.nodes || []).map((n) => {
      const node = makeNode(n.type, n.x, n.y, {
        id: n.id, name: n.name, value: n.value, locked: n.locked, frozen: n.frozen, state: n.state
      });
      return node;
    });
    state.wires = (snap.wires || []).map((w) => ({
      id: w.id,
      from: { n: w.from.n, p: w.from.p },
      to: { n: w.to.n, p: w.to.p }
    })).filter((w) => {
      const a = nodeById(w.from.n);
      const b = nodeById(w.to.n);
      return a && b && portDef(a, w.from.p, 'out') && portDef(b, w.to.p, 'in');
    });
    state.pending = null;
    state.selected = null;
    state.unstable = false;
    rebuildInputMap();
    simulate();
  }

  function undo() {
    if (!history.length) return false;
    future.push(snapshot());
    restoreSnapshot(history.pop());
    autosave();
    emit();
    return true;
  }

  function redo() {
    if (!future.length) return false;
    history.push(snapshot());
    restoreSnapshot(future.pop());
    autosave();
    emit();
    return true;
  }

  function addNode(type, x, y, opts) {
    opts = opts || {};
    if (!opts.noHistory) remember();
    const node = makeNode(type, x, y, opts);
    state.nodes.push(node);
    rebuildInputMap();
    simulate();
    if (!opts.silent) autosave();
    return node;
  }

  function removeNode(id) {
    const node = nodeById(id);
    if (!node) return false;
    if (node.locked) return false;
    remember();
    state.nodes = state.nodes.filter((n) => n.id !== id);
    state.wires = state.wires.filter((w) => w.from.n !== id && w.to.n !== id);
    if (state.selected && state.selected.kind === 'node' && state.selected.id === id) state.selected = null;
    rebuildInputMap();
    simulate();
    autosave();
    emit();
    return true;
  }

  function removeWire(id) {
    if (!wireById(id)) return false;
    remember();
    state.wires = state.wires.filter((w) => w.id !== id);
    if (state.selected && state.selected.kind === 'wire' && state.selected.id === id) state.selected = null;
    rebuildInputMap();
    simulate();
    autosave();
    emit();
    return true;
  }

  function connect(fromNodeId, fromPort, toNodeId, toPort, opts) {
    opts = opts || {};
    const a = nodeById(fromNodeId);
    const b = nodeById(toNodeId);
    if (!a || !b) return { ok: false, reason: '元件不存在' };
    const op = portDef(a, fromPort, 'out');
    const ip = portDef(b, toPort, 'in');
    if (!op) return { ok: false, reason: '起点必须是输出端口' };
    if (!ip) return { ok: false, reason: '终点必须是输入端口' };
    if (op.width !== ip.width) {
      return { ok: false, reason: '位宽不匹配：' + (op.width === 4 ? '4 位总线' : '1 位线') + ' 不能直接接到 ' + (ip.width === 4 ? '4 位端口' : '1 位端口') };
    }
    if (!opts.noHistory) remember();
    const existing = inputMap.get(toNodeId + ':' + toPort);
    let replaced = false;
    if (existing) {
      if (existing.from.n === fromNodeId && existing.from.p === fromPort) {
        return { ok: true, duplicate: true };
      }
      state.wires = state.wires.filter((w) => w.id !== existing.id);
      replaced = true;
    }
    const wire = {
      id: state.nextWireId++,
      from: { n: fromNodeId, p: fromPort },
      to: { n: toNodeId, p: toPort }
    };
    state.wires.push(wire);
    rebuildInputMap();
    simulate();
    if (!opts.silent) autosave();
    if (!opts.noRender) emit();
    return { ok: true, wire, replaced };
  }

  function setInput(name, value) {
    const node = findByPortName(name);
    if (!node) return false;
    setNodeValue(node, value);
    simulate();
    autosave();
    emit();
    return true;
  }

  function setNodeValueById(id, value, opts) {
    const node = nodeById(id);
    if (!node) return false;
    if (node.frozen) return false;
    opts = opts || {};
    if (!opts.noHistory) remember();
    setNodeValue(node, value);
    simulate();
    if (!opts.silent) { autosave(); emit(); }
    return true;
  }

  function toggleNodeBit(nodeId, bitIndex) {
    const node = nodeById(nodeId);
    if (!node || node.type !== 'NIB') return false;
    remember();
    node.value = (node.value | 0) ^ (1 << (3 - bitIndex));
    simulate();
    autosave();
    emit();
    return true;
  }

  function toggleNode(nodeId) {
    const node = nodeById(nodeId);
    if (!node || node.frozen) return false;
    if (node.type === 'NIB') {
      remember();
      node.value = ((node.value | 0) + 1) & 15;
    } else if (node.type === 'IN' || node.type === 'CONST') {
      remember();
      node.value = node.value ? 0 : 1;
    } else return false;
    simulate();
    autosave();
    emit();
    return true;
  }

  function moveNode(id, x, y, opts) {
    const node = nodeById(id);
    if (!node) return;
    opts = opts || {};
    if (!opts.noHistory) remember();
    node.x = Math.round(x);
    node.y = Math.round(y);
    if (!opts.silent) { autosave(); emit(); }
  }

  function clearWiresForNode(nodeId) {
    state.wires = state.wires.filter((w) => w.from.n !== nodeId && w.to.n !== nodeId);
    rebuildInputMap();
  }

  function saveKey() {
    if (state.mode === 'level' && state.levelId) return KEY_LEVEL_PREFIX + state.levelId;
    return KEY_FREE;
  }

  function autosave() {
    if (!booted) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      saveNow();
    }, 350);
  }

  function saveNow() {
    if (!booted) return;
    try {
      storeSet(saveKey(), JSON.stringify(snapshot()));
      storeSet(KEY_LAST, JSON.stringify({ mode: state.mode, levelId: state.levelId }));
    } catch (e) { /* ignore quota errors */ }
  }

  function loadSnapshotFromStore(key) {
    const obj = parseJSON(storeGet(key), null);
    if (!obj || !Array.isArray(obj.nodes)) return false;
    restoreSnapshot(obj);
    state.running = true;
    state.clockHigh = false;
    state.clockOrigin = 0;
    return true;
  }

  function makeLevelSetup(level) {
    state.mode = 'level';
    state.levelId = level.id;
    state.nodes = [];
    state.wires = [];
    state.nextId = 1;
    state.nextWireId = 1;
    state.selected = null;
    state.pending = null;
    state.running = true;
    state.clockHigh = false;
    state.clockOrigin = 0;
    for (const s of level.setup) {
      state.nodes.push(makeNode(s.type, s.x, s.y, {
        name: s.name, value: s.value != null ? s.value : 0, locked: s.locked, frozen: s.frozen
      }));
    }
    rebuildInputMap();
    simulate();
  }

  function fitCamera(viewW, viewH) {
    const nodes = state.nodes;
    if (!nodes.length) {
      state.camera.x = 450;
      state.camera.y = 250;
      state.camera.scale = 1;
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + CL.NODE_WIDTH(n));
      maxY = Math.max(maxY, n.y + CL.nodeHeight(n));
    }
    const padX = 72;
    const padTop = 66;
    const padBottom = 80;
    const bw = Math.max(120, maxX - minX);
    const bh = Math.max(120, maxY - minY);
    const scale = CL.clamp(Math.min((viewW - padX * 2) / bw, (viewH - padTop - padBottom) / bh), 0.38, 1.35);
    state.camera.scale = scale;
    state.camera.x = (minX + maxX) / 2;
    // A larger bottom reserve means the content should sit slightly higher.
    state.camera.y = (minY + maxY) / 2 - (padTop - padBottom) / (2 * scale);
  }

  function loadLevel(id, opts) {
    opts = opts || {};
    const level = CL.levelById(id);
    if (!level) return false;
    saveNow();
    const key = KEY_LEVEL_PREFIX + id;
    let restored = false;
    if (!opts.fresh) restored = loadSnapshotFromStore(key);
    if (!restored) makeLevelSetup(level);
    history = [];
    future = [];
    state.tool = 'select';
    saveNow();
    emit();
    return true;
  }

  function openFree() {
    saveNow();
    const restored = loadSnapshotFromStore(KEY_FREE);
    state.mode = 'free';
    state.levelId = null;
    state.running = true;
    state.clockHigh = false;
    state.clockOrigin = 0;
    history = [];
    future = [];
    if (!restored) {
      state.nodes = [];
      state.wires = [];
      state.nextId = 1;
      state.nextWireId = 1;
      state.selected = null;
      state.pending = null;
      state.unstable = false;
      rebuildInputMap();
      simulate();
    }
    saveNow();
    emit();
    return true;
  }

  function newSandbox(opts) {
    opts = opts || {};
    state.mode = 'free';
    state.levelId = null;
    state.nodes = [];
    state.wires = [];
    state.nextId = 1;
    state.nextWireId = 1;
    state.selected = null;
    state.pending = null;
    state.running = true;
    state.clockHigh = false;
    state.clockOrigin = 0;
    state.unstable = false;
    state.camera = { x: 450, y: 250, scale: 1 };
    history = [];
    future = [];
    rebuildInputMap();
    simulate();
    saveNow();
    emit();
  }

  function boot() {
    booted = true;
    settings = Object.assign({ sound: true }, parseJSON(storeGet(KEY_SETTINGS), {}));
    progress = Object.assign({ completed: {} }, parseJSON(storeGet(KEY_PROGRESS), {}));
    const last = parseJSON(storeGet(KEY_LAST), null);
    let loaded = false;
    if (last && last.mode === 'level' && CL.levelById(last.levelId)) {
      loaded = loadSnapshotFromStore(KEY_LEVEL_PREFIX + last.levelId);
      if (loaded) {
        state.mode = 'level';
        state.levelId = last.levelId;
      } else {
        makeLevelSetup(CL.levelById(last.levelId));
        loaded = true;
      }
    } else {
      loaded = loadSnapshotFromStore(KEY_FREE);
      if (loaded) {
        state.mode = 'free';
        state.levelId = null;
      }
    }
    if (!loaded) {
      state.mode = 'free';
      state.levelId = null;
      state.nodes = [];
      state.wires = [];
      rebuildInputMap();
      simulate();
    }
    state.running = true;
    state.clockHigh = false;
    state.clockOrigin = 0;
    state.unstable = false;
    emit();
    return state;
  }

  function tick(now) {
    if (!state.running) return false;
    if (!state.nodes.some((n) => n.type === 'CLK')) return false;
    if (!state.clockOrigin) state.clockOrigin = now;
    const period = 1000 / Math.max(0.25, state.clockSpeed || 1);
    const half = period / 2;
    const phase = Math.floor((now - state.clockOrigin) / half) % 2;
    const high = phase === 1;
    if (high !== state.clockHigh) {
      state.clockHigh = high;
      simulate();
      return true;
    }
    return false;
  }

  function stepClock() {
    state.running = false;
    state.clockHigh = false;
    simulate();
    state.clockHigh = true;
    simulate();
    state.clockHigh = false;
    simulate();
    autosave();
    emit();
    return true;
  }

  function setRunning(value) {
    state.running = !!value;
    state.clockOrigin = 0;
    if (!state.running) {
      state.clockHigh = false;
      simulate();
    }
    autosave();
    emit();
  }

  function setClockSpeed(speed) {
    state.clockSpeed = speed;
    state.clockOrigin = 0;
    autosave();
    emit();
  }

  function enumerateTruthTable() {
    const inputs = state.nodes.filter((n) => n.type === 'IN' && n.name)
      .slice().sort((a, b) => (a.x - b.x) || (a.y - b.y));
    const buses = state.nodes.filter((n) => n.type === 'NIB' && n.name)
      .slice().sort((a, b) => (a.x - b.x) || (a.y - b.y));
    const outputs = state.nodes.filter((n) => (n.type === 'OUT' || n.type === 'HEX') && n.name)
      .slice().sort((a, b) => (a.x - b.x) || (a.y - b.y));
    if (inputs.length > 6) {
      return { tooMany: true, inputs, buses, outputs, rows: [], count: 0 };
    }
    const backup = backupInputs();
    const seqBackup = state.nodes.filter((n) => DEFS[n.type].seq).map((n) => ({
      id: n.id, state: Object.assign({}, n._state), last: n._lastClk
    }));
    const wasRunning = state.running;
    const wasHigh = state.clockHigh;
    state.running = false;
    state.clockHigh = false;
    const total = 1 << inputs.length;
    const rows = [];
    for (let mask = 0; mask < total; mask++) {
      const vals = {};
      inputs.forEach((n, i) => {
        const bit = (mask >> (inputs.length - 1 - i)) & 1;
        n.value = bit;
        vals[n.name] = bit;
      });
      simulate();
      const outVals = {};
      for (const o of outputs) outVals[o.name] = readNamedOutput(o);
      rows.push({ index: mask, inputs: vals, outputs: outVals, busValues: buses.map((b) => [b.name, b.value]) });
    }
    restoreInputs(backup);
    for (const s of seqBackup) {
      const n = nodeById(s.id);
      if (n) { n._state = s.state; n._lastClk = s.last; }
    }
    state.running = wasRunning;
    state.clockHigh = wasHigh;
    simulate();
    let currentIndex = -1;
    for (const row of rows) {
      let same = true;
      for (const n of inputs) if (row.inputs[n.name] !== n.value) { same = false; break; }
      if (same) { currentIndex = row.index; break; }
    }
    return {
      inputs: inputs.map((n) => ({ name: n.name, width: 1 })),
      buses: buses.map((n) => ({ name: n.name, width: 4, value: n.value })),
      outputs: outputs.map((n) => ({ name: n.name, width: n.type === 'HEX' ? 4 : 1 })),
      rows,
      count: total,
      currentIndex,
      tooMany: false,
      unstable: state.unstable
    };
  }

  function backupInputs() {
    const vals = {};
    for (const n of state.nodes) {
      if (n.type === 'IN' || n.type === 'NIB' || n.type === 'CONST') vals[n.id] = n.value;
      if (n._state) vals['s' + n.id] = Object.assign({}, n._state);
    }
    return vals;
  }

  function restoreInputs(backup) {
    for (const n of state.nodes) {
      if (backup[n.id] !== undefined) n.value = backup[n.id];
      if (n._state && backup['s' + n.id]) n._state = Object.assign({}, backup['s' + n.id]);
      n._lastClk = 0;
    }
  }

  function runLevelTests(level) {
    level = level || CL.levelById(state.levelId);
    if (!level) return null;
    const tests = level.tests;
    const inputs = tests.inputs || [];
    const outputs = tests.outputs || [];
    const steps = Array.isArray(tests.sequence) ? tests.sequence : (tests.vectors || []);
    const sequence = Array.isArray(tests.sequence);
    const missingInputs = inputs.filter((name) => !findByPortName(name));
    const missingOutputs = outputs.filter((name) => !findByPortName(name));
    const req = level.requirements || {};
    const missingRequired = [];
    if (req.types) {
      for (const [type, need] of Object.entries(req.types)) {
        const have = state.nodes.filter((n) => n.type === type).length;
        if (have < need) missingRequired.push({ type, need, have });
      }
    }
    const missingUsed = [];
    if (req.usedTypes) {
      for (const type of req.usedTypes) {
        const used = state.nodes.some((n) => n.type === type &&
          state.wires.some((w) => w.from.n === n.id));
        if (!used) missingUsed.push({ type });
      }
    }
    const backup = backupInputs();
    const seqBackup = state.nodes.filter((n) => DEFS[n.type].seq).map((n) => ({
      id: n.id, state: Object.assign({}, n._state), last: n._lastClk
    }));
    const wasRunning = state.running;
    const wasHigh = state.clockHigh;
    state.running = false;
    state.clockHigh = false;
    for (const n of state.nodes) {
      if (DEFS[n.type].seq) {
        n._state = Object.assign({}, DEFS[n.type].initial);
        n._lastClk = 0;
      }
    }
    const failures = [];
    let passed = 0;
    for (let i = 0; i < steps.length; i++) {
      const vec = steps[i];
      for (const name of inputs) {
        const n = findByPortName(name);
        if (n) setNodeValue(n, vec[name] != null ? vec[name] : 0);
      }
      if (sequence && vec.clock !== undefined) state.clockHigh = !!vec.clock;
      simulate();
      const actual = {};
      let ok = true;
      const mismatch = [];
      for (const name of outputs) {
        const n = findByPortName(name);
        const width = n && (n.type === 'HEX' || n.type === 'NIB') ? 4 : 1;
        const val = readNamedOutput(n);
        actual[name] = val;
        const expect = (vec[name] != null ? vec[name] : 0) & (width === 4 ? 15 : 1);
        if (val !== expect) {
          ok = false;
          mismatch.push({ name, expected: expect, actual: val, width });
        }
      }
      if (ok) passed++;
      else failures.push({ index: i, vector: vec, actual, mismatch });
    }
    restoreInputs(backup);
    for (const s of seqBackup) {
      const n = nodeById(s.id);
      if (n) { n._state = s.state; n._lastClk = s.last; }
    }
    state.running = wasRunning;
    state.clockHigh = wasHigh;
    simulate();
    return {
      total: steps.length,
      passed,
      failures,
      missingInputs,
      missingOutputs,
      missingRequired,
      missingUsed,
      sequence,
      unstable: state.unstable,
      ok: failures.length === 0 && missingInputs.length === 0 && missingOutputs.length === 0 &&
        missingRequired.length === 0 && missingUsed.length === 0
    };
  }

  function structuralReport() {
    const floating = [];
    for (const n of state.nodes) {
      const d = defOf(n);
      for (const p of d.inputs) {
        if (!inputWire(n.id, p.id)) floating.push({ node: n, port: p.id, width: p.width });
      }
    }
    const orphans = [];
    for (const n of state.nodes) {
      const d = defOf(n);
      if (!d.outputs.length) continue;
      const used = state.wires.some((w) => w.from.n === n.id);
      if (!used) orphans.push({ node: n });
    }
    return { floating, orphans, unstable: state.unstable };
  }

  function getProgress() { return progress; }
  function isCompleted(id) { return !!(progress.completed && progress.completed[id]); }
  function markComplete(id, stats) {
    if (!progress.completed) progress.completed = {};
    const prev = progress.completed[id] || {};
    progress.completed[id] = {
      at: Date.now(),
      gates: Math.min(prev.gates || 999, stats && stats.gates != null ? stats.gates : 999),
      wires: Math.min(prev.wires || 999, stats && stats.wires != null ? stats.wires : 999)
    };
    try { storeSet(KEY_PROGRESS, JSON.stringify(progress)); } catch (e) { /* ignore */ }
  }

  function resetProgress() {
    progress = { completed: {} };
    storeSet(KEY_PROGRESS, JSON.stringify(progress));
  }

  function getSettings() { return settings; }
  function setSetting(key, val) {
    settings[key] = val;
    storeSet(KEY_SETTINGS, JSON.stringify(settings));
  }

  function getStats() {
    return {
      nodes: state.nodes.length,
      wires: state.wires.length,
      gates: state.nodes.filter((n) => DEFS[n.type].family === 'logic' || n.type === 'ADD4').length,
      inputs: state.nodes.filter((n) => n.type === 'IN' || n.type === 'NIB').length,
      outputs: state.nodes.filter((n) => n.type === 'OUT' || n.type === 'HEX').length
    };
  }

  function clearCurrent() {
    if (state.mode === 'level') {
      const level = CL.levelById(state.levelId);
      if (level) {
        remember();
        makeLevelSetup(level);
        autosave();
        emit();
        return true;
      }
    }
    remember();
    state.nodes = state.nodes.filter((n) => n.locked);
    const ids = new Set(state.nodes.map((n) => n.id));
    state.wires = state.wires.filter((w) => ids.has(w.from.n) && ids.has(w.to.n));
    state.selected = null;
    state.pending = null;
    rebuildInputMap();
    simulate();
    autosave();
    emit();
    return true;
  }

  function setSelected(sel) {
    state.selected = sel || null;
    emit();
  }

  function setTool(tool) {
    state.tool = tool;
    state.pending = null;
    emit();
  }

  function disconnectInput(nodeId, port) {
    const w = inputWire(nodeId, port);
    if (w) return removeWire(w.id);
    return false;
  }

  CL.Engine = {
    state,
    boot,
    nodeById,
    wireById,
    defOf,
    inputWire,
    readInput,
    readNamedOutput,
    findByPortName,
    outputWidthForName,
    addNode,
    removeNode,
    removeWire,
    connect,
    setInput,
    setNodeValueById,
    toggleNode,
    toggleNodeBit,
    moveNode,
    undo,
    redo,
    canUndo: () => history.length > 0,
    canRedo: () => future.length > 0,
    simulate,
    tick,
    stepClock,
    setRunning,
    setClockSpeed,
    enumerateTruthTable,
    runLevelTests,
    structuralReport,
    loadLevel,
    openFree,
    newSandbox,
    fitCamera,
    saveNow,
    autosave,
    getProgress,
    isCompleted,
    markComplete,
    resetProgress,
    getSettings,
    setSetting,
    getStats,
    clearCurrent,
    setSelected,
    setTool,
    disconnectInput,
    refresh: () => { rebuildInputMap(); simulate(); emit(); },
    setChangeHandler: (fn) => { changeHandler = fn; },
    snapshot,
    readInputByName,
    remember,
    emit,
    saveNow
  };
})();
