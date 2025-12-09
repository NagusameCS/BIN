export class Wire {
    constructor(x1, y1, x2, y2) {
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        this.state = false;
    }

    draw(ctx, gridSize, time = 0) {
        const pulse = (Math.sin(time / 160) + 1) / 2;
        const hue = this.state ? 140 : 210;
        const glow = this.state ? 12 : 0;
        const grad = ctx.createLinearGradient(this.x1, this.y1, this.x2, this.y2);
        grad.addColorStop(0, this.state ? `hsl(${hue}, 80%, ${30 + pulse * 20}%)` : '#3a3f52');
        grad.addColorStop(1, this.state ? `hsl(${hue + 20}, 80%, ${40 + pulse * 20}%)` : '#2b3044');

        ctx.save();
        ctx.lineWidth = this.state ? 3 : 2;
        ctx.strokeStyle = grad;
        ctx.shadowBlur = glow;
        ctx.shadowColor = this.state ? `hsl(${hue}, 80%, 55%)` : 'transparent';
        ctx.setLineDash(this.state ? [10, 8] : []);
        ctx.lineDashOffset = this.state ? -time / 40 : 0;
        ctx.beginPath();
        ctx.moveTo(this.x1, this.y1);
        ctx.lineTo(this.x2, this.y2);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.fillStyle = this.state ? `hsl(${hue}, 80%, 60%)` : '#4a5066';
        ctx.beginPath();
        ctx.arc(this.x1, this.y1, 3, 0, Math.PI * 2);
        ctx.arc(this.x2, this.y2, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

export class Component {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.width = 2; // in grid units
        this.height = 2;
        this.rotation = 0;
        this.inputs = []; // Array of {x, y (relative), id}
        this.outputs = []; // Array of {x, y (relative), value}
        this.state = {};
        this.isInteractive = false;
        this.locked = false;
    }

    hitTest(x, y) {
        // Simple bounding box
        // Assuming center origin or top-left? Let's use center for rotation, but top-left is easier for grid.
        // Let's use center.
        const halfW = (this.width * 20) / 2;
        const halfH = (this.height * 20) / 2;
        return x >= this.x - halfW && x <= this.x + halfW &&
            y >= this.y - halfH && y <= this.y + halfH;
    }

    getInputs() {
        return this.inputs.map(i => ({
            x: this.x + i.x * 20,
            y: this.y + i.y * 20,
            id: i.id
        }));
    }

    getOutputs() {
        return this.outputs.map(o => ({
            x: this.x + o.x * 20,
            y: this.y + o.y * 20,
            value: o.value
        }));
    }

    setInput(id, value) {
        // To be implemented by subclasses or generic handler
    }

    resetInputs() {
        // Reset internal input states
    }

    compute() {
        // Update outputs based on inputs
    }

    toggle() {
        // For interactive components
    }

    draw(ctx, gridSize) {
        // Generic box draw
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = this.locked ? 'rgba(255,255,255,0.06)' : '#333';
        ctx.strokeStyle = this.locked ? 'rgba(108,242,156,0.6)' : '#fff';
        ctx.lineWidth = this.locked ? 2.5 : 2;
        const w = this.width * gridSize;
        const h = this.height * gridSize;
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeRect(-w / 2, -h / 2, w, h);

        // Draw text
        ctx.fillStyle = '#fff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.type, 0, 0);

        // Draw pins
        this.drawPins(ctx, gridSize);

        ctx.restore();
    }

    drawPins(ctx, gridSize) {
        // Inputs
        ctx.fillStyle = '#00f';
        this.inputs.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x * gridSize, p.y * gridSize, 3, 0, Math.PI * 2);
            ctx.fill();
        });

        // Outputs
        ctx.fillStyle = '#f00';
        this.outputs.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x * gridSize, p.y * gridSize, 3, 0, Math.PI * 2);
            ctx.fill();
        });
    }
}

// --- Sources ---

export class VCC extends Component {
    constructor(x, y) {
        super(x, y, 'VCC');
        this.width = 1;
        this.height = 1;
        this.outputs = [{ x: 0, y: 0.5, value: true }];
    }

    draw(ctx, gridSize) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Draw VCC symbol
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 10); // Pin down
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-10, -5);
        ctx.lineTo(10, -5);
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('5V', 0, -15);

        ctx.restore();
    }
}

