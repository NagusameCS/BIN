const clampLevel = level => Math.max(1, Math.min(3, level));

function generatePuzzle(seed, level = 1, templatePool = []) {
    const rng = new SeededRandom(seed + level * 97);
    const difficultyIdx = clampLevel(level) - 1;
    const levelTags = ['Easy', 'Medium', 'Hard'];
    const pool = templatePool.length ? templatePool : defaultTemplates();
    const template = rng.pick(pool);
    const wobble = rng.nextFloat() * 0.35 + 0.65;
    const title = `${template.title} · ${levelTags[difficultyIdx]}`;

    const truthTable = template.makeTable();
    const hint = rng.pick([
        'Try simplifying with as few gates as possible.',
        'Symmetry often reduces wiring.',
        'Plan the outputs before dropping gates.',
        'Route wires in straight lines to avoid tangles.',
        'Use NOT gates to flip tricky cases.'
    ]);

    return {
        id: `${template.type}-${seed}-${difficultyIdx}`,
        seed,
        level: difficultyIdx + 1,
        difficulty: levelTags[difficultyIdx],
        title,
        description: template.desc,
        inputs: template.inputs,
        outputs: template.outputs,
        truthTable,
        hint,
        wobble,
        goal: template.goal,
        maxGates: template.maxGates || null
    };
}

function defaultTemplates() {
    return [
        {
            type: 'and-gate',
            title: 'Dual Switch Lock',
            desc: 'Both inputs must be HIGH to light the output.',
            inputs: ['A', 'B'],
            outputs: ['Q'],
            difficulty: 'Easy',
            goal: 'Build with only AND gates (and inverters if needed).',
            maxGates: 2,
            makeTable: () => buildTruthTable(['A', 'B'], ['Q'], ({ A, B }) => ({ Q: A && B }))
        },
        {
            type: 'or-gate',
            title: 'Either Path Works',
            desc: 'Any HIGH input should turn the output HIGH.',
            inputs: ['A', 'B'],
            outputs: ['Q'],
            difficulty: 'Easy',
            goal: 'Minimal gate count OR circuit.',
            maxGates: 2,
            makeTable: () => buildTruthTable(['A', 'B'], ['Q'], ({ A, B }) => ({ Q: A || B }))
        },
        {
            type: 'xor-gate',
            title: 'Exclusive Path',
            desc: 'Exactly one input HIGH turns the output HIGH.',
            inputs: ['A', 'B'],
            outputs: ['Q'],
            difficulty: 'Easy',
            goal: 'Use XOR to show exclusivity.',
            maxGates: 3,
            makeTable: () => buildTruthTable(['A', 'B'], ['Q'], ({ A, B }) => ({ Q: (A || B) && !(A && B) }))
        },
        {
            type: 'not-gate',
            title: 'Signal Inverter',
            desc: 'Invert the input to drive the output.',
            inputs: ['A'],
            outputs: ['Q'],
            difficulty: 'Easy',
            goal: 'Single NOT is enough.',
            maxGates: 1,
            makeTable: () => buildTruthTable(['A'], ['Q'], ({ A }) => ({ Q: !A }))
        },
        {
            type: 'majority',
            title: 'Majority Vote',
            desc: 'At least two inputs HIGH should make OUT HIGH.',
            inputs: ['A', 'B', 'C'],
            outputs: ['OUT'],
            difficulty: 'Medium',
            goal: 'Implement majority logic; AND/OR combos work well.',
            maxGates: 5,
            makeTable: () => buildTruthTable(['A', 'B', 'C'], ['OUT'], ({ A, B, C }) => ({ OUT: ((A ? 1 : 0) + (B ? 1 : 0) + (C ? 1 : 0)) >= 2 }))
        },
        {
            type: 'parity',
            title: 'Parity Bit',
            desc: 'OUT should be HIGH when an odd number of inputs are HIGH.',
            inputs: ['D0', 'D1', 'D2'],
            outputs: ['PAR'],
            difficulty: 'Medium',
            goal: 'Create odd parity using XOR chains.',
            maxGates: 5,
            makeTable: () => buildTruthTable(['D0', 'D1', 'D2'], ['PAR'], ({ D0, D1, D2 }) => ({ PAR: !!((D0 ? 1 : 0) ^ (D1 ? 1 : 0) ^ (D2 ? 1 : 0)) }))
        },
        {
            type: 'dual-output',
            title: 'Half Adder',
            desc: 'Generate SUM (XOR) and CARRY (AND) for two inputs.',
            inputs: ['X', 'Y'],
            outputs: ['SUM', 'CARRY'],
            difficulty: 'Medium',
            goal: 'Classic half-adder target.',
            maxGates: 4,
            makeTable: () => buildTruthTable(['X', 'Y'], ['SUM', 'CARRY'], ({ X, Y }) => ({ SUM: (X || Y) && !(X && Y), CARRY: X && Y }))
        },
        {
            type: 'full-adder',
            title: 'Full Adder',
            desc: 'Add three bits: SUM is odd parity, CARRY is majority.',
            inputs: ['A', 'B', 'Cin'],
            outputs: ['SUM', 'Cout'],
            difficulty: 'Hard',
            goal: 'Full adder using two XORs and majority logic.',
            maxGates: 7,
            makeTable: () => buildTruthTable(['A', 'B', 'Cin'], ['SUM', 'Cout'], ({ A, B, Cin }) => {
                const total = (A ? 1 : 0) + (B ? 1 : 0) + (Cin ? 1 : 0);
                return { SUM: !!(total % 2), Cout: total >= 2 };
            })
        },
        {
            type: 'mux',
            title: '2:1 Multiplexer',
            desc: 'Select between D0 and D1 based on SEL.',
            inputs: ['D0', 'D1', 'SEL'],
            outputs: ['OUT'],
            difficulty: 'Hard',
            goal: 'Implement a MUX with AND/OR/NOT combo.',
            maxGates: 6,
            makeTable: () => buildTruthTable(['D0', 'D1', 'SEL'], ['OUT'], ({ D0, D1, SEL }) => ({ OUT: SEL ? D1 : D0 }))
        }
    ];
}

