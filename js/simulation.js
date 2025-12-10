import {
    VCC, GND, Clock,
    Switch, Button,
    LED, Display,
    ANDGate, ORGate, NOTGate,
    NANDGate, NORGate, XORGate, XNORGate,
    InputPin, OutputPin,
    Chip,
    Wire,
    Protoboard
} from './components.js';

export class Simulation {
    constructor() {
        this.components = [];
        this.wires = [];
        this.isRunning = false;
        this.tickCount = 0;
        this.customChips = new Map();
        this.currentPuzzle = null;
    }

    addComponent(type, x, y) {
        if (this.customChips.has(type)) {
            const def = this.customChips.get(type);
            const chip = new Chip(x, y, def);
            this.components.push(chip);
            this.update();
            return;
        }

        let comp;
        switch (type) {
            case 'ProtoSmall': comp = new Protoboard(x, y, 'small'); break;
            case 'ProtoMedium': comp = new Protoboard(x, y, 'medium'); break;
            case 'ProtoLarge': comp = new Protoboard(x, y, 'large'); break;
            case 'VCC': comp = new VCC(x, y); break;
            case 'GND': comp = new GND(x, y); break;
            case 'Clock': comp = new Clock(x, y); break;
            case 'Switch': comp = new Switch(x, y); break;
            case 'Button': comp = new Button(x, y); break;
            case 'LED': comp = new LED(x, y); break;
            case 'Display': comp = new Display(x, y); break;
            case 'AND': comp = new ANDGate(x, y); break;
            case 'OR': comp = new ORGate(x, y); break;
            case 'NOT': comp = new NOTGate(x, y); break;
            case 'NAND': comp = new NANDGate(x, y); break;
            case 'NOR': comp = new NORGate(x, y); break;
            case 'XOR': comp = new XORGate(x, y); break;
            case 'XNOR': comp = new XNORGate(x, y); break;
            case 'InputPin': comp = new InputPin(x, y); break;
            case 'OutputPin': comp = new OutputPin(x, y); break;
            default: console.warn('Unknown component type:', type); return;
        }
        this.components.push(comp);
        this.update();
    }

    addWire(x1, y1, x2, y2) {
        if (x1 === x2 && y1 === y2) return;
        this.wires.push(new Wire(x1, y1, x2, y2));
        this.update();
    }

    findComponentAt(x, y) {
        return this.components.find(c => c.hitTest(x, y));
    }

    removeAt(x, y) {
        // Remove components unless locked
        const compIdx = this.components.findIndex(c => c.hitTest(x, y));
        if (compIdx !== -1) {
            const target = this.components[compIdx];
            if (!target.locked) {
                this.components.splice(compIdx, 1);
            }
        }

        // Remove wires (check endpoints)
        this.wires = this.wires.filter(w => {
            return !this.isPointNearLine(x, y, w.x1, w.y1, w.x2, w.y2, 8);
        });

        this.update();
    }

    createChip(name) {
        // Find inputs and outputs
        const inputs = this.components.filter(c => c.type === 'InputPin');
        const outputs = this.components.filter(c => c.type === 'OutputPin');

        if (inputs.length === 0 && outputs.length === 0) {
            alert("Chip must have at least one input or output pin.");
            return null;
        }

        // Create definition
        // We need to normalize coordinates so the chip content is centered or top-left based.
        // But for simplicity, we just save relative to a bounding box?
        // Or just save as is and when simulating, we map inputs/outputs.

        // We need to assign IDs to pins if they don't have them unique enough.
        // Let's assume user placed them.
        // We'll use their current position as ID or just index.
        inputs.forEach((p, i) => p.id = `in_${i}`);
        outputs.forEach((p, i) => p.id = `out_${i}`);

        const definition = {
            name: name,
            inputs: inputs.map(p => ({ id: p.id, label: p.label })),
            outputs: outputs.map(p => ({ id: p.id, label: p.label })),
            components: this.components.map(c => ({
                type: c.type,
                x: c.x,
                y: c.y,
                // For nested chips, we need their definition too? 
                // If we just save type, we need to ensure customChips has it.
                // For now, assume flat or already registered.
                definition: c.definition // For nested chips
            })),
            wires: this.wires.map(w => ({
                x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2
            }))
        };

        this.customChips.set(name, definition);
        return definition;
    }

