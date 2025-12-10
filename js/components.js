export class Wire {
    constructor(x1, y1, x2, y2) {
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        this.state = false;
    }

    draw(ctx, gridSize, time = 0, mode = 'real') {
        const pulse = (Math.sin(time / 160) + 1) / 2;
        const hue = this.state ? 140 : 210;
        const glow = mode === 'real' && this.state ? 12 : 0;
        const grad = ctx.createLinearGradient(this.x1, this.y1, this.x2, this.y2);
        grad.addColorStop(0, this.state ? `hsl(${hue}, 80%, ${30 + pulse * 20}%)` : '#3a3f52');
        grad.addColorStop(1, this.state ? `hsl(${hue + 20}, 80%, ${40 + pulse * 20}%)` : '#2b3044');

        ctx.save();
        // Underlay to make routes readable even when idle
        ctx.lineWidth = 4;
        ctx.strokeStyle = mode === 'wireframe' ? 'rgba(122,163,255,0.25)' : 'rgba(255,255,255,0.06)';
        ctx.beginPath();
        ctx.moveTo(this.x1, this.y1);
        ctx.lineTo(this.x2, this.y2);
        ctx.stroke();

        ctx.lineWidth = this.state ? 3 : 2;
        ctx.strokeStyle = mode === 'wireframe' ? '#7aa3ff' : grad;
        ctx.shadowBlur = glow;
        ctx.shadowColor = this.state && mode === 'real' ? `hsl(${hue}, 80%, 55%)` : 'transparent';
        ctx.setLineDash(this.state && mode === 'real' ? [12, 6] : []);
        ctx.lineDashOffset = this.state && mode === 'real' ? -time / 32 : 0;
        ctx.beginPath();
        ctx.moveTo(this.x1, this.y1);
        ctx.lineTo(this.x2, this.y2);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.fillStyle = this.state ? (mode === 'wireframe' ? '#7aa3ff' : `hsl(${hue}, 80%, 60%)`) : '#4a5066';
        ctx.beginPath();
        ctx.arc(this.x1, this.y1, 3, 0, Math.PI * 2);
        ctx.arc(this.x2, this.y2, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Base component class
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
        if (this.inputs) {
            this.inputs.forEach(inp => this.setInput(inp.id, false));
        }
    }

    compute() { }
    toggle() { }

    draw(ctx, gridSize, mode = 'real') {
        ctx.save();
        ctx.translate(this.x, this.y);
        if (mode === 'wireframe') {
            ctx.fillStyle = 'rgba(0,0,0,0)';
            ctx.strokeStyle = this.locked ? 'rgba(108,242,156,0.6)' : '#7aa3ff';
        } else {
            ctx.fillStyle = this.locked ? 'rgba(255,255,255,0.06)' : '#333';
            ctx.strokeStyle = this.locked ? 'rgba(108,242,156,0.6)' : '#fff';
        }
        ctx.lineWidth = this.locked ? 2.5 : 2;
        const w = this.width * gridSize;
        const h = this.height * gridSize;
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeRect(-w / 2, -h / 2, w, h);

        ctx.fillStyle = mode === 'wireframe' ? '#b7c7ff' : '#fff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.type, 0, 0);

        this.drawPins(ctx, gridSize, mode);
        ctx.restore();
    }

    drawPins(ctx, gridSize, mode = 'real') {
        ctx.lineWidth = 1.6;
        this.inputs.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x * gridSize, p.y * gridSize, 4, 0, Math.PI * 2);
            ctx.fillStyle = mode === 'wireframe' ? '#7aa3ff' : '#6ac8ff';
            ctx.strokeStyle = mode === 'wireframe' ? 'rgba(122,163,255,0.6)' : 'rgba(255,255,255,0.25)';
            ctx.fill();
            ctx.stroke();
        });

        this.outputs.forEach(p => {
            const active = !!p.value;
            ctx.beginPath();
            ctx.arc(p.x * gridSize, p.y * gridSize, 4, 0, Math.PI * 2);
            ctx.fillStyle = active ? (mode === 'wireframe' ? '#7cffb7' : '#6cf29c') : (mode === 'wireframe' ? '#5a6a8a' : '#4a5066');
            ctx.strokeStyle = mode === 'wireframe' ? 'rgba(124,255,183,0.45)' : 'rgba(255,255,255,0.2)';
            ctx.fill();
            ctx.stroke();
        });
    }
}