export class PuzzleManager {
    constructor() {
        this.today = new Date();
        this.dayIndex = dayOfYear(this.today);
        this.puzzles = [];
        this.rebuild();
    }

    rebuild() {
        const templates = defaultTemplates();
        const easyPool = templates.filter(t => t.difficulty === 'Easy');
        const mediumPool = templates.filter(t => t.difficulty === 'Medium');
        const hardPool = templates.filter(t => t.difficulty === 'Hard');

        this.puzzles = [
            generatePuzzle(this.dayIndex, 1, easyPool),
            generatePuzzle(this.dayIndex + 17, 2, mediumPool),
            generatePuzzle(this.dayIndex + 43, 3, hardPool)
        ];
    }

    getPuzzle(levelIndex = 0) {
        const idx = clampLevel(levelIndex + 1) - 1;
        return this.puzzles[idx];
    }

    formatTruthTable(puzzle) {
        const headers = `${puzzle.inputs.join(' ')} | ${puzzle.outputs.join(' ')}`;
        const rows = puzzle.truthTable.map(row => {
            const ins = puzzle.inputs.map(k => row.inputs[k] ? '1' : '0').join('  ');
            const outs = puzzle.outputs.map(k => row.outputs[k] ? '1' : '0').join('  ');
            return `${ins} | ${outs}`;
        });
        const meta = [];
        if (puzzle.goal) meta.push(`Goal: ${puzzle.goal}`);
        if (puzzle.maxGates) meta.push(`Suggested gate budget: ${puzzle.maxGates}`);
        return [headers, '-'.repeat(headers.length), ...rows, '', ...meta].join('\n');
    }
}