    isPointNearLine(px, py, x1, y1, x2, y2, tolerance = 5) {
        const d = Math.abs((y2 - y1) * px - (x2 - x1) * py + x2 * y1 - y2 * x1) / Math.sqrt(Math.pow(y2 - y1, 2) + Math.pow(x2 - x1, 2));
        const withinBounds = px >= Math.min(x1, x2) - tolerance && px <= Math.max(x1, x2) + tolerance &&
            py >= Math.min(y1, y2) - tolerance && py <= Math.max(y1, y2) + tolerance;
        return d < tolerance && withinBounds;
    }

    start() {
        this.isRunning = true;
    }

    pause() {
        this.isRunning = false;
    }

    step() {
        this.tick();
    }

    clear() {
        this.components = [];
        this.wires = [];
        this.tickCount = 0;
        this.currentPuzzle = null;
    }

    loadPuzzle(puzzle) {
        this.clear();
        this.currentPuzzle = puzzle;
        const vw = Math.max(900, window.innerWidth || 900);
        const vh = Math.max(620, window.innerHeight || 620);
        const gutter = 120;
        const baseXLeft = Math.max(120, Math.round(vw * 0.22));
        const baseXRight = Math.min(vw - gutter, Math.round(vw * 0.72));
        const spacing = Math.max(70, (vh - 260) / Math.max(1, puzzle.inputs.length));
        const startY = 140;

        // Drop a locked protoboard that matches the base plate if provided.
        if (puzzle.basePlate) {
            const sizeKey = (puzzle.basePlate.layout || '').toLowerCase();
            const size = sizeKey.includes('large') ? 'large' : sizeKey.includes('small') ? 'small' : 'medium';
            const proto = new Protoboard((baseXLeft + baseXRight) / 2, startY + 60, size);
            proto.locked = true;
            this.components.push(proto);
        }

        puzzle.inputs.forEach((name, idx) => {
            const pin = new InputPin(baseXLeft, startY + idx * spacing);
            pin.id = name;
            pin.label = name;
            pin.locked = true;
            this.components.push(pin);
        });

        puzzle.outputs.forEach((name, idx) => {
            const pin = new OutputPin(baseXRight, startY + idx * spacing);
            pin.id = name;
            pin.label = name;
            pin.locked = true;
            this.components.push(pin);
        });

        // Add faint guide wires to hint spacing
        this.wires.push(new Wire(baseXLeft, startY, baseXLeft + 60, startY));
        this.update();
    }

    setPinValue(id, value) {
        const pin = this.components.find(c => c instanceof InputPin && c.id === id);
        if (pin) pin.setValue(value);
    }

    getOutputValue(id) {
        const pin = this.components.find(c => c instanceof OutputPin && c.id === id);
        return pin ? !!pin.value : false;
    }

    checkTruthTable(puzzle) {
        if (!puzzle) return false;
        let allPass = true;
        puzzle.truthTable.forEach(row => {
            Object.entries(row.inputs).forEach(([key, val]) => this.setPinValue(key, val));
            this.updateLogic();
            puzzle.outputs.forEach(outKey => {
                const expected = row.outputs[outKey];
                const actual = this.getOutputValue(outKey);
                if (expected !== actual) allPass = false;
            });
        });

        // Reset inputs to LOW after evaluation
        puzzle.inputs.forEach(name => this.setPinValue(name, false));
        this.updateLogic();
        return allPass;
    }

    tick() {
        this.tickCount++;

        // Update clocks and other time-dependent components
        this.components.forEach(c => {
            if (c.update) c.update(this.tickCount);
        });

        this.updateLogic();
    }

    // Force an update without advancing time (for editing)
    update() {
        this.updateLogic();
    }

    updateLogic() {
        Simulation.evaluate(this.components, this.wires);
    }