function drawGateShape(ctx, { w, h, variant, mode, accent = '#6cf29c', active = false, bubble = false, label = '' }) {
    const stroke = mode === 'wireframe' ? '#7aa3ff' : accent;
    const fill = mode === 'wireframe' ? 'rgba(0,0,0,0)' : (active ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.04)');
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.fillStyle = fill;
    ctx.lineWidth = 2.2;
    ctx.shadowBlur = active && mode === 'real' ? 12 : 0;
    ctx.shadowColor = active && mode === 'real' ? accent : 'transparent';

    const halfW = w / 2;
    const halfH = h / 2;

    const drawAnd = () => {
        ctx.beginPath();
        ctx.moveTo(-halfW, -halfH);
        ctx.lineTo(0, -halfH);
        ctx.arc(0, 0, halfH, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(-halfW, halfH);
        ctx.closePath();
    };

    const drawOr = () => {
        const inset = halfH * 0.6;
        ctx.beginPath();
        ctx.moveTo(-halfW + inset, -halfH);
        ctx.quadraticCurveTo(-halfW, 0, -halfW + inset, halfH);
        ctx.quadraticCurveTo(halfW, 0, -halfW + inset, -halfH);
        ctx.closePath();
    };

    switch (variant) {
        case 'and':
            drawAnd();
            break;
        case 'or':
        case 'xor':
            drawOr();
            break;
        default:
            // Fallback rounded box
            const radius = 8;
            ctx.beginPath();
            ctx.moveTo(-halfW + radius, -halfH);
            ctx.lineTo(halfW - radius, -halfH);
            ctx.quadraticCurveTo(halfW, -halfH, halfW, -halfH + radius);
            ctx.lineTo(halfW, halfH - radius);
            ctx.quadraticCurveTo(halfW, halfH, halfW - radius, halfH);
            ctx.lineTo(-halfW + radius, halfH);
            ctx.quadraticCurveTo(-halfW, halfH, -halfW, halfH - radius);
            ctx.lineTo(-halfW, -halfH + radius);
            ctx.quadraticCurveTo(-halfW, -halfH, -halfW + radius, -halfH);
            ctx.closePath();
            break;
    }

    ctx.fill();
    ctx.stroke();

    if (variant === 'xor') {
        // Draw the leading OR curve offset for XOR distinction
        const inset = halfH * 0.6 - 8;
        ctx.beginPath();
        ctx.moveTo(-halfW + inset, -halfH);
        ctx.quadraticCurveTo(-halfW - 6, 0, -halfW + inset, halfH);
        ctx.stroke();
    }

    if (bubble) {
        ctx.beginPath();
        ctx.arc(halfW, 0, 6, 0, Math.PI * 2);
        ctx.fillStyle = mode === 'wireframe' ? 'rgba(0,0,0,0)' : '#0c0f1a';
        ctx.fill();
        ctx.stroke();
    }

    if (label) {
        ctx.fillStyle = mode === 'wireframe' ? '#b7c7ff' : '#e6ecff';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, -w * 0.05, 0);
    }

    ctx.restore();
}

export class Protoboard extends Component {
    constructor(x, y, size = 'medium') {
        super(x, y, 'Protoboard');
        const dims = {
            small: { w: 8, h: 6 },
            medium: { w: 12, h: 8 },
            large: { w: 16, h: 10 }
        }[size] || { w: 12, h: 8 };
        this.width = dims.w;
        this.height = dims.h;
        this.size = size;
        this.locked = true;
    }

