/* Circuit Lab — 19 teaching levels. Each level has locked I/O nodes, a vector
   table (or a clock sequence), and a detailed lesson rendered by the UI. */
(function () {
  'use strict';
  const CL = (window.CL = window.CL || {});

  const LEVELS = [
    {
      id: 'first-light', num: '01', group: '基础', title: '第一束光', en: 'FIRST LIGHT',
      difficulty: 1, tag: '电平',
      objective: '把开关 A 接到灯 Y。拨动 A，灯应该同步亮灭。',
      tip: '从 A 右侧的圆点按住，拖到 Y 左侧的圆点；也可以先点 A 的端口，再点 Y 的端口。',
      concept: '数字电路只关心两种状态：0 和 1。导线只是把同一个电平送到别处。',
      allowed: [],
      setup: [
        { type: 'IN', name: 'A', x: 260, y: 220, value: 0, locked: true },
        { type: 'OUT', name: 'Y', x: 570, y: 220, locked: true }
      ],
      tests: { inputs: ['A'], outputs: ['Y'], vectors: [{ A: 0, Y: 0 }, { A: 1, Y: 1 }] },
      lesson: {
        component: 'OUT',
        why: '数字电路把电压简化成两个符号：低电平是 0，高电平是 1。开关是输入，灯是输出；导线不做运算，只负责传递同一个比特。',
        formula: 'Y = A',
        steps: ['观察画布上的 A 和 Y：它们已经放好，不能删除。', '从 A 右侧圆点拖到 Y 左侧圆点。', '点击 A 的开关，切换 0 / 1。', '看底部监视条和线上的颜色是否同步。'],
        mistakes: ['把线接到元件的本体而不是端口圆点。', '只把 A 接了一半，Y 的输入仍然悬空；悬空按 0 处理，灯不会亮。']
      }
    },
    {
      id: 'and-gate', num: '02', group: '逻辑门', title: '同时满足', en: 'AND GATE',
      difficulty: 1, tag: '与门',
      objective: '让灯 Y 只在 A、B 都为 1 时亮。用一枚 AND 门。',
      tip: '把 A 和 B 分别接到 AND 的两个输入，再把 AND 的输出接到 Y。',
      concept: 'AND = 乘法。只有 1 × 1 = 1，其余情况都是 0。',
      allowed: ['AND'],
      setup: [
        { type: 'IN', name: 'A', x: 160, y: 170, value: 0, locked: true },
        { type: 'IN', name: 'B', x: 160, y: 330, value: 0, locked: true },
        { type: 'OUT', name: 'Y', x: 760, y: 250, locked: true }
      ],
      tests: {
        inputs: ['A', 'B'], outputs: ['Y'],
        vectors: [{ A: 0, B: 0, Y: 0 }, { A: 0, B: 1, Y: 0 }, { A: 1, B: 0, Y: 0 }, { A: 1, B: 1, Y: 1 }]
      },
      lesson: {
        symbol: 'AND',
        why: '把 AND 想成两个串联的开关：电流必须经过 A 和 B 两个开关，任何一个断开，灯就灭。',
        formula: 'Y = A · B',
        steps: ['从元件库拖出 AND 门。', 'A → AND 的输入 A，B → AND 的输入 B。', 'AND 的输出 Y → 灯 Y 的输入。', '依次尝试 00、01、10、11 四种输入。'],
        mistakes: ['只接了一个输入，另一个悬空按 0，灯永远不亮。', '把 A 和 B 接到同一个输入，AND 就变成了缓冲器。']
      }
    },
    {
      id: 'or-gate', num: '03', group: '逻辑门', title: '任意一个', en: 'OR GATE',
      difficulty: 1, tag: '或门',
      objective: '让灯 Y 在 A 或 B 至少一个为 1 时亮。用一枚 OR 门。',
      tip: 'OR 的输出只有在 A=0 且 B=0 时才为 0；其余三种情况都是 1。',
      concept: 'OR = 加法（布尔或）。它对应两个并联的开关。',
      allowed: ['OR'],
      setup: [
        { type: 'IN', name: 'A', x: 160, y: 170, value: 0, locked: true },
        { type: 'IN', name: 'B', x: 160, y: 330, value: 0, locked: true },
        { type: 'OUT', name: 'Y', x: 760, y: 250, locked: true }
      ],
      tests: {
        inputs: ['A', 'B'], outputs: ['Y'],
        vectors: [{ A: 0, B: 0, Y: 0 }, { A: 0, B: 1, Y: 1 }, { A: 1, B: 0, Y: 1 }, { A: 1, B: 1, Y: 1 }]
      },
      lesson: {
        symbol: 'OR',
        why: 'OR 像两个并联的开关：只要有一条支路接通，灯就亮。它回答“是否至少有一个为 1”。',
        formula: 'Y = A + B',
        steps: ['从元件库拖出 OR 门。', 'A → OR.A，B → OR.B。', 'OR.Y → 灯 Y。', '验证只有 00 时灯灭。'],
        mistakes: ['把“或”理解成二选一；OR 在两个输入都为 1 时仍然输出 1。', 'OR 与 XOR 混淆：XOR 在两个都为 1 时输出 0。']
      }
    },
    {
      id: 'not-gate', num: '04', group: '逻辑门', title: '反过来', en: 'NOT GATE',
      difficulty: 1, tag: '非门',
      objective: '让灯 Y 的状态始终与 A 相反。用一枚 NOT 门。',
      tip: 'NOT 门只有一个输入；三角形输出端的小圆圈表示反相。',
      concept: '反相器是所有逻辑运算的基础，也常用来做信号极性转换。',
      allowed: ['NOT'],
      setup: [
        { type: 'IN', name: 'A', x: 230, y: 250, value: 0, locked: true },
        { type: 'OUT', name: 'Y', x: 690, y: 250, locked: true }
      ],
      tests: { inputs: ['A'], outputs: ['Y'], vectors: [{ A: 0, Y: 1 }, { A: 1, Y: 0 }] },
      lesson: {
        symbol: 'NOT',
        why: '反相器把 0 变成 1，把 1 变成 0。标准符号是三角形加一个输出反相泡。',
        formula: 'Y = ¬A',
        steps: ['拖出 NOT 门。', 'A → NOT.A。', 'NOT.Y → 灯 Y。', '切换 A，观察灯总是相反。'],
        mistakes: ['把 NOT 当成缓冲器；它的输出与输入相反。', '给 NOT 接两个输入；它只有一个输入。']
      }
    },
    {
      id: 'nand-gate', num: '05', group: '逻辑门', title: '先与后非', en: 'NAND GATE',
      difficulty: 2, tag: '与非门',
      objective: '实现 Y = NOT(A AND B)：只有 A、B 都为 1 时输出 0。',
      tip: 'NAND 的符号是 AND 的输出端加一个反相泡。',
      concept: 'NAND 是“万能门”：只用 NAND 就能搭出 NOT、AND、OR 等所有逻辑。',
      allowed: ['NAND'],
      setup: [
        { type: 'IN', name: 'A', x: 160, y: 170, value: 0, locked: true },
        { type: 'IN', name: 'B', x: 160, y: 330, value: 0, locked: true },
        { type: 'OUT', name: 'Y', x: 760, y: 250, locked: true }
      ],
      tests: {
        inputs: ['A', 'B'], outputs: ['Y'],
        vectors: [{ A: 0, B: 0, Y: 1 }, { A: 0, B: 1, Y: 1 }, { A: 1, B: 0, Y: 1 }, { A: 1, B: 1, Y: 0 }]
      },
      lesson: {
        symbol: 'NAND',
        why: 'NAND 等于 AND 的输出再取反。它在芯片里非常常用，因为用 NAND 可以构造任何其他逻辑门。',
        formula: 'Y = ¬(A · B)',
        steps: ['拖出 NAND 门。', '接好 A、B 和输出 Y。', '先试 11，应该只有这一组输出 0。', '用单步验证四组输入。'],
        mistakes: ['把 NAND 当成 AND，忘了最后一步取反。', '输入悬空按 0，导致输出一直是 1。']
      }
    },
    {
      id: 'nor-gate', num: '06', group: '逻辑门', title: '先或后非', en: 'NOR GATE',
      difficulty: 2, tag: '或非门',
      objective: '实现 Y = NOT(A OR B)：只有 A、B 都为 0 时输出 1。',
      tip: 'NOR 的符号是 OR 的输出端加一个反相泡。',
      concept: 'NOR 同样是万能门；两个 NOR 交叉反馈可以构成 SR 锁存器。',
      allowed: ['NOR'],
      setup: [
        { type: 'IN', name: 'A', x: 160, y: 170, value: 0, locked: true },
        { type: 'IN', name: 'B', x: 160, y: 330, value: 0, locked: true },
        { type: 'OUT', name: 'Y', x: 760, y: 250, locked: true }
      ],
      tests: {
        inputs: ['A', 'B'], outputs: ['Y'],
        vectors: [{ A: 0, B: 0, Y: 1 }, { A: 0, B: 1, Y: 0 }, { A: 1, B: 0, Y: 0 }, { A: 1, B: 1, Y: 0 }]
      },
      lesson: {
        symbol: 'NOR',
        why: 'NOR 是 OR 之后再取反。它的输出只在“全 0”时为 1，这种“所有输入都无效”的判断很适合做使能或复位。',
        formula: 'Y = ¬(A + B)',
        steps: ['拖出 NOR 门。', '接好 A、B 和输出 Y。', '确认只有 00 输出 1。', '把它和 NAND 的真值表并排比较。'],
        mistakes: ['只接一个输入时，另一个按 0，输出可能仍然为 0。', '把 NOR 和 OR 的输出端反相泡忽略掉。']
      }
    },
    {
      id: 'xor-built', num: '07', group: '逻辑门', title: '不同才亮', en: 'XOR FROM SCRATCH',
      difficulty: 2, tag: '组合',
      objective: '不借助 XOR 门，只用 AND / OR / NOT 搭出异或：A、B 不同时 Y 为 1。',
      tip: '提示：A ⊕ B = (A OR B) AND NOT(A AND B)。先算两个中间结果，再合并。',
      concept: '任何逻辑函数都可以用 AND、OR、NOT 组合出来，这叫逻辑完备性。',
      allowed: ['AND', 'OR', 'NOT'],
      covers: ['XOR'],
      setup: [
        { type: 'IN', name: 'A', x: 150, y: 170, value: 0, locked: true },
        { type: 'IN', name: 'B', x: 150, y: 330, value: 0, locked: true },
        { type: 'OUT', name: 'Y', x: 760, y: 250, locked: true }
      ],
      tests: {
        inputs: ['A', 'B'], outputs: ['Y'],
        vectors: [{ A: 0, B: 0, Y: 0 }, { A: 0, B: 1, Y: 1 }, { A: 1, B: 0, Y: 1 }, { A: 1, B: 1, Y: 0 }]
      },
      lesson: {
        symbol: 'XOR',
        why: '异或判断两个输入是否不同。它不是基本门，可以用 OR、AND、NOT 组合实现；这正是“逻辑函数可以由基本门构造”的例子。',
        formula: 'A ⊕ B = (A + B) · ¬(A · B)',
        steps: ['先放一个 OR 得到 A+B。', '再放一个 NAND（或 AND 加 NOT）得到 ¬(A·B)。', '把这两个中间结果接到 AND。', '最后接到 Y，验证 00/11 输出 0、01/10 输出 1。'],
        mistakes: ['直接把 A、B 各接一条线到输出，导致线与。', '把中间结果接到了输出，而不是继续参与下一级逻辑。']
      }
    },
    {
      id: 'xnor-gate', num: '08', group: '逻辑门', title: '相同才亮', en: 'XNOR GATE',
      difficulty: 2, tag: '同或门',
      objective: '用 XNOR 门实现“相等检测”：A、B 相同时 Y=1。',
      tip: 'XNOR 是 XOR 的反相；符号在 XOR 的双弧线基础上，输出端多一个反相泡。',
      concept: 'XNOR 可以用来比较两个比特是否相等，是多位比较器的基本单元。',
      allowed: ['XNOR'],
      setup: [
        { type: 'IN', name: 'A', x: 160, y: 170, value: 0, locked: true },
        { type: 'IN', name: 'B', x: 160, y: 330, value: 0, locked: true },
        { type: 'OUT', name: 'Y', x: 760, y: 250, locked: true }
      ],
      tests: {
        inputs: ['A', 'B'], outputs: ['Y'],
        vectors: [{ A: 0, B: 0, Y: 1 }, { A: 0, B: 1, Y: 0 }, { A: 1, B: 0, Y: 0 }, { A: 1, B: 1, Y: 1 }]
      },
      lesson: {
        symbol: 'XNOR',
        why: 'XNOR 与 XOR 相反：不同为 0，相同为 1。它可以直接判断两个输入是否相等。',
        formula: 'Y = ¬(A ⊕ B)',
        steps: ['拖出 XNOR 门。', '接好 A、B 和输出 Y。', '验证 00 和 11 输出 1。', '思考：两个 4 位输入如何用 4 个 XNOR 比较？'],
        mistakes: ['和 XOR 混淆：XOR 是“不同才亮”。', '忘记 XNOR 输出端的反相泡。']
      }
    },
    {
      id: 'half-adder', num: '09', group: '组合逻辑', title: '半加器', en: 'HALF ADDER',
      difficulty: 2, tag: '加法',
      objective: '输入 A、B，输出本位和 S 与进位 C。完成 1 位二进制加法。',
      tip: 'S 是 A、B 的异或；C 是 A、B 的与。',
      concept: '半加器只处理两个加数，不能接收低位进位，所以叫“半”。',
      allowed: ['AND', 'OR', 'NOT', 'XOR'],
      setup: [
        { type: 'IN', name: 'A', x: 140, y: 170, value: 0, locked: true },
        { type: 'IN', name: 'B', x: 140, y: 330, value: 0, locked: true },
        { type: 'OUT', name: 'S', x: 790, y: 170, locked: true },
        { type: 'OUT', name: 'C', x: 790, y: 330, locked: true }
      ],
      tests: {
        inputs: ['A', 'B'], outputs: ['S', 'C'],
        vectors: [{ A: 0, B: 0, S: 0, C: 0 }, { A: 0, B: 1, S: 1, C: 0 }, { A: 1, B: 0, S: 1, C: 0 }, { A: 1, B: 1, S: 0, C: 1 }]
      },
      lesson: {
        symbol: 'XOR',
        why: '1 位二进制加法会产生“本位和”和“进位”两个结果。两个 1 相加等于二进制的 10，所以 S=0、C=1。',
        formula: 'S = A ⊕ B；C = A · B',
        steps: ['放一个 XOR，输出接 S。', '放一个 AND，输出接 C。', '两个门共享 A、B 输入。', '逐组检查 0+0、0+1、1+0、1+1。'],
        mistakes: ['把 S 和 C 接反。', '只接一个门，忘了另一个输出。']
      }
    },
    {
      id: 'full-adder', num: '10', group: '组合逻辑', title: '全加器', en: 'FULL ADDER',
      difficulty: 3, tag: '加法',
      objective: '输入 A、B 和进位 Cin，输出和 S、进位 Cout。八种组合全部正确。',
      tip: '可以先做两个半加器：S1=A⊕B，C1=A AND B；S=S1⊕Cin，C2=S1 AND Cin；Cout=C1 OR C2。',
      concept: '全加器能级联：低位的 Cout 接高位 Cin，就得到多位加法器。',
      allowed: ['AND', 'OR', 'NOT', 'XOR'],
      setup: [
        { type: 'IN', name: 'A', x: 120, y: 110, value: 0, locked: true },
        { type: 'IN', name: 'B', x: 120, y: 225, value: 0, locked: true },
        { type: 'IN', name: 'Cin', x: 120, y: 340, value: 0, locked: true },
        { type: 'OUT', name: 'S', x: 810, y: 150, locked: true },
        { type: 'OUT', name: 'Cout', x: 810, y: 340, locked: true }
      ],
      tests: {
        inputs: ['A', 'B', 'Cin'], outputs: ['S', 'Cout'],
        vectors: [
          { A: 0, B: 0, Cin: 0, S: 0, Cout: 0 }, { A: 0, B: 0, Cin: 1, S: 1, Cout: 0 },
          { A: 0, B: 1, Cin: 0, S: 1, Cout: 0 }, { A: 0, B: 1, Cin: 1, S: 0, Cout: 1 },
          { A: 1, B: 0, Cin: 0, S: 1, Cout: 0 }, { A: 1, B: 0, Cin: 1, S: 0, Cout: 1 },
          { A: 1, B: 1, Cin: 0, S: 0, Cout: 1 }, { A: 1, B: 1, Cin: 1, S: 1, Cout: 1 }
        ]
      },
      lesson: {
        symbol: 'XOR',
        why: '全加器把“两个加数”和“低位进位”一起相加。它就是半加器再加一个半加器，并把两个进位合并。',
        formula: 'S = (A ⊕ B) ⊕ Cin；Cout = (A·B) + ((A⊕B)·Cin)',
        steps: ['第一个 XOR 得到 A⊕B。', '第一个 AND 得到 A·B。', '第二个 XOR 把 A⊕B 与 Cin 相加，得到 S。', '第二个 AND 得到 (A⊕B)·Cin。', 'OR 合并两个进位，接到 Cout。'],
        mistakes: ['只算两个加数，漏掉 Cin。', '进位合并用了 AND；两个进位任意一个为 1 都应进位。']
      }
    },
    {
      id: 'decoder-24', num: '11', group: '组合逻辑', title: '二四译码器', en: '2-TO-4 DECODER',
      difficulty: 3, tag: '译码',
      objective: '两位输入 A1A0 选中四盏灯中的一盏：00→Y0，01→Y1，10→Y2，11→Y3。',
      tip: '每个输出对应一个最小项。例如 Y2 对应 A1 AND NOT A0。',
      concept: '译码器把二进制编码翻译成“哪一根线有效”，是寄存器堆和指令译码的基础。',
      allowed: ['NOT', 'AND'],
      setup: [
        { type: 'IN', name: 'A1', x: 130, y: 170, value: 0, locked: true },
        { type: 'IN', name: 'A0', x: 130, y: 320, value: 0, locked: true },
        { type: 'OUT', name: 'Y0', x: 830, y: 80, locked: true },
        { type: 'OUT', name: 'Y1', x: 830, y: 205, locked: true },
        { type: 'OUT', name: 'Y2', x: 830, y: 330, locked: true },
        { type: 'OUT', name: 'Y3', x: 830, y: 455, locked: true }
      ],
      tests: {
        inputs: ['A1', 'A0'], outputs: ['Y0', 'Y1', 'Y2', 'Y3'],
        vectors: [
          { A1: 0, A0: 0, Y0: 1, Y1: 0, Y2: 0, Y3: 0 },
          { A1: 0, A0: 1, Y0: 0, Y1: 1, Y2: 0, Y3: 0 },
          { A1: 1, A0: 0, Y0: 0, Y1: 0, Y2: 1, Y3: 0 },
          { A1: 1, A0: 1, Y0: 0, Y1: 0, Y2: 0, Y3: 1 }
        ]
      },
      lesson: {
        component: 'AND',
        why: '译码器把 n 位编码变成 2^n 根“独热”输出线：任意时刻恰好一根为 1。CPU 用它选择寄存器或指令。',
        formula: 'Y0=¬A1·¬A0；Y1=¬A1·A0；Y2=A1·¬A0；Y3=A1·A0',
        steps: ['先做两个 NOT，得到 ¬A1、¬A0。', '每个 AND 组合一个“原变量或反变量”。', '四个 AND 的输出分别接 Y0~Y3。', '验证任意一组输入只有一盏灯亮。'],
        mistakes: ['四个输出都接同一个 AND。', 'Y2 和 Y3 的 A0 极性写反。']
      }
    },
    {
      id: 'mux-21', num: '12', group: '组合逻辑', title: '二选一（门电路）', en: 'MUX FROM GATES',
      difficulty: 2, tag: '选择',
      objective: 'S=0 时 Y 跟着 A，S=1 时 Y 跟着 B。用 AND / OR / NOT 自己搭。',
      tip: 'Y = (A AND NOT S) OR (B AND S)。选择信号像铁路道岔。',
      concept: '多路选择器让数据根据控制信号走不同路径，是 CPU 数据通路的“路由”。',
      allowed: ['NOT', 'AND', 'OR'],
      setup: [
        { type: 'IN', name: 'A', x: 130, y: 150, value: 0, locked: true },
        { type: 'IN', name: 'B', x: 130, y: 290, value: 0, locked: true },
        { type: 'IN', name: 'S', x: 130, y: 430, value: 0, locked: true },
        { type: 'OUT', name: 'Y', x: 820, y: 280, locked: true }
      ],
      tests: {
        inputs: ['A', 'B', 'S'], outputs: ['Y'],
        vectors: [
          { A: 0, B: 0, S: 0, Y: 0 }, { A: 0, B: 1, S: 0, Y: 0 }, { A: 1, B: 0, S: 0, Y: 1 }, { A: 1, B: 1, S: 0, Y: 1 },
          { A: 0, B: 0, S: 1, Y: 0 }, { A: 0, B: 1, S: 1, Y: 1 }, { A: 1, B: 0, S: 1, Y: 0 }, { A: 1, B: 1, S: 1, Y: 1 }
        ]
      },
      lesson: {
        component: 'MUX2',
        why: '二选一像铁路道岔：S 控制数据走 A 还是走 B。它的标准表达式把“选择条件”和“数据”相乘。',
        formula: 'Y = (A · ¬S) + (B · S)',
        steps: ['放 NOT 得到 ¬S。', 'A AND ¬S 得到第一条支路。', 'B AND S 得到第二条支路。', '两条支路 OR 起来接到 Y。', '固定 S=0/1，分别检查 A 和 B 是否被选中。'],
        mistakes: ['把 A 和 B 的支路接反。', '用 OR 合并两个数据而没有加上选择条件。']
      }
    },
    {
      id: 'mux2-component', num: '13', group: '组合逻辑', title: '二选一（MUX 元件）', en: 'MUX 2:1 COMPONENT',
      difficulty: 1, tag: '选择',
      objective: '直接使用 MUX2 元件完成二选一：S=0 选 A，S=1 选 B。',
      tip: '上一关是门电路搭法；这一关认识封装好的数据通路元件。',
      concept: '真实 CPU 不会用离散门逐个搭 MUX，而是使用封装好的多路选择器；理解内部结构仍然重要。',
      allowed: ['MUX2'],
      setup: [
        { type: 'IN', name: 'A', x: 130, y: 150, value: 0, locked: true },
        { type: 'IN', name: 'B', x: 130, y: 290, value: 0, locked: true },
        { type: 'IN', name: 'S', x: 130, y: 430, value: 0, locked: true },
        { type: 'OUT', name: 'Y', x: 820, y: 280, locked: true }
      ],
      tests: {
        inputs: ['A', 'B', 'S'], outputs: ['Y'],
        vectors: [
          { A: 0, B: 0, S: 0, Y: 0 }, { A: 0, B: 1, S: 0, Y: 0 }, { A: 1, B: 0, S: 0, Y: 1 }, { A: 1, B: 1, S: 0, Y: 1 },
          { A: 0, B: 0, S: 1, Y: 0 }, { A: 0, B: 1, S: 1, Y: 1 }, { A: 1, B: 0, S: 1, Y: 0 }, { A: 1, B: 1, S: 1, Y: 1 }
        ]
      },
      lesson: {
        component: 'MUX2',
        why: 'MUX2 把上一关的四个门封装成一个可复用元件。它的三个输入是 A、B、S；输出 Y 由 S 选择。',
        formula: 'S ? Y=B : Y=A',
        steps: ['拖出 MUX2。', 'A → MUX2.A，B → MUX2.B，S → MUX2.S。', 'Y → 灯 Y。', '固定 S=0/1，检查选择是否正确。'],
        mistakes: ['S 悬空按 0，所以永远选 A。', '把 MUX2 当成只能选 0/1 的开关；A、B 是任意数据。']
      }
    },
    {
      id: 'const-mask', num: '14', group: '组合逻辑', title: '常量与使能', en: 'CONSTANT',
      difficulty: 1, tag: '常量',
      objective: '用一枚常量 1 和 AND 门，让 Y 跟随 A；常量是固定的高电平。',
      tip: 'AND 的一个输入接 A，另一个接常量 C=1。C 是关卡固定的常量，不要把它改成 0。',
      concept: '常量为电路提供固定电平。AND 与 1 相与不改变信号，与 0 相与则强制清零。',
      allowed: ['AND'],
      requirements: { usedTypes: ['CONST', 'AND'] },
      setup: [
        { type: 'IN', name: 'A', x: 170, y: 170, value: 0, locked: true },
        { type: 'CONST', name: 'C', x: 170, y: 330, value: 1, locked: true, frozen: true },
        { type: 'OUT', name: 'Y', x: 730, y: 250, locked: true }
      ],
      tests: { inputs: ['A'], outputs: ['Y'], vectors: [{ A: 0, Y: 0 }, { A: 1, Y: 1 }] },
      lesson: {
        component: 'CONST',
        why: '常量不是输入开关，它代表电路里固定的 0 或 1。与 1 相与相当于“放行”，与 0 相与相当于“强制关闭”。',
        formula: 'Y = A · C，C = 1',
        steps: ['观察 CONST C，它固定输出 1。', '拖出 AND 门。', 'A → AND.A，C → AND.C。', 'AND.Y → 灯 Y。', '验证 Y 始终等于 A。'],
        mistakes: ['把 C 接到 AND 的输出端；常量是源，只能接到输入。', '把 C 改成 0，结果会被强制为 0。']
      }
    },
    {
      id: 'split-bus', num: '15', group: '数据通路', title: '拆开总线', en: 'SPLIT BUS',
      difficulty: 2, tag: '总线',
      objective: '把 4 位输入 A 拆成 b3、b2、b1、b0 四根线，分别点亮四盏灯。',
      tip: 'SPLIT 右侧从上到下对应权重 8、4、2、1。例如 A=10（1010）时 8 和 2 两盏灯亮。',
      concept: '总线把多根线打包在一起。拆分后可以单独观察或处理每一位。',
      allowed: ['SPLIT'],
      setup: [
        { type: 'NIB', name: 'A', x: 130, y: 220, value: 0, locked: true },
        { type: 'OUT', name: 'b3', x: 830, y: 70, locked: true },
        { type: 'OUT', name: 'b2', x: 830, y: 170, locked: true },
        { type: 'OUT', name: 'b1', x: 830, y: 270, locked: true },
        { type: 'OUT', name: 'b0', x: 830, y: 370, locked: true }
      ],
      tests: {
        inputs: ['A'], outputs: ['b3', 'b2', 'b1', 'b0'],
        vectors: [
          { A: 0, b3: 0, b2: 0, b1: 0, b0: 0 },
          { A: 5, b3: 0, b2: 1, b1: 0, b0: 1 },
          { A: 10, b3: 1, b2: 0, b1: 1, b0: 0 },
          { A: 15, b3: 1, b2: 1, b1: 1, b0: 1 }
        ]
      },
      lesson: {
        component: 'SPLIT',
        why: '4 位总线用一条粗线表示 4 个比特。SPLIT 把它拆成按权重排列的四根 1 位线，便于逐位观察。',
        formula: 'A = 8·b3 + 4·b2 + 2·b1 + 1·b0',
        steps: ['拖出 SPLIT。', 'A（4 位）→ SPLIT.D。', 'SPLIT 右侧 8/4/2/1 分别接四盏灯。', '用 4 位输入的四个小格设置 A=10，确认 8 和 2 亮。'],
        mistakes: ['把 4 位输出接到 1 位灯，位宽不匹配。', '把 8/4/2/1 的顺序接反。']
      }
    },
    {
      id: 'merge-bus', num: '16', group: '数据通路', title: '合成总线', en: 'MERGE BUS',
      difficulty: 2, tag: '总线',
      objective: '把 b3、b2、b1、b0 四根 1 位线合成 4 位总线，用数码管显示其十六进制值。',
      tip: 'MERGE 左侧从上到下是 8、4、2、1；四个输入合起来就是 0～15。',
      concept: '合线器是分线器的逆过程：把并行比特重新打包成总线。',
      allowed: ['MERGE'],
      setup: [
        { type: 'IN', name: 'b3', x: 150, y: 80, value: 0, locked: true },
        { type: 'IN', name: 'b2', x: 150, y: 185, value: 0, locked: true },
        { type: 'IN', name: 'b1', x: 150, y: 290, value: 0, locked: true },
        { type: 'IN', name: 'b0', x: 150, y: 395, value: 0, locked: true },
        { type: 'HEX', name: 'Y', x: 740, y: 190, locked: true }
      ],
      tests: {
        inputs: ['b3', 'b2', 'b1', 'b0'], outputs: ['Y'],
        vectors: [
          { b3: 0, b2: 0, b1: 0, b0: 0, Y: 0 },
          { b3: 0, b2: 0, b1: 0, b0: 1, Y: 1 },
          { b3: 0, b2: 1, b1: 0, b0: 1, Y: 5 },
          { b3: 1, b2: 0, b1: 1, b0: 0, Y: 10 },
          { b3: 1, b2: 1, b1: 1, b0: 1, Y: 15 }
        ]
      },
      lesson: {
        component: 'MERGE',
        why: '合线器把四个独立的 1 位输入按权重打包成一条 4 位总线。它经常用于把分离的位重新组合成数据。',
        formula: 'Y = 8·b3 + 4·b2 + 2·b1 + b0',
        steps: ['拖出 MERGE。', 'b3/b2/b1/b0 分别接 MERGE 的 8/4/2/1。', 'MERGE 的 4 位输出接数码管 Y。', '组合出 0101（5）和 1010（10），观察数码管。'],
        mistakes: ['把 8/4/2/1 接反，导致数值完全错误。', '把 4 位总线直接接到 1 位开关，位宽不匹配。']
      }
    },
    {
      id: 'adder-4', num: '17', group: '数据通路', title: '四位加法器', en: '4-BIT ADDER',
      difficulty: 3, tag: '算术',
      objective: '把两个 4 位输入 A、B 与进位 Cin 相加，得到 4 位和 S 和进位 Cout。',
      tip: '使用 ADD 4 元件。注意粗金色线是 4 位总线；A、B、S 的位宽必须匹配。',
      concept: '4 位加法器把 0～15 相加，进位溢出到 Cout。CPU 的 ALU 就是这样从全加器长出来的。',
      allowed: ['ADD4'],
      setup: [
        { type: 'NIB', name: 'A', x: 130, y: 150, value: 0, locked: true },
        { type: 'NIB', name: 'B', x: 130, y: 330, value: 0, locked: true },
        { type: 'IN', name: 'Cin', x: 410, y: 430, value: 0, locked: true },
        { type: 'HEX', name: 'S', x: 700, y: 140, locked: true },
        { type: 'OUT', name: 'Cout', x: 745, y: 360, locked: true }
      ],
      tests: {
        inputs: ['A', 'B', 'Cin'], outputs: ['S', 'Cout'],
        vectors: [
          { A: 0, B: 0, Cin: 0, S: 0, Cout: 0 }, { A: 1, B: 2, Cin: 0, S: 3, Cout: 0 },
          { A: 7, B: 8, Cin: 0, S: 15, Cout: 0 }, { A: 15, B: 1, Cin: 0, S: 0, Cout: 1 },
          { A: 9, B: 6, Cin: 1, S: 0, Cout: 1 }, { A: 15, B: 15, Cin: 1, S: 15, Cout: 1 },
          { A: 10, B: 5, Cin: 0, S: 15, Cout: 0 }, { A: 3, B: 4, Cin: 1, S: 8, Cout: 0 }
        ]
      },
      lesson: {
        component: 'ADD4',
        why: 'ADD4 把四个全加器封装在一起，输入 A、B 都是 4 位总线，输出 S 只保留低 4 位，溢出进入 Cout。',
        formula: 'S = (A + B + Cin) mod 16；Cout = 进位',
        steps: ['拖出 ADD4。', 'A、B 两条 4 位总线分别接 ADD4.A / ADD4.B。', 'Cin 接 ADD4.Ci。', 'ADD4.S 接数码管 S，ADD4.Co 接 Cout。', '输入 A=15、B=1、Cin=0，观察 S=0、Cout=1。'],
        mistakes: ['把 4 位 A 接到 1 位 Cin。', '把 Cout 当成第 5 位和；它只是溢出标志，要单独显示。']
      }
    },
    {
      id: 'dff-latch', num: '18', group: '时序', title: '记住一位', en: 'D FLIP-FLOP',
      difficulty: 3, tag: '时序',
      objective: '用 DFF 在时钟上升沿把 D 的值锁存到 Q。',
      tip: '先按暂停，再用单步按钮让 CLK 走 0→1→0；注意 D 在时钟高电平期间改变，Q 不会立刻跟着变。',
      concept: '组合逻辑没有记忆；DFF 把某一瞬间的输入保存下来，是寄存器、计数器和 CPU 状态的基础。',
      allowed: ['DFF'],
      requirements: { usedTypes: ['CLK', 'DFF'] },
      setup: [
        { type: 'IN', name: 'D', x: 160, y: 180, value: 0, locked: true },
        { type: 'CLK', name: 'CLK', x: 160, y: 340, locked: true },
        { type: 'OUT', name: 'Q', x: 740, y: 250, locked: true }
      ],
      tests: {
        inputs: ['D'], outputs: ['Q'], sequence: [
          { D: 0, clock: 0, Q: 0 },
          { D: 1, clock: 1, Q: 1 },
          { D: 0, clock: 1, Q: 1 },
          { D: 0, clock: 0, Q: 1 },
          { D: 0, clock: 1, Q: 0 },
          { D: 1, clock: 0, Q: 0 },
          { D: 1, clock: 1, Q: 1 }
        ]
      },
      lesson: {
        component: 'DFF',
        why: 'D 触发器是“边沿触发”的：只在 CLK 从 0 跳到 1 的瞬间采样 D。之后无论 D 怎么变，Q 都保持到下一个上升沿。',
        formula: 'Q(next) = D（仅在 CLK ↑）',
        steps: ['拖出 DFF。', 'D → DFF.D，CLK → DFF.CLK，DFF.Q → 灯 Q。', '暂停仿真。', '当 D=0 时单步一次，Q 应为 0。', '改 D=1，再单步一次，Q 变为 1；保持 D=0 不动，Q 仍为 1。'],
        mistakes: ['把时钟输入悬空，DFF 永远不会更新。', '以为 DFF 是“透明”的；D 改变不会立即改变 Q，只有上升沿采样。'],
        table: {
          head: ['步', 'D', 'CLK', 'Q'],
          rows: [['1', '0', '0', '0'], ['2', '1', '↑', '1'], ['3', '0', '1', '1'], ['4', '0', '0', '1'], ['5', '0', '↑', '0']]
        }
      }
    },
    {
      id: 'reg4-capture', num: '19', group: '时序', title: '保存四位', en: '4-BIT REGISTER',
      difficulty: 3, tag: '寄存器',
      objective: '用 REG4 在 EN=1 且时钟上升沿时保存 4 位 D，并显示在数码管 Q 上。',
      tip: 'EN=0 时寄存器保持原值；EN=1 的上升沿才写入新值。先暂停，再用单步。',
      concept: '寄存器是 CPU 里最常见的存储单元。4 位寄存器就是四个并排的 DFF，共享时钟和写使能。',
      allowed: ['REG4'],
      requirements: { usedTypes: ['CLK', 'REG4'] },
      setup: [
        { type: 'NIB', name: 'D', x: 130, y: 180, value: 0, locked: true },
        { type: 'CLK', name: 'CLK', x: 130, y: 370, locked: true },
        { type: 'IN', name: 'EN', x: 400, y: 440, value: 0, locked: true },
        { type: 'HEX', name: 'Q', x: 720, y: 170, locked: true }
      ],
      tests: {
        inputs: ['D', 'EN'], outputs: ['Q'], sequence: [
          { D: 0, EN: 0, clock: 0, Q: 0 },
          { D: 5, EN: 1, clock: 0, Q: 0 },
          { D: 5, EN: 1, clock: 1, Q: 5 },
          { D: 9, EN: 0, clock: 0, Q: 5 },
          { D: 9, EN: 0, clock: 1, Q: 5 },
          { D: 9, EN: 1, clock: 0, Q: 5 },
          { D: 9, EN: 1, clock: 1, Q: 9 },
          { D: 3, EN: 1, clock: 0, Q: 9 },
          { D: 3, EN: 1, clock: 1, Q: 3 }
        ]
      },
      lesson: {
        component: 'REG4',
        why: 'REG4 在时钟上升沿且 EN=1 时，把 4 位 D 一起写入 Q。EN=0 时它像关闭的阀门，保持旧值。',
        formula: 'if (CLK ↑ and EN) Q ← D',
        steps: ['拖出 REG4。', 'D（4 位）→ REG4.D，CLK → REG4.CLK，EN → REG4.EN。', 'REG4.Q（4 位）→ 数码管 Q。', '保持 EN=0，单步一次，确认 Q 不变。', '把 EN=1、D=5，单步一次，Q 变为 5。', 'EN=0、D=9，再单步，Q 仍为 5。'],
        mistakes: ['把 EN 悬空按 0，寄存器永远不会写入。', '在 CLK 已经是 1 时改 D 就以为写入了；需要新的上升沿。', '把 4 位 D 接到 1 位端口，位宽不匹配。'],
        table: {
          head: ['步', 'EN', 'D', 'CLK', 'Q'],
          rows: [['1', '0', '5', '0', '0'], ['2', '1', '5', '↑', '5'], ['3', '0', '9', '↑', '5'], ['4', '1', '9', '↑', '9']]
        }
      }
    }
  ];

  /* A concrete, everyday image for every challenge. These are rendered as a
     "生活小剧场" flow card at the top of the lesson sheet. */
  const ANALOGIES = {
    'first-light': {
      title: '一根水管，两个水龙头',
      scene: '把开关 A 想成水龙头，导线是水管，灯是水轮。水龙头打开，水沿着水管流过去，水轮转、灯亮；关上，水停、灯灭。导线不改变水，只负责搬运。',
      tokens: ['A 打开', '水流过去'],
      joiner: '，',
      result: '灯亮 / Y=1'
    },
    'and-gate': {
      title: '两把串联的钥匙',
      scene: 'A、B 像两把必须同时转开的钥匙。只转开一把，门闩还卡着；两把都转开，门才打开，灯才亮。任何一把没开，灯就灭。',
      tokens: ['A 转开', 'B 转开'],
      result: '门开 / Y=1'
    },
    'or-gate': {
      title: '两扇并联的门',
      scene: 'A、B 是两扇并联的门，只要有一扇打开，风就能进来，风铃就响。只有两扇门都关死，灯才灭。',
      tokens: ['A 打开', 'B 打开'],
      joiner: '或',
      result: '至少一扇开 / 灯亮'
    },
    'not-gate': {
      title: '跷跷板的另一头',
      scene: 'A 和 Y 坐在跷跷板两头。A 被按下，Y 就翘起来；A 松开，Y 就落下去。它们永远做相反的动作。',
      tokens: ['A 按下'],
      result: 'Y 翘起（相反）'
    },
    'nand-gate': {
      title: '两个人同时按住才解除警报',
      scene: '安全门要求 A、B 两个按钮同时被按住，警报才会解除。但指示灯是“反着接”的：两个都按住时灯反而灭，其他情况灯都亮。',
      tokens: ['A 按住', 'B 按住'],
      joiner: '且',
      result: 'Y=0，灯灭'
    },
    'nor-gate': {
      title: '安静图书馆的提示灯',
      scene: '“安静”提示灯最怕有人说话。A 或 B 任何一个人出声，灯就灭；只有两个人都安静，灯才亮着。',
      tokens: ['A 安静', 'B 安静'],
      joiner: '且',
      result: 'Y=1，灯亮'
    },
    'xor-built': {
      title: '楼梯的双控灯',
      scene: '楼梯上下各有一个开关。两个开关状态不同时灯亮，状态相同时灯灭——这就是“不同才亮”的异或。',
      tokens: ['A=0', 'B=1'],
      joiner: '、',
      result: '状态不同 / Y=1'
    },
    'xnor-gate': {
      title: '意见一致才握手',
      scene: '两个人分别投票。只有两人意见相同（都同意或都反对），才握手；意见不同就各自走开。',
      tokens: ['A=1', 'B=1'],
      joiner: '、',
      result: '相同 / Y=1'
    },
    'half-adder': {
      title: '两个篮子凑整',
      scene: 'A、B 各是一个篮子。两个篮子各装 1 个球，合起来就是 2 个；满 2 要向高位进 1，自己的本位只剩 0。',
      tokens: ['A=1', 'B=1'],
      result: '满 2 进 1：S=0，C=1'
    },
    'full-adder': {
      title: '三个篮子，两层传送带',
      scene: '先把 A、B 两个篮子合在一起，得到本位的和与进位；再把低位送来的 Cin 放进传送带。两条路径产生的进位，只要有一个为 1，都要送到高位。',
      tokens: ['A=1', 'B=1', 'Cin=1'],
      result: 'S=1，Cout=1'
    },
    'decoder-24': {
      title: '四个房间的门牌',
      scene: 'A1A0 是门牌号，Y0～Y3 是四个房间的灯。门牌是 10，只有 2 号房间亮；其他门牌号会让另外一盏灯亮，永远只有一盏。',
      tokens: ['A1=1', 'A0=0'],
      joiner: '、',
      result: 'Y2 亮，其余灭'
    },
    'mux-21': {
      title: '铁路道岔',
      scene: 'S 是扳道工，A、B 是两条铁轨，Y 是列车最终进入的车站。扳道工把道岔扳向哪边，列车就只能走哪条轨道。',
      tokens: ['S=0', '选 A'],
      joiner: '，',
      result: 'Y=A'
    },
    'mux2-component': {
      title: '电视的 HDMI 切换',
      scene: 'A、B 是插在电视上的两台设备，S 是遥控器。S=0 显示 A，S=1 显示 B；电视永远只显示被选中的那一路。',
      tokens: ['S=0', '显示 A'],
      joiner: '，',
      result: 'Y=A'
    },
    'const-mask': {
      title: '一直开着的水龙头',
      scene: 'C 是一个永远开着的水龙头（常量 1），A 是普通阀门。A 打开，水通过；A 关闭，水被挡住。与常量 1 相与，相当于给信号放行。',
      tokens: ['C=1', 'A 打开'],
      result: '水通过 / Y=1'
    },
    'split-bus': {
      title: '把一叠钞票按面额拆开',
      scene: '总线像一叠按面额打包的钱。A=10 相当于一张 8 元和一张 2 元；SPLIT 把它们拆开，四盏灯分别表示 8、4、2、1。',
      tokens: ['A=10（1010）'],
      result: '8 亮 + 2 亮'
    },
    'merge-bus': {
      title: '把四张钞票装进信封',
      scene: '8、4、2、1 是四个独立的小包。MERGE 像把四张钞票装进同一个信封，信封上写总金额；数码管读出这个 4 位总数。',
      tokens: ['8=1', '2=1'],
      result: '信封总额 = 10'
    },
    'adder-4': {
      title: '四位里程表',
      scene: '汽车里程表只有四位，走到 9999 再加 1 就会归零，同时向更高位进 1。ADD4 的 S 只保留低 4 位，Cout 就是那根“进位指针”。',
      tokens: ['A=15', 'B=1'],
      result: '归零 S=0，Cout=1'
    },
    'dff-latch': {
      title: '照相机快门',
      scene: 'CLK 的上升沿就是按下快门，D 是镜头前的画面，Q 是拍好的照片。快门没按，画面怎么变都不会进入照片；按下的那一瞬间，D 被定格。',
      tokens: ['D=1', 'CLK ↑'],
      result: '照片 Q=1'
    },
    'reg4-capture': {
      title: '四个并排的储物柜',
      scene: 'REG4 是四个并排的柜子，D 是你要放进去的四件物品，EN 是柜门总开关，CLK 上升沿是“确认写入”的时刻。EN 关着时，柜子里保留旧物品。',
      tokens: ['D=5', 'EN=1', 'CLK ↑'],
      result: 'Q=5'
    }
  };

  LEVELS.forEach((lv, index) => {
    lv.index = index;
    if (ANALOGIES[lv.id] && lv.lesson) lv.lesson.analogy = ANALOGIES[lv.id];
    lv.setup.forEach((n) => {
      if (n.locked === undefined) n.locked = true;
    });
  });

  CL.LEVELS = LEVELS;
  CL.levelById = (id) => LEVELS.find((l) => l.id === id) || null;
  CL.GROUPS = ['基础', '逻辑门', '组合逻辑', '数据通路', '时序'];
})();
