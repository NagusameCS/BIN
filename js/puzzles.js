const clampLevel = level => Math.max(1, Math.min(4, level));

const basePlates = [
    { id: 'strip-mini', title: 'Compact Strip', layout: 'ProtoSmall', inputs: 2, outputs: 1, gateBudget: 3, note: 'Tight proto strip; favor clean routing.' },
    { id: 'strip-wide', title: 'Wide Strip', layout: 'ProtoMedium', inputs: 3, outputs: 2, gateBudget: 5, note: 'Room for a couple helper gates.' },
    { id: 'matrix', title: 'Matrix Board', layout: 'ProtoLarge', inputs: 4, outputs: 2, gateBudget: 8, note: 'Plenty of space; try symmetry.' },
    { id: 'hybrid', title: 'Hybrid Patch', layout: 'ProtoMedium', inputs: 3, outputs: 1, gateBudget: 6, note: 'Mix gates with clever wiring.' }
];

function generatePuzzle(seed, level = 1) {
    const rng = new SeededRandom(seed + level * 101);
    const difficultyIdx = clampLevel(level) - 1;
    const levelTags = ['Easy', 'Medium', 'Hard', 'Expert'];
    const plate = rng.pick(basePlates);
    const recipe = rng.pick(generatorFamilies);
    const spec = recipe.make(rng, plate, difficultyIdx);

    const hint = rng.pick([
        'Plan pin ordering before wiring.',
        'Route in straight spans; avoid zig-zags.',
        'Mirror inputs to reduce wire crossings.',
        'Try distributing NOT gates near inputs.',
        'Budget your gates—simplify expressions first.'
    ]);

    const wobble = rng.nextFloat() * 0.25 + 0.75;
    const title = `${spec.title} · ${plate.title}`;

    return {
        id: `${recipe.id}-${plate.id}-${seed}`,
        seed,
        level: difficultyIdx + 1,
        difficulty: levelTags[difficultyIdx],
        title,
        description: `${spec.desc} Base plate: ${plate.note}`,
        inputs: spec.inputs,
        outputs: spec.outputs,
        truthTable: spec.truthTable,
        hint,
        wobble,
        goal: spec.goal,
        basePlate: plate,
        maxGates: spec.maxGates || plate.gateBudget
    };
}

const generatorFamilies = [
    {
        id: 'majority',
        make: (rng, plate) => {
            const inputs = ['A', 'B', 'C'].slice(0, Math.max(2, plate.inputs));
            const outputs = ['OUT'];
            return {
                title: 'Majority Vote',
                desc: 'Output goes HIGH when most inputs are HIGH.',
                inputs,
                outputs,
                goal: 'Use AND/OR/NOT; symmetry helps.',
                maxGates: plate.gateBudget,
                truthTable: buildTruthTable(inputs, outputs, vals => {
                    const sum = inputs.reduce((acc, key) => acc + (vals[key] ? 1 : 0), 0);
                    return { OUT: sum >= Math.ceil(inputs.length / 2) };
                })
            };
        }
    },
    {
        id: 'parity',
        make: (rng, plate) => {
            const inputs = ['D0', 'D1', 'D2', 'D3'].slice(0, Math.max(2, plate.inputs));
            const outputs = ['PAR'];
            return {
                title: 'Odd Parity',
                desc: 'PAR is HIGH when an odd number of bits are HIGH.',
                inputs,
                outputs,
                goal: 'Lean on XOR chains; minimize inverters.',
                maxGates: plate.gateBudget + 1,
                truthTable: buildTruthTable(inputs, outputs, vals => {
                    const sum = inputs.reduce((acc, key) => acc ^ (vals[key] ? 1 : 0), 0);
                    return { PAR: !!sum };
                })
            };
        }
    },
    {
        id: 'mux',
        make: (rng, plate) => {
            const inputs = ['D0', 'D1', 'SEL'];
            const outputs = ['OUT'];
            return {
                title: '2:1 Multiplexer',
                desc: 'Select between D0 and D1 using SEL.',
                inputs,
                outputs,
                goal: 'Implement the classic AND/OR/NOT mux.',
                maxGates: plate.gateBudget,
                truthTable: buildTruthTable(inputs, outputs, ({ D0, D1, SEL }) => ({ OUT: SEL ? D1 : D0 }))
            };
        }
    },
    {
        id: 'adder',
        make: (rng, plate, difficulty) => {
            const inputs = difficulty > 1 ? ['A', 'B', 'Cin'] : ['A', 'B'];
            const outputs = difficulty > 1 ? ['SUM', 'Cout'] : ['SUM', 'CARRY'];
            return {
                title: difficulty > 1 ? 'Full Adder' : 'Half Adder',
                desc: 'Sum bits; SUM is parity, CARRY is majority.',
                inputs,
                outputs,
                goal: 'Two XORs and a majority for carry.',
                maxGates: plate.gateBudget + 2,
                truthTable: buildTruthTable(inputs, outputs, vals => {
                    const bits = inputs.map(k => vals[k] ? 1 : 0);
                    const total = bits.reduce((a, b) => a + b, 0);
                    return {
                        SUM: !!(total % 2),
                        [outputs[1]]: total >= 2
                    };
                })
            };
        }
    },
    {
        id: 'boolean-tree',
        make: (rng, plate, difficulty) => {
            const inputs = ['A', 'B', 'C', 'D'].slice(0, Math.max(3, plate.inputs));
            const outputs = ['Q'];
            const expr = buildExpressionTree(rng, inputs, difficulty + 2);
            return {
                title: 'Procedural Logic',
                desc: 'Match the generated boolean expression.',
                inputs,
                outputs,
                goal: expr.hint,
                maxGates: plate.gateBudget + difficulty,
                truthTable: buildTruthTable(inputs, outputs, expr.fn)
            };
        }
    },
    {
        id: 'decoder',
        make: (rng, plate) => {
            const inputs = ['S0', 'S1'];
            const outputs = ['Y0', 'Y1', 'Y2', 'Y3'];
            return {
                title: '2-to-4 Decoder',
                desc: 'One-hot outputs based on selector bits.',
                inputs,
                outputs,
                goal: 'Ensure exactly one output HIGH.',
                maxGates: plate.gateBudget + 3,
                truthTable: buildTruthTable(inputs, outputs, ({ S0, S1 }) => {
                    const idx = (S1 ? 2 : 0) + (S0 ? 1 : 0);
                    return {
                        Y0: idx === 0,
                        Y1: idx === 1,
                        Y2: idx === 2,
                        Y3: idx === 3
                    };
                })
            };
        }
    }
];