export class GND extends Component {
    constructor(x, y) {
        super(x, y, 'GND');
        this.width = 1;
        this.height = 1;
        this.outputs = [{ x: 0, y: -0.5, value: false }];
    }

    draw(ctx, gridSize) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Draw GND symbol
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -10); // Pin up
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(10, 0);
        ctx.moveTo(-6, 4);
        ctx.lineTo(6, 4);
        ctx.moveTo(-2, 8);
        ctx.lineTo(2, 8);
        ctx.stroke();

        ctx.restore();
    }
}

export class Clock extends Component {
    constructor(x, y) {
        super(x, y, 'Clock');
        this.width = 2;
        this.height = 2;
        this.outputs = [{ x: 1, y: 0, value: false }];
        this.frequency = 10; // ticks per cycle
    }

    update(tickCount) {
        const halfCycle = Math.floor(this.frequency / 2);
        this.outputs[0].value = (tickCount % this.frequency) < halfCycle;
    }
}

// --- Inputs ---

export class Switch extends Component {
    constructor(x, y) {
        super(x, y, 'Switch');
        this.width = 2;
        this.height = 1;
        this.outputs = [{ x: 1, y: 0, value: false }];
        this.isInteractive = true;
        this.isOn = false;
    }

    toggle() {
        this.isOn = !this.isOn;
        this.outputs[0].value = this.isOn;
    }

    draw(ctx, gridSize) {
        super.draw(ctx, gridSize);
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = this.isOn ? '#0f0' : '#555';
        ctx.fillRect(-5, -5, 10, 10);
        ctx.restore();
    }
}

export class Button extends Component {
    constructor(x, y) {
        super(x, y, 'Button');
        this.width = 2;
        this.height = 2;
        this.outputs = [{ x: 1, y: 0, value: false }];
        this.isInteractive = true;
        this.isPressed = false;
    }

    toggle() {
        // Momentary - this logic needs to be handled by mouse down/up in engine really
        // For now, let's make it toggle for simplicity or use a timeout
        this.isPressed = true;
        this.outputs[0].value = true;
        setTimeout(() => {
            this.isPressed = false;
            this.outputs[0].value = false;
        }, 200);
    }

