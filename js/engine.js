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
        this.hudGroups = [];
        this.hudButtons = {};
        this.hudBg = null;

        this.game = this.createGame();
        window.addEventListener('resize', () => this.handleResize());
        window.addEventListener('keydown', e => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedComponent && !this.selectedComponent.locked) {
                const { x, y } = this.selectedComponent;
                this.simulation.removeAt(x, y);
                this.selectedComponent = null;
            }
        });
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
            resolution: window.devicePixelRatio || 1,
            antialias: true,
            backgroundColor: '#0a0d14',
            scene: {
                create() {
                    engine.scene = this;
                    engine.graphics = this.add.graphics();
                    if (this.input.mouse) this.input.mouse.disableContextMenu();
                    this.input.on('pointerdown', p => engine.pointerDown(p));
                    this.input.on('pointermove', p => engine.pointerMove(p));
                    this.input.on('pointerup', p => engine.pointerUp(p));
                    engine.buildHUD();
                    engine.layoutHUD();
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
        const w = this.parent.clientWidth || window.innerWidth;
        const h = this.parent.clientHeight || window.innerHeight;
        this.game.scale.resize(w, h);
        this.layoutHUD();
    }

    setTool(tool) {
        this.currentTool = tool;
        this.wireStart = null;
        const keyMap = {
            Select: 'tool-select',
            Wire: 'tool-wire',
            Delete: 'tool-delete',
            VCC: 'tool-vcc',
            GND: 'tool-gnd',
            Clock: 'tool-clk',
            Switch: 'tool-switch',
            Button: 'tool-button',
            LED: 'tool-led',
            Display: 'tool-display',
            AND: 'tool-and',
            OR: 'tool-or',
            NOT: 'tool-not',
            NAND: 'tool-nand',
            NOR: 'tool-nor',
            XOR: 'tool-xor',
            XNOR: 'tool-xnor',
            ProtoSmall: 'tool-board-s',
            ProtoMedium: 'tool-board-m',
            ProtoLarge: 'tool-board-l',
            InputPin: 'tool-in',
            OutputPin: 'tool-out'
        };
        const hudKey = keyMap[tool];
        if (hudKey) this.setActiveButton('tool', hudKey);
    }

    setRenderMode(mode) {
        this.renderMode = mode === 'wireframe' ? 'wireframe' : 'real';
        const key = this.renderMode === 'wireframe' ? 'view-wire' : 'view-real';
        this.setActiveButton('view', key);
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

    snapToAnchor(pos, radius = 16) {
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
        if (pointer.event && pointer.event.cancelBubble) return;
        if (this.isPointerInHUD(pointer)) return;
        const pos = this.pointerToGrid(pointer);
        this.lastPointer = pos;

        // Right-click quick delete
        if (pointer.rightButtonDown()) {
            this.simulation.removeAt(pos.x, pos.y);
            return;
        }

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
        if (this.isPointerInHUD(pointer)) return;
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
        if (this.isPointerInHUD(pointer)) return;
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
        const minorColor = this.renderMode === 'wireframe' ? 0x4a536b : 0x1f2532;
        const majorColor = this.renderMode === 'wireframe' ? 0x9fb5ff : 0x8be8b4;
        g.lineStyle(1, minorColor, 0.55);
        for (let x = 0; x <= width; x += this.gridSize) {
            g.lineBetween(x, 0, x, height);
        }
        for (let y = 0; y <= height; y += this.gridSize) {
            g.lineBetween(0, y, width, y);
        }
        g.lineStyle(1.4, majorColor, 0.3);
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
            const pulse = (Math.sin(now / 260) + 1) / 2;
            const active = wire.state;
            const color = this.renderMode === 'wireframe'
                ? 0x9fb5ff
                : (active ? 0x8af7b1 : 0x2f364b);
            const underColor = this.renderMode === 'wireframe' ? 0x23314d : 0x121722;
            g.lineStyle(active ? 4 : 3, underColor, 0.9);
            g.lineBetween(wire.x1, wire.y1, wire.x2, wire.y2);
            g.lineStyle(active ? 2.5 : 2, color, 1);
            g.lineBetween(wire.x1, wire.y1, wire.x2, wire.y2);
            const capColor = active ? color : 0x4a5066;
            g.fillStyle(capColor, 1);
            g.fillCircle(wire.x1, wire.y1, 3.5 + pulse * (active ? 1 : 0));
            g.fillCircle(wire.x2, wire.y2, 3.5 + pulse * (active ? 1 : 0));
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
            const baseColor = this.renderMode === 'wireframe' ? 0x0f1524 : (isLocked ? 0x1c2e35 : 0x243448);
            const strokeColor = isLocked ? 0x6cf29c : 0xb7c7ff;
            g.fillStyle(baseColor, 0.95);
            g.lineStyle(isLocked ? 2.4 : 2, strokeColor, 0.9);
            g.fillRoundedRect(x, y, w, h, 8);
            g.strokeRoundedRect(x, y, w, h, 8);

            // Pins
            const pinActive = this.renderMode === 'wireframe' ? 0x9fb5ff : 0x9cf7c8;
            const pinInactive = this.renderMode === 'wireframe' ? 0x5a6a8a : 0x3a4255;
            comp.getInputs().forEach(pin => {
                g.fillStyle(pinInactive, 1);
                g.fillCircle(pin.x, pin.y, 4);
            });
            comp.getOutputs().forEach(pin => {
                const active = !!pin.value;
                g.fillStyle(active ? (this.renderMode === 'wireframe' ? 0x9fb5ff : 0x9cf7c8) : pinInactive, 1);
                g.fillCircle(pin.x, pin.y, 4.5);
            });

            // Label text
            if (this.scene) {
                const label = this.scene.add.text(comp.x, comp.y, comp.type, {
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '12px',
                    color: '#e6edf7',
                    stroke: '#0a0d14',
                    strokeThickness: 3
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

    isPointerInHUD(pointer) {
        if (!this.hudBg || !this.scene) return false;
        const bounds = this.hudBg.getBounds();
        return Phaser.Geom.Rectangle.Contains(bounds, pointer.x, pointer.y);
    }

    buildHUD() {
        if (!this.scene) return;

        if (this.hudBg) this.hudBg.destroy();
        this.hudGroups.forEach(g => g.destroy());
        this.hudGroups = [];
        this.hudButtons = {};
        this.activeHudSelections = {};

        const scene = this.scene;
        this.hudBg = scene.add.rectangle(0, 0, scene.scale.width, 96, 0x0b0f18, 0.82)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(999);

        const groups = [
            {
                label: 'Tools',
                items: [
                    { key: 'tool-select', label: 'Select', action: () => this.setTool('Select'), group: 'tool' },
                    { key: 'tool-wire', label: 'Wire', action: () => this.setTool('Wire'), group: 'tool' },
                    { key: 'tool-delete', label: 'Delete', action: () => this.setTool('Delete'), group: 'tool' }
                ]
            },
            {
                label: 'Sources',
                items: [
                    { key: 'tool-vcc', label: 'VCC', action: () => this.setTool('VCC') },
                    { key: 'tool-gnd', label: 'GND', action: () => this.setTool('GND') },
                    { key: 'tool-clk', label: 'CLK', action: () => this.setTool('Clock') }
                ]
            },
            {
                label: 'Input',
                items: [
                    { key: 'tool-switch', label: 'Switch', action: () => this.setTool('Switch') },
                    { key: 'tool-button', label: 'Button', action: () => this.setTool('Button') }
                ]
            },
            {
                label: 'Output',
                items: [
                    { key: 'tool-led', label: 'LED', action: () => this.setTool('LED') },
                    { key: 'tool-display', label: 'Display', action: () => this.setTool('Display') }
                ]
            },
            {
                label: 'Gates',
                items: [
                    { key: 'tool-and', label: 'AND', action: () => this.setTool('AND') },
                    { key: 'tool-or', label: 'OR', action: () => this.setTool('OR') },
                    { key: 'tool-not', label: 'NOT', action: () => this.setTool('NOT') },
                    { key: 'tool-nand', label: 'NAND', action: () => this.setTool('NAND') },
                    { key: 'tool-nor', label: 'NOR', action: () => this.setTool('NOR') },
                    { key: 'tool-xor', label: 'XOR', action: () => this.setTool('XOR') },
                    { key: 'tool-xnor', label: 'XNOR', action: () => this.setTool('XNOR') }
                ]
            },
            {
                label: 'Boards',
                items: [
                    { key: 'tool-board-s', label: 'Board S', action: () => this.setTool('ProtoSmall') },
                    { key: 'tool-board-m', label: 'Board M', action: () => this.setTool('ProtoMedium') },
                    { key: 'tool-board-l', label: 'Board L', action: () => this.setTool('ProtoLarge') }
                ]
            },
            {
                label: 'Custom',
                items: [
                    { key: 'tool-in', label: 'Input Pin', action: () => this.setTool('InputPin') },
                    { key: 'tool-out', label: 'Output Pin', action: () => this.setTool('OutputPin') }
                ]
            },
            {
                label: 'Sim',
                items: [
                    { key: 'sim-play', label: 'Play', action: () => this.simulation.start() },
                    { key: 'sim-pause', label: 'Pause', action: () => this.simulation.pause() },
                    { key: 'sim-step', label: 'Step', action: () => this.simulation.step() },
                    { key: 'sim-clear', label: 'Clear', action: () => { this.simulation.clear(); this.render(); } }
                ]
            },
            {
                label: 'View',
                items: [
                    { key: 'view-real', label: 'Lit', action: () => this.setRenderMode('real'), group: 'view' },
                    { key: 'view-wire', label: 'Wire', action: () => this.setRenderMode('wireframe'), group: 'view' }
                ]
            }
        ];

        groups.forEach(g => this.createHUDGroup(g));

        this.setActiveButton('tool', 'tool-select');
        this.setActiveButton('view', 'view-real');
    }

    createHUDGroup(group) {
        if (!this.scene) return;
        const scene = this.scene;
        const title = scene.add.text(0, 0, group.label, {
            fontSize: '11px',
            color: '#9fb1c7',
            fontFamily: 'Manrope',
            fontStyle: '700'
        }).setDepth(1002).setScrollFactor(0);

        const row = scene.add.container(0, title.height + 4).setDepth(1002).setScrollFactor(0);
        let x = 0;
        let maxHeight = 0;
        group.items.forEach(item => {
            const btn = this.createHUDButton(item.label, x, 0, () => item.action(item), item.key, item.group);
            row.add(btn.container);
            this.hudButtons[item.key] = { ...btn, group: item.group, key: item.key };
            x += btn.width + 6;
            maxHeight = Math.max(maxHeight, btn.height);
        });

        const holder = scene.add.container(0, 0, [title, row]).setDepth(1001).setScrollFactor(0);
        holder.width = Math.max(title.width, x);
        holder.height = (title.height + 4) + maxHeight;
        this.hudGroups.push(holder);
    }

    createHUDButton(label, x, y, onClick, key, group) {
        const scene = this.scene;
        const width = Math.max(56, label.length * 7 + 18);
        const height = 26;
        const bg = scene.add.rectangle(0, 0, width, height, 0x152033, 0.9).setOrigin(0);
        bg.setStrokeStyle(1, 0x2f3f56, 0.9);
        const text = scene.add.text(width / 2, height / 2, label, {
            fontSize: '12px',
            fontFamily: 'Manrope',
            fontStyle: '700',
            color: '#e6edf7'
        }).setOrigin(0.5);

        const container = scene.add.container(x, y, [bg, text]).setSize(width, height).setDepth(1002).setScrollFactor(0);
        container.setData('hud-key', key);
        container.setData('hud-group', group || null);
        container.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
        container.on('pointerdown', pointer => {
            if (pointer.event) {
                pointer.event.preventDefault();
                pointer.event.stopPropagation();
                pointer.event.cancelBubble = true;
            }
            onClick();
            if (group) this.setActiveButton(group, key);
        });

        return { container, width, height, bg, text };
    }

    setActiveButton(group, key) {
        this.activeHudSelections[group] = key;
        Object.values(this.hudButtons).forEach(btn => {
            if (!btn || !btn.container) return;
            const isTargetGroup = btn.group === group;
            const isActive = isTargetGroup && btn.key === key;
            const fill = isActive ? 0xf5c86a : 0x152033;
            const alpha = isActive ? 1 : 0.9;
            const textColor = isActive ? '#0a0d14' : '#e6edf7';
            btn.bg.fillColor = fill;
            btn.bg.alpha = alpha;
            btn.text.setColor(textColor);
        });
    }

    layoutHUD() {
        if (!this.scene || !this.hudBg || !this.hudGroups.length) return;
        const maxWidth = this.scene.scale.width - 20;
        let x = 12;
        let y = 10;
        let rowHeight = 0;

        this.hudGroups.forEach(group => {
            const gWidth = group.width || group.getBounds().width;
            const gHeight = group.height || group.getBounds().height;
            if (x + gWidth > maxWidth) {
                x = 12;
                y += rowHeight + 10;
                rowHeight = 0;
            }
            group.setPosition(x, y);
            x += gWidth + 12;
            rowHeight = Math.max(rowHeight, gHeight);
        });

        const bgHeight = y + rowHeight + 10;
        this.hudBg.width = this.scene.scale.width;
        this.hudBg.height = bgHeight;
        this.hudBg.setPosition(0, 0);
    }
}
