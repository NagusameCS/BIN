const clampLevel = level => Math.max(1, Math.min(3, level));

function dayOfYear(date = new Date()) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
}

class SeededRandom {
    constructor(seed) {
        this.seed = seed % 2147483647;
        if (this.seed <= 0) this.seed += 2147483646;
    }
    next() {
        return this.seed = this.seed * 16807 % 2147483647;
    }
    nextFloat() {
        return (this.next() - 1) / 2147483646;
    }
    pick(list) {
        return list[Math.floor(this.nextFloat() * list.length) % list.length];
    }
}

function buildTruthTable(inputs, outputs, ruleFn) {
    const rows = [];
    const combos = 1 << inputs.length;
    for (let i = 0; i < combos; i++) {
        const assignment = {};
        inputs.forEach((name, idx) => {
            assignment[name] = !!(i & (1 << idx));
        });
        const result = ruleFn(assignment);
        const outputAssignment = {};
        outputs.forEach(name => {
            outputAssignment[name] = !!result[name];
        });
        rows.push({ inputs: assignment, outputs: outputAssignment });
    }
    return rows;
}

function generatePuzzle(seed, level = 1) {
    const rng = new SeededRandom(seed + level * 97);
    const levelTag = ['Casual', 'Tricky', 'Expert'][clampLevel(level) - 1];
    const templates = [
        {
            type: 'and-gate',
            title: 'Dual Switch Lock',
            desc: 'Both inputs must be HIGH to light the output.',
            inputs: ['A', 'B'],
            outputs: ['Q'],
            makeTable: () => buildTruthTable(['A', 'B'], ['Q'], ({ A, B }) => ({ Q: A && B }))
        },
        {
            type: 'or-gate',
            title: 'Either Path Works',
            desc: 'Any HIGH input should turn the output HIGH.',
            inputs: ['A', 'B'],
            outputs: ['Q'],
            makeTable: () => buildTruthTable(['A', 'B'], ['Q'], ({ A, B }) => ({ Q: A || B }))
        },
        {
            type: 'xor-gate',
            title: 'Exclusive Path',
            desc: 'Exactly one input HIGH turns the output HIGH.',
            inputs: ['A', 'B'],
            outputs: ['Q'],
            makeTable: () => buildTruthTable(['A', 'B'], ['Q'], ({ A, B }) => ({ Q: (A || B) && !(A && B) }))
        },
        {
            type: 'majority',
            title: 'Majority Vote',
            desc: 'At least two inputs HIGH should make OUT HIGH.',
            inputs: ['A', 'B', 'C'],
            outputs: ['OUT'],
            makeTable: () => buildTruthTable(['A', 'B', 'C'], ['OUT'], ({ A, B, C }) => ({ OUT: ((A ? 1 : 0) + (B ? 1 : 0) + (C ? 1 : 0)) >= 2 }))
        },
        {
            type: 'parity',
            title: 'Parity Bit',
            desc: 'OUT should be HIGH when an odd number of inputs are HIGH.',
            inputs: ['D0', 'D1', 'D2'],
            outputs: ['PAR'],
            makeTable: () => buildTruthTable(['D0', 'D1', 'D2'], ['PAR'], ({ D0, D1, D2 }) => ({ PAR: !!((D0 ? 1 : 0) ^ (D1 ? 1 : 0) ^ (D2 ? 1 : 0)) }))
        },
        {
            type: 'dual-output',
            title: 'Split Decision',
            desc: 'Drive two outputs: SUM behaves like XOR, CARRY like AND.',
            inputs: ['X', 'Y'],
            outputs: ['SUM', 'CARRY'],
            makeTable: () => buildTruthTable(['X', 'Y'], ['SUM', 'CARRY'], ({ X, Y }) => ({ SUM: (X || Y) && !(X && Y), CARRY: X && Y }))
        }
    ];

    const template = rng.pick(templates);
    const wobble = rng.nextFloat() * 0.35 + 0.65;
    const difficulty = clampLevel(level);
    const title = `${template.title} · ${levelTag}`;

    const truthTable = template.makeTable();
    const hint = rng.pick([
        'Try simplifying with as few gates as possible.',
        'Symmetry often reduces wiring.',
        'Plan the outputs before dropping gates.',
        'Route wires in straight lines to avoid tangles.',
        'Use NOT gates to flip tricky cases.'
    ]);

    return {
        id: `${template.type}-${seed}-${difficulty}`,
        seed,
        level: difficulty,
        title,
        description: template.desc,
        inputs: template.inputs,
        outputs: template.outputs,
        truthTable,
        hint,
        wobble
    };
}

export class PuzzleManager {
    constructor() {
        this.today = new Date();
        this.dayIndex = dayOfYear(this.today);
        this.puzzles = [
            generatePuzzle(this.dayIndex, 1),
            generatePuzzle(this.dayIndex + 13, 2),
            generatePuzzle(this.dayIndex + 29, 3)
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
        return [headers, '-'.repeat(headers.length), ...rows].join('\n');
    }
}
