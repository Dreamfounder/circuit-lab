/* Circuit Lab — component definitions and shared helpers.
   Plain script (no modules) so it can run from file:///android_asset. */
(function () {
  'use strict';

  const CL = (window.CL = window.CL || {});

  const FAMILIES = {
    source: { label: '信号源', color: '#42efb0', soft: 'rgba(66,239,176,.16)' },
    logic: { label: '逻辑门', color: '#55c9ff', soft: 'rgba(85,201,255,.15)' },
    data: { label: '数据通路', color: '#ffc857', soft: 'rgba(255,200,87,.15)' },
    seq: { label: '时序', color: '#c18bff', soft: 'rgba(193,139,255,.15)' },
    out: { label: '输出', color: '#ff7e9f', soft: 'rgba(255,126,159,.15)' }
  };

  const gate = (key, label, en, fn, hint) => ({
    key, label, en, family: 'logic', w: 124, minH: 108,
    inputs: [{ id: 'A', label: 'A', width: 1 }, { id: 'B', label: 'B', width: 1 }],
    outputs: [{ id: 'Y', label: 'Y', width: 1 }],
    comb: fn, hint: hint || label + ' 门'
  });

  const DEFS = {
    IN: {
      key: 'IN', label: '开关', en: 'INPUT', family: 'source', w: 138, minH: 86,
      inputs: [], outputs: [{ id: 'Y', label: 'Q', width: 1 }],
      interactive: 'toggle',
      comb: (i, n) => ({ Y: n.value ? 1 : 0 }),
      hint: '点击开关，在 0 和 1 之间切换'
    },
    CONST: {
      key: 'CONST', label: '常量', en: 'CONST', family: 'source', w: 116, minH: 86,
      inputs: [], outputs: [{ id: 'Y', label: 'Q', width: 1 }],
      interactive: 'toggle',
      comb: (i, n) => ({ Y: n.value ? 1 : 0 }),
      hint: '点击切换常量 0 / 1'
    },
    NIB: {
      key: 'NIB', label: '4 位输入', en: '4-BIT IN', family: 'source', w: 158, minH: 116,
      inputs: [], outputs: [{ id: 'Y', label: 'Q', width: 4 }],
      interactive: 'nibble',
      comb: (i, n) => ({ Y: (n.value | 0) & 15 }),
      hint: '四个位开关组成一个 4 位数值'
    },
    CLK: {
      key: 'CLK', label: '时钟', en: 'CLOCK', family: 'source', w: 132, minH: 94,
      inputs: [], outputs: [{ id: 'Y', label: 'CLK', width: 1 }],
      comb: (i, n, s) => ({ Y: s.clockHigh ? 1 : 0 }),
      hint: '自动在 0 / 1 之间跳变；按暂停或单步可观察触发器'
    },
    AND: gate('AND', '与门', 'AND', (i) => ({ Y: (i.A & i.B) ? 1 : 0 })),
    OR: gate('OR', '或门', 'OR', (i) => ({ Y: (i.A | i.B) ? 1 : 0 })),
    NOT: {
      key: 'NOT', label: '非门', en: 'NOT', family: 'logic', w: 110, minH: 104,
      inputs: [{ id: 'A', label: 'A', width: 1 }],
      outputs: [{ id: 'Y', label: 'Y', width: 1 }],
      comb: (i) => ({ Y: i.A ? 0 : 1 }),
      hint: '输出与输入相反'
    },
    NAND: gate('NAND', '与非门', 'NAND', (i) => ({ Y: (i.A & i.B) ? 0 : 1 })),
    NOR: gate('NOR', '或非门', 'NOR', (i) => ({ Y: (i.A | i.B) ? 0 : 1 })),
    XOR: gate('XOR', '异或门', 'XOR', (i) => ({ Y: i.A !== i.B ? 1 : 0 })),
    XNOR: gate('XNOR', '同或门', 'XNOR', (i) => ({ Y: i.A === i.B ? 1 : 0 })),
    SPLIT: {
      key: 'SPLIT', label: '分线器', en: 'SPLIT', family: 'data', w: 148, minH: 140,
      inputs: [{ id: 'D', label: 'D', width: 4 }],
      outputs: [
        { id: 'b3', label: '8', width: 1 },
        { id: 'b2', label: '4', width: 1 },
        { id: 'b1', label: '2', width: 1 },
        { id: 'b0', label: '1', width: 1 }
      ],
      comb: (i) => {
        const d = i.D | 0;
        return { b3: (d >> 3) & 1, b2: (d >> 2) & 1, b1: (d >> 1) & 1, b0: d & 1 };
      },
      hint: '把 4 位总线拆成 4 根 1 位线；右侧从上到下是 8、4、2、1'
    },
    MERGE: {
      key: 'MERGE', label: '合线器', en: 'MERGE', family: 'data', w: 148, minH: 140,
      inputs: [
        { id: 'b3', label: '8', width: 1 },
        { id: 'b2', label: '4', width: 1 },
        { id: 'b1', label: '2', width: 1 },
        { id: 'b0', label: '1', width: 1 }
      ],
      outputs: [{ id: 'Y', label: 'D', width: 4 }],
      comb: (i) => ({ Y: ((i.b3 & 1) << 3) | ((i.b2 & 1) << 2) | ((i.b1 & 1) << 1) | (i.b0 & 1) }),
      hint: '把 4 根 1 位线按权重合成一条 4 位总线'
    },
    MUX2: {
      key: 'MUX2', label: '二选一', en: 'MUX 2:1', family: 'data', w: 126, minH: 110,
      inputs: [
        { id: 'A', label: 'A', width: 1 },
        { id: 'B', label: 'B', width: 1 },
        { id: 'S', label: 'S', width: 1 }
      ],
      outputs: [{ id: 'Y', label: 'Y', width: 1 }],
      comb: (i) => ({ Y: i.S ? (i.B & 1) : (i.A & 1) }),
      hint: 'S = 0 选择 A，S = 1 选择 B'
    },
    ADD4: {
      key: 'ADD4', label: '4 位加法器', en: 'ADD 4', family: 'data', w: 174, minH: 110,
      inputs: [
        { id: 'A', label: 'A', width: 4 },
        { id: 'B', label: 'B', width: 4 },
        { id: 'Ci', label: 'Ci', width: 1 }
      ],
      outputs: [
        { id: 'S', label: 'S', width: 4 },
        { id: 'Co', label: 'Co', width: 1 }
      ],
      comb: (i) => {
        const t = (i.A & 15) + (i.B & 15) + (i.Ci & 1);
        return { S: t & 15, Co: (t >> 4) & 1 };
      },
      hint: 'S = A + B + Ci（4 位截断），Co 是进位'
    },
    DFF: {
      key: 'DFF', label: 'D 触发器', en: 'D FLIP-FLOP', family: 'seq', w: 136, minH: 110,
      inputs: [
        { id: 'D', label: 'D', width: 1 },
        { id: 'CLK', label: 'CLK', width: 1 }
      ],
      outputs: [
        { id: 'Q', label: 'Q', width: 1 },
        { id: 'QN', label: '¬Q', width: 1 }
      ],
      seq: true,
      initial: { Q: 0 },
      comb: (i, n) => ({ Q: n._state.Q ? 1 : 0, QN: n._state.Q ? 0 : 1 }),
      hint: '时钟上升沿把 D 的值锁存到 Q'
    },
    REG4: {
      key: 'REG4', label: '4 位寄存器', en: 'REG 4', family: 'seq', w: 158, minH: 110,
      inputs: [
        { id: 'D', label: 'D', width: 4 },
        { id: 'CLK', label: 'CLK', width: 1 },
        { id: 'EN', label: 'EN', width: 1 }
      ],
      outputs: [{ id: 'Q', label: 'Q', width: 4 }],
      seq: true,
      initial: { Q: 0 },
      comb: (i, n) => ({ Q: (n._state.Q | 0) & 15 }),
      hint: 'EN = 1 时，时钟上升沿锁存 4 位 D'
    },
    OUT: {
      key: 'OUT', label: '指示灯', en: 'OUTPUT', family: 'out', w: 116, minH: 96,
      inputs: [{ id: 'X', label: 'IN', width: 1 }],
      outputs: [],
      display: true,
      hint: '接上信号后，灯亮代表 1'
    },
    HEX: {
      key: 'HEX', label: '数码管', en: 'HEX DISPLAY', family: 'out', w: 146, minH: 160,
      inputs: [{ id: 'D', label: 'D', width: 4 }],
      outputs: [],
      display: true,
      hint: '用十六进制显示 4 位数值'
    }
  };

  const PALETTE = [
    { section: '信号源', keys: ['IN', 'NIB', 'CONST', 'CLK'] },
    { section: '逻辑门', keys: ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR'] },
    { section: '数据通路', keys: ['SPLIT', 'MERGE', 'MUX2', 'ADD4'] },
    { section: '时序', keys: ['DFF', 'REG4'] },
    { section: '输出', keys: ['OUT', 'HEX'] }
  ];

  const NODE_WIDTH = (node) => DEFS[node.type].w;
  const nodePortCount = (node) => {
    const d = DEFS[node.type];
    return Math.max(d.inputs.length, d.outputs.length, 1);
  };
  const nodeHeight = (node) => {
    const d = DEFS[node.type];
    return Math.max(d.minH || 86, 44 + (nodePortCount(node) - 1) * 24 + 18);
  };
  const portY = (node, index, count) => {
    const h = nodeHeight(node);
    const n = Math.max(count, 1);
    return node.y + 34 + (h - 34 - (n - 1) * 24) / 2 + index * 24;
  };
  const inputPortPos = (node, index) => ({
    x: node.x,
    y: portY(node, index, DEFS[node.type].inputs.length)
  });
  const outputPortPos = (node, index) => ({
    x: node.x + NODE_WIDTH(node),
    y: portY(node, index, DEFS[node.type].outputs.length)
  });
  const hex = (v, width) => {
    if (width === 4) return (v & 15).toString(16).toUpperCase();
    return (v & 1) ? '1' : '0';
  };
  const valueText = (v, width) => width === 4 ? (v & 15).toString(16).toUpperCase() : ((v & 1) ? '1' : '0');

  CL.FAMILIES = FAMILIES;
  CL.DEFS = DEFS;
  CL.PALETTE = PALETTE;
  CL.NODE_WIDTH = NODE_WIDTH;
  CL.nodeHeight = nodeHeight;
  CL.nodePortCount = nodePortCount;
  CL.portY = portY;
  CL.inputPortPos = inputPortPos;
  CL.outputPortPos = outputPortPos;
  CL.hex = hex;
  CL.valueText = valueText;
  CL.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  CL.uid = (() => {
    let n = 0;
    return (prefix) => prefix + (++n).toString(36) + Math.random().toString(36).slice(2, 6);
  })();
})();