    draw(ctx, gridSize, mode = 'real') {
        ctx.save();
        ctx.translate(this.x, this.y);
        const w = this.width * gridSize;
        const h = this.height * gridSize;
        const baseColor = mode === 'wireframe' ? '#304066' : '#1c2436';
        ctx.fillStyle = baseColor;
        ctx.strokeStyle = mode === 'wireframe' ? '#5ad1ff' : 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 2;
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeRect(-w / 2, -h / 2, w, h);

        // Draw holes grid
        const cols = Math.floor(this.width * 5);
        const rows = Math.floor(this.height * 4);
        ctx.fillStyle = mode === 'wireframe' ? '#7aa3ff' : '#0f1626';
        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                const px = -w / 2 + (i + 0.5) * (w / cols);
                const py = -h / 2 + (j + 0.5) * (h / rows);
                ctx.beginPath();
                ctx.arc(px, py, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        // Label size
        ctx.fillStyle = mode === 'wireframe' ? '#b7c7ff' : 'rgba(255,255,255,0.6)';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.size.toUpperCase(), 0, h / 2 - 12);
        ctx.restore();
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

    draw(ctx, gridSize, mode = 'real') {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Draw VCC symbol
        ctx.strokeStyle = mode === 'wireframe' ? '#7aa3ff' : '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 10); // Pin down
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-10, -5);
        ctx.lineTo(10, -5);
        ctx.stroke();

        ctx.fillStyle = mode === 'wireframe' ? '#b7c7ff' : '#fff';
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

    draw(ctx, gridSize, mode = 'real') {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Draw GND symbol
        ctx.strokeStyle = mode === 'wireframe' ? '#7aa3ff' : '#fff';
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

    resetInputs() {
        // No inputs to reset
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

    draw(ctx, gridSize, mode = 'real') {
        super.draw(ctx, gridSize, mode);
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = mode === 'wireframe' ? (this.isOn ? '#7cffb7' : 'rgba(0,0,0,0)') : (this.isOn ? '#0f0' : '#555');
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

    draw(ctx, gridSize, mode = 'real') {
        super.draw(ctx, gridSize, mode);
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = mode === 'wireframe' ? (this.isPressed ? '#ff8fb1' : 'rgba(0,0,0,0)') : (this.isPressed ? '#f00' : '#800');
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

    draw(ctx, gridSize, mode = 'real') {
        ctx.save();
        ctx.translate(this.x, this.y);
        if (mode === 'wireframe') {
            ctx.strokeStyle = this.isOn ? '#ff8fb1' : '#7aa3ff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, 10);
            grad.addColorStop(0, this.isOn ? '#ff8fb1' : '#2a1a26');
            grad.addColorStop(1, this.isOn ? '#ff2e63' : '#120910');
            ctx.fillStyle = grad;
            ctx.shadowBlur = this.isOn ? 18 : 0;
            ctx.shadowColor = this.isOn ? '#ff8fb1' : 'transparent';
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.fill();
        }
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

    resetInputs() {
        this.value = false;
    }

    draw(ctx, gridSize, mode = 'real') {
        super.draw(ctx, gridSize, mode);
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = mode === 'wireframe' ? 'rgba(0,0,0,0)' : '#000';
        ctx.strokeStyle = mode === 'wireframe' ? '#7aa3ff' : 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 2;
        ctx.fillRect(-20, -30, 40, 60);
        ctx.strokeRect(-20, -30, 40, 60);

        ctx.fillStyle = this.value ? (mode === 'wireframe' ? '#7cffb7' : '#0f0') : (mode === 'wireframe' ? '#4f5b75' : '#111');
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

    resetInputs() {
        this.inA = false;
        this.inB = false;
    }

    draw(ctx, gridSize, mode = 'real') {
        ctx.save();
        ctx.translate(this.x, this.y);
        drawGateShape(ctx, {
            w: this.width * gridSize,
            h: this.height * gridSize,
            variant: 'and',
            mode,
            accent: '#6cf29c',
            active: !!this.outputs[0].value,
            label: '&'
        });
        this.drawPins(ctx, gridSize, mode);
        ctx.restore();
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

    resetInputs() {
        this.inA = false;
        this.inB = false;
    }

    draw(ctx, gridSize, mode = 'real') {
        ctx.save();
        ctx.translate(this.x, this.y);
        drawGateShape(ctx, {
            w: this.width * gridSize,
            h: this.height * gridSize,
            variant: 'or',
            mode,
            accent: '#6ac8ff',
            active: !!this.outputs[0].value,
            label: '>=1'
        });
        this.drawPins(ctx, gridSize, mode);
        ctx.restore();
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

    draw(ctx, gridSize, mode = 'real') {
        const active = !!this.outputs[0].value;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.strokeStyle = mode === 'wireframe' ? '#7aa3ff' : '#ff8fb1';
        ctx.fillStyle = mode === 'wireframe' ? 'rgba(0,0,0,0)' : (active ? 'rgba(255,143,177,0.12)' : '#1b1b24');
        ctx.lineWidth = 2.2;
        ctx.shadowBlur = active && mode === 'real' ? 10 : 0;
        ctx.shadowColor = active && mode === 'real' ? '#ff8fb1' : 'transparent';

        ctx.beginPath();
        ctx.moveTo(-12, -12);
        ctx.lineTo(12, 0);
        ctx.lineTo(-12, 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(15, 0, 4, 0, Math.PI * 2);
        ctx.fillStyle = mode === 'wireframe' ? '#7aa3ff' : '#ff8fb1';
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = mode === 'wireframe' ? '#b7c7ff' : '#e6ecff';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('NOT', -2, 0);

        this.drawPins(ctx, gridSize, mode);
        ctx.restore();
    }

    resetInputs() {
        this.inA = false;
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

    resetInputs() {
        this.inA = false;
        this.inB = false;
    }

    draw(ctx, gridSize, mode = 'real') {
        ctx.save();
        ctx.translate(this.x, this.y);
        drawGateShape(ctx, {
            w: this.width * gridSize,
            h: this.height * gridSize,
            variant: 'and',
            mode,
            accent: '#6cf29c',
            active: !!this.outputs[0].value,
            bubble: true,
            label: '!&'
        });
        this.drawPins(ctx, gridSize, mode);
        ctx.restore();
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

    resetInputs() {
        this.inA = false;
        this.inB = false;
    }

    draw(ctx, gridSize, mode = 'real') {
        ctx.save();
        ctx.translate(this.x, this.y);
        drawGateShape(ctx, {
            w: this.width * gridSize,
            h: this.height * gridSize,
            variant: 'or',
            mode,
            accent: '#ffb347',
            active: !!this.outputs[0].value,
            bubble: true,
            label: '!>=1'
        });
        this.drawPins(ctx, gridSize, mode);
        ctx.restore();
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

    resetInputs() {
        this.inA = false;
        this.inB = false;
    }

    draw(ctx, gridSize, mode = 'real') {
        ctx.save();
        ctx.translate(this.x, this.y);
        drawGateShape(ctx, {
            w: this.width * gridSize,
            h: this.height * gridSize,
            variant: 'xor',
            mode,
            accent: '#c58bff',
            active: !!this.outputs[0].value,
            label: '^'
        });
        this.drawPins(ctx, gridSize, mode);
        ctx.restore();
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

    resetInputs() {
        this.inA = false;
        this.inB = false;
    }

    draw(ctx, gridSize, mode = 'real') {
        ctx.save();
        ctx.translate(this.x, this.y);
        drawGateShape(ctx, {
            w: this.width * gridSize,
            h: this.height * gridSize,
            variant: 'xor',
            mode,
            accent: '#c58bff',
            active: !!this.outputs[0].value,
            bubble: true,
            label: '=='
        });
        this.drawPins(ctx, gridSize, mode);
        ctx.restore();
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

    compute() {
        this.outputs[0].value = this.value;
    }

    resetInputs() {
        // Input pins keep their value; no-op
    }

    draw(ctx, gridSize, mode = 'real') {
        super.draw(ctx, gridSize, mode);
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = mode === 'wireframe' ? '#7aa3ff' : '#a8ffcf';
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

    resetInputs() {
        this.value = false;
    }

    draw(ctx, gridSize, mode = 'real') {
        super.draw(ctx, gridSize, mode);
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = this.value ? '#ff8fb1' : (mode === 'wireframe' ? '#b7c7ff' : '#c7d3ff');
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

    resetInputs() {
        this.inputPins.forEach(pin => pin.setValue(false));
    }

    draw(ctx, gridSize, mode = 'real') {
        super.draw(ctx, gridSize, mode);
        // Draw label
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = mode === 'wireframe' ? '#b7c7ff' : '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.type, 0, 0);
        ctx.restore();
    }
}