    static evaluate(components, wires) {
        // 1. Reset all nodes/wires to floating (null) or default
        components.forEach(c => c.resetInputs());

        // 2. Apply sources (VCC, GND, Active Outputs)
        let activeNodes = [];

        components.forEach(c => {
            // If component is a Chip, we need to evaluate it first?
            // Or Chip.compute() handles its internal logic.
            // Chip.compute() is called at the end of this function.
            // But Chip outputs depend on its internal state which depends on inputs.
            // So Chip needs to be evaluated after inputs are set.
            // But Chip outputs might drive other components.
            // This implies a need for multiple passes or event-driven simulation.
            // For now, we assume 1 tick delay for chips is fine, or we do multiple passes.

            const outputs = c.getOutputs();
            outputs.forEach(out => {
                activeNodes.push({ x: out.x, y: out.y, value: out.value });
            });
        });

        // Propagate through wires
        const adj = new Map();
        const addEdge = (p1, p2) => {
            const k1 = `${p1.x},${p1.y}`;
            const k2 = `${p2.x},${p2.y}`;
            if (!adj.has(k1)) adj.set(k1, []);
            if (!adj.has(k2)) adj.set(k2, []);
            adj.get(k1).push(k2);
            adj.get(k2).push(k1);
        };

        wires.forEach(w => {
            addEdge({ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
        });

        const nodeValues = new Map(); // "x,y" -> boolean
        const queue = [...activeNodes];

        while (queue.length > 0) {
            const { x, y, value } = queue.shift();
            const key = `${x},${y}`;

            if (nodeValues.has(key)) {
                const currentVal = nodeValues.get(key);
                if (currentVal !== value && value === true) {
                    nodeValues.set(key, true); // High overrides
                }
                continue;
            }

            nodeValues.set(key, value);

            const neighbors = adj.get(key) || [];
            neighbors.forEach(nKey => {
                if (!nodeValues.has(nKey)) {
                    const [nx, ny] = nKey.split(',').map(Number);
                    queue.push({ x: nx, y: ny, value });
                }
            });
        }

        // 3. Update component inputs based on grid values
        components.forEach(c => {
            const inputs = c.getInputs();
            inputs.forEach(inp => {
                const key = `${inp.x},${inp.y}`;
                if (nodeValues.has(key)) {
                    c.setInput(inp.id, nodeValues.get(key));
                } else {
                    c.setInput(inp.id, false);
                }
            });

            // If it's a Chip, we need to pass the evaluator to it so it can simulate internals
            if (c.type === 'Chip' || c instanceof Chip) {
                // We need to map inputs to internal InputPins
                // Then evaluate internal circuit
                // Then map internal OutputPins to outputs

                // Map inputs
                c.inputPins.forEach(pin => {
                    // Find the input on the chip that corresponds to this pin
                    // The chip inputs are mapped by ID
                    // c.inputs has {id, value...} ? No, c.inputs is just geometry.
                    // c.setInput updates internal state?
                    // We need to implement Chip.setInput to update the internal InputPin.
                });

                // Actually, Chip.setInput should handle this.
                // But Chip needs to run evaluate on its internals.
                // We can call a method on Chip here.
                if (c.evaluateInternal) {
                    c.evaluateInternal(Simulation.evaluate);
                }
            }

            c.compute();
        });

        // Update wire colors
        wires.forEach(w => {
            const k1 = `${w.x1},${w.y1}`;
            if (nodeValues.get(k1)) {
                w.state = true;
            } else {
                w.state = false;
            }
        });
    }

    toJSON() {
        return JSON.stringify({
            components: this.components.map(c => ({
                type: c.type,
                x: c.x,
                y: c.y,
                state: c.isOn !== undefined ? { isOn: c.isOn } : {}
            })),
            wires: this.wires.map(w => ({
                x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2
            }))
        });
    }

    loadJSON(json) {
        try {
            const data = JSON.parse(json);
            this.clear();
            if (data.components) {
                data.components.forEach(c => {
                    this.addComponent(c.type, c.x, c.y);
                    const comp = this.components[this.components.length - 1];
                    if (comp && c.state && c.state.isOn !== undefined && comp.isOn !== undefined) {
                        comp.isOn = c.state.isOn;
                        // Update visual state if needed
                        if (comp.toggle && typeof comp.toggle === 'function' && comp.isOn !== (comp.outputs[0]?.value)) {
                            // Force update output
                            if (comp.outputs[0]) comp.outputs[0].value = comp.isOn;
                        }
                    }
                });
            }
            if (data.wires) {
                data.wires.forEach(w => {
                    this.addWire(w.x1, w.y1, w.x2, w.y2);
                });
            }
            this.update();
        } catch (e) {
            console.error("Failed to load circuit:", e);
            alert("Invalid circuit file");
        }
    }
}
