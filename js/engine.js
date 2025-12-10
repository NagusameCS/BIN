import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3.70.0/dist/phaser.esm.js';
import { Wire } from './components.js';

// Phaser-powered renderer and interaction layer for the circuit sandbox.
export class Engine {
    constructor(parentEl, simulation) {
        this.parent = typeof parentEl === 'string' ? document.getElementById(parentEl) : parentEl;
        this.simulation = simulation;
        this.gridSize = 20;
        this.currentTool = 'Select';
        this.renderMode = 'real';

        this.isDragging = false;
        this.selectedComponent = null;
        this.lastPointer = { x: 0, y: 0 };
        this.wireStart = null;
        this.tempWireEnd = null;
        this.labels = [];

        this.game = this.createGame();
        window.addEventListener('resize', () => this.handleResize());
    }

    createGame() {
        const engine = this;
        const width = this.parent.clientWidth || 960;
        const height = this.parent.clientHeight || 640;

        return new Phaser.Game({
            type: Phaser.WEBGL,
            parent: this.parent,
            width,
            height,
            backgroundColor: '#0a0d14',
            scene: {
                create() {
                    engine.scene = this;
                    engine.graphics = this.add.graphics();
                    this.input.on('pointerdown', p => engine.pointerDown(p));
                    this.input.on('pointermove', p => engine.pointerMove(p));
                    this.input.on('pointerup', p => engine.pointerUp(p));
                },
                update(time) {
                    if (engine.simulation.isRunning) {
                        engine.simulation.tick();
                    }
                    engine.render(time);
                }
            }
        });
    }

    handleResize() {
        if (!this.game || !this.parent) return;
        const w = this.parent.clientWidth;
        const h = this.parent.clientHeight;
        this.game.scale.resize(w, h);
    }

    setTool(tool) {
        this.currentTool = tool;
        this.wireStart = null;
    }

    setRenderMode(mode) {
        this.renderMode = mode === 'wireframe' ? 'wireframe' : 'real';
    }

    pointerToGrid(pointer) {
        const x = pointer.x;
        const y = pointer.y;
        return {
            x: Math.round(x / this.gridSize) * this.gridSize,
            y: Math.round(y / this.gridSize) * this.gridSize,
            rawX: x,
            rawY: y
        };
    }

    collectAnchors() {
        const anchors = [];
        this.simulation.components.forEach(c => {
            c.getInputs().forEach(p => anchors.push({ x: p.x, y: p.y }));
            c.getOutputs().forEach(p => anchors.push({ x: p.x, y: p.y }));
        });
        this.simulation.wires.forEach(w => anchors.push({ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }));
        return anchors;
    }

    snapToAnchor(pos, radius = 12) {
        const anchors = this.collectAnchors();
        let best = null;
        let bestDist = Infinity;
        anchors.forEach(a => {
            const d = Math.hypot(a.x - pos.x, a.y - pos.y);
            if (d < radius && d < bestDist) {
                best = { x: a.x, y: a.y };
                bestDist = d;
            }
        });
        return best;
    }

    pointerDown(pointer) {
        const pos = this.pointerToGrid(pointer);
        this.lastPointer = pos;

        if (this.currentTool === 'Select') {
            const hit = this.simulation.findComponentAt(pos.x, pos.y);
            if (hit) {
                if (hit.isInteractive) {
                    hit.toggle();
                    this.simulation.update();
                } else if (!hit.locked) {
                    this.isDragging = true;
                    this.selectedComponent = hit;
                }
            }
        } else if (this.currentTool === 'Wire') {
            const snap = this.snapToAnchor(pos) || pos;
            this.wireStart = snap;
            this.tempWireEnd = snap;
        } else if (this.currentTool === 'Delete') {
            this.simulation.removeAt(pos.x, pos.y);
        } else {
            this.simulation.addComponent(this.currentTool, pos.x, pos.y);
        }
    }

    pointerMove(pointer) {
        const pos = this.pointerToGrid(pointer);
        this.lastPointer = pos;

        if (this.isDragging && this.selectedComponent) {
            this.selectedComponent.x = pos.x;
            this.selectedComponent.y = pos.y;
            this.simulation.update();
        } else if (this.currentTool === 'Wire' && this.wireStart) {
            this.tempWireEnd = this.snapToAnchor(pos) || pos;
        }
    }

    pointerUp(pointer) {
        const pos = this.pointerToGrid(pointer);

        if (this.isDragging) {
            this.isDragging = false;
            this.selectedComponent = null;
            this.simulation.update();
        } else if (this.currentTool === 'Wire' && this.wireStart) {
            const end = this.snapToAnchor(pos) || pos;
            this.simulation.addWire(this.wireStart.x, this.wireStart.y, end.x, end.y);
            this.wireStart = null;
            this.tempWireEnd = null;
        }
    }