    draw(ctx, gridSize) {
        super.draw(ctx, gridSize);
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = this.isPressed ? '#f00' : '#800';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// --- Outputs ---

export class LED extends Component {
    constructor(x, y) {
        super(x, y, 'LED');
        this.width = 1;
        this.height = 1;
        this.inputs = [{ x: 0, y: 0.5, id: 'in' }];
        this.isOn = false;
    }

    setInput(id, value) {
        if (id === 'in') this.isOn = value;
    }

    draw(ctx, gridSize) {
        ctx.save();
        ctx.translate(this.x, this.y);
        const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, 10);
        grad.addColorStop(0, this.isOn ? '#ff8fb1' : '#2a1a26');
        grad.addColorStop(1, this.isOn ? '#ff2e63' : '#120910');
        ctx.fillStyle = grad;
        ctx.shadowBlur = this.isOn ? 18 : 0;
        ctx.shadowColor = this.isOn ? '#ff8fb1' : 'transparent';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

export class Display extends Component {
    constructor(x, y) {
        super(x, y, 'Display');
        this.width = 3;
        this.height = 4;
        // 7 segment inputs: a,b,c,d,e,f,g
        this.inputs = [
            { x: -1.5, y: -1.5, id: 'a' },
            { x: -1.5, y: -0.5, id: 'b' },
            { x: -1.5, y: 0.5, id: 'c' },
            { x: -1.5, y: 1.5, id: 'd' },
            // Simplified: just one input for now to show on/off or maybe 4 bit hex later
            // Let's do a simple 1-bit display for now
            { x: -1.5, y: 0, id: 'val' }
        ];
        this.value = false;
    }

    setInput(id, value) {
        if (id === 'val') this.value = value;
    }

    draw(ctx, gridSize) {
        super.draw(ctx, gridSize);
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = '#000';
        ctx.fillRect(-20, -30, 40, 60);

        ctx.fillStyle = this.value ? '#0f0' : '#111';
        ctx.font = '40px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.value ? '1' : '0', 0, 0);

        ctx.restore();
    }
}

// --- Gates ---

export class ANDGate extends Component {
    constructor(x, y) {
        super(x, y, 'AND');
        this.width = 3;
        this.height = 2;
        this.inputs = [
            { x: -1.5, y: -0.5, id: 'a' },
            { x: -1.5, y: 0.5, id: 'b' }
        ];
        this.outputs = [{ x: 1.5, y: 0, value: false }];
        this.inA = false;
        this.inB = false;
    }

    setInput(id, value) {
        if (id === 'a') this.inA = value;
        if (id === 'b') this.inB = value;
    }

    compute() {
        this.outputs[0].value = this.inA && this.inB;
    }
}

export class ORGate extends Component {
    constructor(x, y) {
        super(x, y, 'OR');
        this.width = 3;
        this.height = 2;
        this.inputs = [
            { x: -1.5, y: -0.5, id: 'a' },
            { x: -1.5, y: 0.5, id: 'b' }
        ];
        this.outputs = [{ x: 1.5, y: 0, value: false }];
        this.inA = false;
        this.inB = false;
    }

    setInput(id, value) {
        if (id === 'a') this.inA = value;
        if (id === 'b') this.inB = value;
    }

    compute() {
        this.outputs[0].value = this.inA || this.inB;
    }
}

export class NOTGate extends Component {
    constructor(x, y) {
        super(x, y, 'NOT');
        this.width = 2;
        this.height = 1;
        this.inputs = [{ x: -1, y: 0, id: 'a' }];
        this.outputs = [{ x: 1, y: 0, value: true }];
        this.inA = false;
    }

    setInput(id, value) {
        if (id === 'a') this.inA = value;
    }

    compute() {
        this.outputs[0].value = !this.inA;
    }

    draw(ctx, gridSize) {
        // Custom triangle shape
        super.draw(ctx, gridSize);
    }
}

export class NANDGate extends Component {
    constructor(x, y) {
        super(x, y, 'NAND');
        this.width = 3;
        this.height = 2;
        this.inputs = [
            { x: -1.5, y: -0.5, id: 'a' },
            { x: -1.5, y: 0.5, id: 'b' }
        ];
        this.outputs = [{ x: 1.5, y: 0, value: true }];
        this.inA = false;
        this.inB = false;
    }

    setInput(id, value) {
        if (id === 'a') this.inA = value;
        if (id === 'b') this.inB = value;
    }

    compute() {
        this.outputs[0].value = !(this.inA && this.inB);
    }
}

export class NORGate extends Component {
    constructor(x, y) {
        super(x, y, 'NOR');
        this.width = 3;
        this.height = 2;
        this.inputs = [
            { x: -1.5, y: -0.5, id: 'a' },
            { x: -1.5, y: 0.5, id: 'b' }
        ];
        this.outputs = [{ x: 1.5, y: 0, value: true }];
        this.inA = false;
        this.inB = false;
    }

    setInput(id, value) {
        if (id === 'a') this.inA = value;
        if (id === 'b') this.inB = value;
    }

    compute() {
        this.outputs[0].value = !(this.inA || this.inB);
    }
}

export class XORGate extends Component {
    constructor(x, y) {
        super(x, y, 'XOR');
        this.width = 3;
        this.height = 2;
        this.inputs = [
            { x: -1.5, y: -0.5, id: 'a' },
            { x: -1.5, y: 0.5, id: 'b' }
        ];
        this.outputs = [{ x: 1.5, y: 0, value: false }];
        this.inA = false;
        this.inB = false;
    }

    setInput(id, value) {
        if (id === 'a') this.inA = value;
        if (id === 'b') this.inB = value;
    }

    compute() {
        this.outputs[0].value = (this.inA !== this.inB);
    }
}

export class XNORGate extends Component {
    constructor(x, y) {
        super(x, y, 'XNOR');
        this.width = 3;
        this.height = 2;
        this.inputs = [
            { x: -1.5, y: -0.5, id: 'a' },
            { x: -1.5, y: 0.5, id: 'b' }
        ];
        this.outputs = [{ x: 1.5, y: 0, value: true }];
        this.inA = false;
        this.inB = false;
    }

    setInput(id, value) {
        if (id === 'a') this.inA = value;
        if (id === 'b') this.inB = value;
    }

    compute() {
        this.outputs[0].value = (this.inA === this.inB);
    }
}

export class InputPin extends Component {
    constructor(x, y) {
        super(x, y, 'InputPin');
        this.width = 1;
        this.height = 1;
        this.outputs = [{ x: 0.5, y: 0, value: false }];
        this.label = 'In';
        this.value = false;
    }

    setValue(val) {
        this.value = val;
        this.outputs[0].value = val;
    }

    draw(ctx, gridSize) {
        super.draw(ctx, gridSize);
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = '#a8ffcf';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.label || 'IN', 0, 0);
        ctx.restore();
    }
}

export class OutputPin extends Component {
    constructor(x, y) {
        super(x, y, 'OutputPin');
        this.width = 1;
        this.height = 1;
        this.inputs = [{ x: -0.5, y: 0, id: 'in' }];
        this.label = 'Out';
        this.value = false;
    }

    setInput(id, value) {
        this.value = value;
    }

    draw(ctx, gridSize) {
        super.draw(ctx, gridSize);
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = this.value ? '#ff8fb1' : '#c7d3ff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.label || 'OUT', 0, 0);
        ctx.restore();
    }
}

export class Chip extends Component {
    constructor(x, y, definition) {
        super(x, y, definition.name);
        this.definition = definition;

        const inputCount = definition.inputs.length;
        const outputCount = definition.outputs.length;
        const maxPins = Math.max(inputCount, outputCount);

        this.width = 4;
        this.height = Math.max(2, maxPins + 1);

        // Setup pins
        this.inputs = definition.inputs.map((pin, i) => ({
            x: -this.width / 2,
            y: -this.height / 2 + 1 + i,
            id: pin.id
        }));

        this.outputs = definition.outputs.map((pin, i) => ({
            x: this.width / 2,
            y: -this.height / 2 + 1 + i,
            value: false,
            id: pin.id
        }));

        // Re-instantiate internal components
        this.internalComponents = definition.components.map(c => {
            let comp;
            switch (c.type) {
                case 'VCC': comp = new VCC(c.x, c.y); break;
                case 'GND': comp = new GND(c.x, c.y); break;
                case 'Clock': comp = new Clock(c.x, c.y); break;
                case 'Switch': comp = new Switch(c.x, c.y); break;
                case 'Button': comp = new Button(c.x, c.y); break;
                case 'LED': comp = new LED(c.x, c.y); break;
                case 'Display': comp = new Display(c.x, c.y); break;
                case 'AND': comp = new ANDGate(c.x, c.y); break;
                case 'OR': comp = new ORGate(c.x, c.y); break;
                case 'NOT': comp = new NOTGate(c.x, c.y); break;
                case 'NAND': comp = new NANDGate(c.x, c.y); break;
                case 'NOR': comp = new NORGate(c.x, c.y); break;
                case 'XOR': comp = new XORGate(c.x, c.y); break;
                case 'XNOR': comp = new XNORGate(c.x, c.y); break;
                case 'InputPin': comp = new InputPin(c.x, c.y); comp.id = c.id; break;
                case 'OutputPin': comp = new OutputPin(c.x, c.y); comp.id = c.id; break;
                case 'Chip':
                    if (c.definition) comp = new Chip(c.x, c.y, c.definition);
                    break;
            }
            return comp;
        }).filter(c => c);

        this.internalWires = definition.wires.map(w => new Wire(w.x1, w.y1, w.x2, w.y2));

        this.inputPins = this.internalComponents.filter(c => c.type === 'InputPin');
        this.outputPins = this.internalComponents.filter(c => c.type === 'OutputPin');
    }

    setInput(id, value) {
        const pin = this.inputPins.find(p => p.id === id);
        if (pin) {
            pin.setValue(value);
        }
    }

    update(tickCount) {
        this.internalComponents.forEach(c => {
            if (c.update) c.update(tickCount);
        });
    }

    evaluateInternal(evaluator) {
        evaluator(this.internalComponents, this.internalWires);
    }

    compute() {
        this.outputs.forEach(out => {
            const pin = this.outputPins.find(p => p.id === out.id);
            if (pin) {
                out.value = pin.value;
            }
        });
    }

    draw(ctx, gridSize) {
        super.draw(ctx, gridSize);
        // Draw label
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.type, 0, 0);
        ctx.restore();
    }
}