export class PuzzleManager {
    constructor(date = new Date()) {
        this.today = date;
        this.dayIndex = dayOfYear(this.today);
        this.puzzles = [];
        this.rebuild();
    }

    rebuild() {
        this.puzzles = [];
        for (let i = 0; i < 4; i++) {
            this.puzzles.push(generatePuzzle(this.dayIndex + i * 37, i + 1));
        }
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
        if (puzzle.basePlate) meta.push(`Base: ${puzzle.basePlate.title}`);
        if (puzzle.maxGates) meta.push(`Suggested gate budget: ${puzzle.maxGates}`);
        return [headers, '-'.repeat(headers.length), ...rows, '', ...meta].join('\n');
    }
}

// Helpers
function buildTruthTable(inputs, outputs, evaluator) {
    const rows = [];
    const total = 1 << inputs.length;
    for (let mask = 0; mask < total; mask++) {
        const inputState = {};
        inputs.forEach((name, idx) => {
            inputState[name] = !!(mask & (1 << idx));
        });
        const result = evaluator(inputState);
        const outState = {};
        outputs.forEach(key => {
            outState[key] = !!result[key];
        });
        rows.push({ inputs: inputState, outputs: outState });
    }
    return rows;
}

function buildExpressionTree(rng, inputs, depth = 3) {
    const ops = ['AND', 'OR', 'XOR'];
    const neg = () => rng.nextFloat() > 0.65;

    const leaf = () => ({
        hint: '',
        fn: state => state[rng.pick(inputs)]
    });

    const grow = (d) => {
        if (d <= 0) return leaf();
        const left = grow(d - 1);
        const right = grow(d - 1);
        const op = rng.pick(ops);
        const wrapNot = neg();
        const fn = state => {
            let a = left.fn(state);
            let b = right.fn(state);
            let res;
            if (op === 'AND') res = a && b;
            else if (op === 'OR') res = a || b;
            else res = (!!a) !== (!!b);
            return wrapNot ? !res : res;
        };
        const hint = `${wrapNot ? 'NOT(' : ''}${op}(${left.hint || 'x'},${right.hint || 'y'})${wrapNot ? ')' : ''}`;
        return { fn, hint };
    };

    return grow(depth);
}

function dayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
}

class SeededRandom {
    constructor(seed = 1) {
        this.seed = seed >>> 0;
    }
    next() {
        this.seed = (1664525 * this.seed + 1013904223) >>> 0;
        return this.seed;
    }
    nextFloat() {
        return this.next() / 0xffffffff;
    }
    pick(arr) {
        return arr[Math.floor(this.nextFloat() * arr.length)];
    }
}