    // Phaser drives the loop, but we keep the API for compatibility
    start() { }

    render(time = 0) {
        if (!this.graphics || !this.scene) return;
        const g = this.graphics;
        const width = this.scene.scale.width;
        const height = this.scene.scale.height;

        // Clear
        g.clear();
        g.fillStyle(this.renderMode === 'wireframe' ? 0x0b0f1f : 0x0d111b, 1);
        g.fillRect(0, 0, width, height);

        // Grid
        const minorColor = this.renderMode === 'wireframe' ? 0x30354a : 0x252a37;
        const majorColor = this.renderMode === 'wireframe' ? 0x7aa3ff : 0x7be0a4;
        g.lineStyle(1, minorColor, 0.6);
        for (let x = 0; x <= width; x += this.gridSize) {
            g.lineBetween(x, 0, x, height);
        }
        for (let y = 0; y <= height; y += this.gridSize) {
            g.lineBetween(0, y, width, y);
        }
        g.lineStyle(1.4, majorColor, 0.22);
        const majorStep = this.gridSize * 5;
        for (let x = 0; x <= width; x += majorStep) {
            g.lineBetween(x, 0, x, height);
        }
        for (let y = 0; y <= height; y += majorStep) {
            g.lineBetween(0, y, width, y);
        }

        // Wires
        const now = time;
        this.simulation.wires.forEach(wire => {
            const pulse = (Math.sin(now / 320) + 1) / 2;
            const active = wire.state;
            const color = this.renderMode === 'wireframe'
                ? 0x7aa3ff
                : (active ? 0x6cf29c : 0x3a3f52);
            g.lineStyle(active ? 3 : 2, color, 1);
            g.lineBetween(wire.x1, wire.y1, wire.x2, wire.y2);
            const capColor = active ? color : 0x4a5066;
            g.fillStyle(capColor, 1);
            g.fillCircle(wire.x1, wire.y1, 3 + pulse * (active ? 1 : 0));
            g.fillCircle(wire.x2, wire.y2, 3 + pulse * (active ? 1 : 0));
        });

        // Temp wire
        if (this.wireStart && this.tempWireEnd) {
            g.lineStyle(2, this.renderMode === 'wireframe' ? 0x7aa3ff : 0x888888, 0.9);
            g.lineBetween(this.wireStart.x, this.wireStart.y, this.tempWireEnd.x, this.tempWireEnd.y);
        }

        // Clear existing labels
        this.labels.forEach(t => t.destroy());
        this.labels = [];

        // Components
        this.simulation.components.forEach(comp => {
            const w = (comp.width || 2) * this.gridSize;
            const h = (comp.height || 2) * this.gridSize;
            const x = comp.x - w / 2;
            const y = comp.y - h / 2;
            const isLocked = comp.locked;
            const baseColor = this.renderMode === 'wireframe' ? 0x0a0d14 : (isLocked ? 0x1b2c32 : 0x1f2d3b);
            const strokeColor = isLocked ? 0x6cf29c : 0xb7c7ff;
            g.fillStyle(baseColor, 0.95);
            g.lineStyle(isLocked ? 2.4 : 2, strokeColor, 0.9);
            g.fillRoundedRect(x, y, w, h, 8);
            g.strokeRoundedRect(x, y, w, h, 8);

            // Pins
            const pinActive = this.renderMode === 'wireframe' ? 0x7aa3ff : 0x6ac8ff;
            const pinInactive = this.renderMode === 'wireframe' ? 0x5a6a8a : 0x4a5066;
            comp.getInputs().forEach(pin => {
                g.fillStyle(pinInactive, 1);
                g.fillCircle(pin.x, pin.y, 4);
            });
            comp.getOutputs().forEach(pin => {
                const active = !!pin.value;
                g.fillStyle(active ? (this.renderMode === 'wireframe' ? 0x7cffb7 : 0x6cf29c) : pinInactive, 1);
                g.fillCircle(pin.x, pin.y, 4.5);
            });

            // Label text
            if (this.scene) {
                const label = this.scene.add.text(comp.x, comp.y, comp.type, {
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '12px',
                    color: '#e6edf7'
                }).setOrigin(0.5);
                this.labels.push(label);
            }
        });

        // Ghost preview when placing
        if (this.currentTool !== 'Select' && this.currentTool !== 'Wire' && this.currentTool !== 'Delete') {
            const ghostColor = this.renderMode === 'wireframe' ? 0x96b4ff : 0x6cf29c;
            g.fillStyle(ghostColor, 0.4);
            g.fillRect(this.lastPointer.x - 10, this.lastPointer.y - 10, 20, 20);
        }
    }
}
