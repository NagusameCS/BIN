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
        this.hudRoot = null;
        this.sections = [];
        this.camera = null;
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };
        this.cameraStart = { x: 0, y: 0 };
        this.minZoom = 0.55;
        this.maxZoom = 2.2;
        this.callbacks = {};
        this.puzzleMeta = null;

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
            render: { antialias: false, pixelArt: true, roundPixels: true },
            backgroundColor: '#0a0d14',
            scene: {
                create() {
                    engine.scene = this;
                    engine.graphics = this.add.graphics();
                    engine.camera = this.cameras.main;
                    engine.camera.setZoom(1);
                    engine.camera.setScroll(-400, -200);
                    engine.camera.setBounds(-2000, -2000, 4000, 4000);
                    if (this.input.mouse) this.input.mouse.disableContextMenu();
                    this.input.on('pointerdown', p => engine.pointerDown(p));
                    this.input.on('pointermove', p => engine.pointerMove(p));
                    this.input.on('pointerup', p => engine.pointerUp(p));
                    this.input.on('wheel', (pointer, objects, dx, dy) => engine.handleWheel(dy, pointer));
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

    handleWheel(deltaY, pointer) {
        if (!this.camera) return;
        const zoomFactor = deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Phaser.Math.Clamp(this.camera.zoom * zoomFactor, this.minZoom, this.maxZoom);
        // Zoom around pointer
        const worldPoint = this.camera.getWorldPoint(pointer.x, pointer.y);
        this.camera.zoom = newZoom;
        const after = this.camera.getWorldPoint(pointer.x, pointer.y);
        this.camera.scrollX += worldPoint.x - after.x;
        this.camera.scrollY += worldPoint.y - after.y;
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

    on(event, handler) {
        if (!this.callbacks[event]) this.callbacks[event] = [];
        this.callbacks[event].push(handler);
    }

    emit(event, payload) {
        (this.callbacks[event] || []).forEach(fn => fn(payload));
    }

    setPuzzleMeta(meta) {
        this.puzzleMeta = meta;
        this.updatePuzzleSection();
    }

    pointerToGrid(pointer) {
        const cam = this.camera || (this.scene && this.scene.cameras.main);
        const world = cam ? cam.getWorldPoint(pointer.x, pointer.y) : { x: pointer.x, y: pointer.y };
        const x = world.x;
        const y = world.y;
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

        // Middle-click or space-drag to pan
        const startPan = () => {
            this.isPanning = true;
            this.panStart = { x: pointer.x, y: pointer.y };
            this.cameraStart = { x: this.camera.scrollX, y: this.camera.scrollY };
        };

        const isMiddle = pointer.middleButtonDown();
        const isSpaceDrag = pointer.event && pointer.event.buttons === 1 && pointer.event.code !== undefined && pointer.event.code === 'Space';
        if (isMiddle || isSpaceDrag) {
            startPan();
            return;
        }
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
            } else {
                // Drag-pan when nothing is picked
                startPan();
            }
        } else if (this.currentTool === 'Wire') {
            const snap = this.snapToAnchor(pos) || pos;
            this.wireStart = snap;
            this.tempWireEnd = snap;
        } else if (this.currentTool === 'Delete') {
            this.simulation.removeAt(pos.x, pos.y);
        } else {
            this.simulation.addComponent(this.currentTool, pos.x, pos.y);
            const shiftHeld = pointer.event && pointer.event.shiftKey;
            if (!shiftHeld) this.setTool('Select');
        }
    }

    pointerMove(pointer) {
        if (this.isPointerInHUD(pointer)) return;
        if (this.isPanning && this.camera) {
            const dx = pointer.x - this.panStart.x;
            const dy = pointer.y - this.panStart.y;
            this.camera.scrollX = this.cameraStart.x - dx / this.camera.zoom;
            this.camera.scrollY = this.cameraStart.y - dy / this.camera.zoom;
            return;
        }
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
        if (this.isPanning) {
            this.isPanning = false;
            return;
        }
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
        const cam = this.camera || this.scene.cameras.main;
        const viewW = cam.width / cam.zoom;
        const viewH = cam.height / cam.zoom;
        const startX = Math.floor((cam.scrollX - viewW * 0.1) / this.gridSize) * this.gridSize;
        const endX = Math.ceil((cam.scrollX + viewW * 1.1) / this.gridSize) * this.gridSize;
        const startY = Math.floor((cam.scrollY - viewH * 0.1) / this.gridSize) * this.gridSize;
        const endY = Math.ceil((cam.scrollY + viewH * 1.1) / this.gridSize) * this.gridSize;

        // Clear
        g.clear();
        g.fillStyle(this.renderMode === 'wireframe' ? 0x0b0f1f : 0x0d111b, 1);
        g.fillRect(cam.scrollX - viewW * 0.5, cam.scrollY - viewH * 0.5, viewW * 2, viewH * 2);

        // Grid
        const zoom = cam.zoom || 1;
        const minorColor = this.renderMode === 'wireframe' ? 0x4a536b : 0x273042;
        const majorColor = this.renderMode === 'wireframe' ? 0x9fb5ff : 0x8be8b4;
        const axisColor = this.renderMode === 'wireframe' ? 0xb9ccff : 0xcdece0;
        const minorAlpha = Phaser.Math.Clamp(0.42 + (zoom - 1) * 0.12, 0.32, 0.72);
        const majorAlpha = Phaser.Math.Clamp(0.28 + (zoom - 1) * 0.1, 0.24, 0.66);
        const minorWidth = Math.max(1, 1.1 / zoom);
        const majorWidth = Math.max(1.2, 1.8 / zoom);
        g.lineStyle(minorWidth, minorColor, minorAlpha);
        for (let x = startX; x <= endX; x += this.gridSize) {
            g.lineBetween(x, startY, x, endY);
        }
        for (let y = startY; y <= endY; y += this.gridSize) {
            g.lineBetween(startX, y, endX, y);
        }
        g.lineStyle(majorWidth, majorColor, majorAlpha);
        const majorStep = this.gridSize * 5;
        for (let x = startX; x <= endX; x += majorStep) {
            g.lineBetween(x, startY, x, endY);
        }
        for (let y = startY; y <= endY; y += majorStep) {
            g.lineBetween(startX, y, endX, y);
        }
        // Emphasize world axes for easier orientation
        g.lineStyle(Math.max(1.4, 2 / zoom), axisColor, 0.8);
        g.lineBetween(0, startY, 0, endY);
        g.lineBetween(startX, 0, endX, 0);

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
            const baseColor = this.renderMode === 'wireframe' ? 0x12192b : (isLocked ? 0x1f3344 : 0x2d4460);
            const strokeColor = isLocked ? 0x7fe0a6 : 0xc8d9ff;
            g.fillStyle(baseColor, 0.98);
            g.lineStyle(isLocked ? 3 : 2.4, strokeColor, 0.95);
            g.fillRoundedRect(x, y, w, h, 8);
            g.strokeRoundedRect(x, y, w, h, 8);

            // Pins
            const pinActive = this.renderMode === 'wireframe' ? 0xb3c8ff : 0x9cf7c8;
            const pinInactive = this.renderMode === 'wireframe' ? 0x6b7794 : 0x4b566d;
            comp.getInputs().forEach(pin => {
                g.fillStyle(pinInactive, 1);
                g.fillCircle(pin.x, pin.y, 5);
            });
            comp.getOutputs().forEach(pin => {
                const active = !!pin.value;
                g.fillStyle(active ? pinActive : pinInactive, 1);
                g.fillCircle(pin.x, pin.y, 5.5);
            });

            // Label text
            if (this.scene) {
                const label = this.scene.add.text(comp.x, comp.y, comp.label || comp.type, {
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '12px',
                    color: '#f0f4ff',
                    stroke: '#0a0d14',
                    strokeThickness: 4
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
        if (!this.hudRoot || !this.scene) return false;
        const bounds = this.hudRoot.getBounds();
        return Phaser.Geom.Rectangle.Contains(bounds, pointer.x, pointer.y);
    }

    buildHUD() {
        if (!this.scene) return;

        if (this.hudRoot) this.hudRoot.destroy();
        if (this.hudBg) this.hudBg.destroy();
        this.hudGroups.forEach(g => g.destroy());
        this.sections.forEach(s => s.destroy && s.destroy());
        this.hudGroups = [];
        this.hudButtons = {};
        this.sections = [];
        this.activeHudSelections = {};

        const scene = this.scene;
        this.hudRoot = scene.add.container(0, 0).setScrollFactor(0).setDepth(999);
        this.hudBg = scene.add.rectangle(0, 0, 320, 110, 0x0b0f18, 0.9)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(998)
            .setStrokeStyle(1, 0x2f3f56, 0.92);
        this.hudRoot.add(this.hudBg);

        const sections = [
            {
                key: 'tools',
                label: 'Tools',
                expanded: true,
                items: [
                    { key: 'tool-select', label: 'Select', action: () => this.setTool('Select'), group: 'tool' },
                    { key: 'tool-wire', label: 'Wire', action: () => this.setTool('Wire'), group: 'tool' },
                    { key: 'tool-delete', label: 'Delete', action: () => this.setTool('Delete'), group: 'tool' }
                ]
            },
            {
                key: 'components',
                label: 'Components',
                expanded: false,
                items: [
                    { key: 'tool-vcc', label: 'VCC', action: () => this.setTool('VCC') },
                    { key: 'tool-gnd', label: 'GND', action: () => this.setTool('GND') },
                    { key: 'tool-clk', label: 'Clock', action: () => this.setTool('Clock') },
                    { key: 'tool-switch', label: 'Switch', action: () => this.setTool('Switch') },
                    { key: 'tool-button', label: 'Button', action: () => this.setTool('Button') },
                    { key: 'tool-led', label: 'LED', action: () => this.setTool('LED') },
                    { key: 'tool-display', label: 'Display', action: () => this.setTool('Display') },
                    { key: 'tool-and', label: 'AND', action: () => this.setTool('AND') },
                    { key: 'tool-or', label: 'OR', action: () => this.setTool('OR') },
                    { key: 'tool-not', label: 'NOT', action: () => this.setTool('NOT') },
                    { key: 'tool-nand', label: 'NAND', action: () => this.setTool('NAND') },
                    { key: 'tool-nor', label: 'NOR', action: () => this.setTool('NOR') },
                    { key: 'tool-xor', label: 'XOR', action: () => this.setTool('XOR') },
                    { key: 'tool-xnor', label: 'XNOR', action: () => this.setTool('XNOR') },
                    { key: 'tool-board-s', label: 'Board S', action: () => this.setTool('ProtoSmall') },
                    { key: 'tool-board-m', label: 'Board M', action: () => this.setTool('ProtoMedium') },
                    { key: 'tool-board-l', label: 'Board L', action: () => this.setTool('ProtoLarge') },
                    { key: 'tool-in', label: 'Input Pin', action: () => this.setTool('InputPin') },
                    { key: 'tool-out', label: 'Output Pin', action: () => this.setTool('OutputPin') }
                ]
            },
            {
                key: 'sim',
                label: 'Simulation',
                expanded: false,
                items: [
                    { key: 'sim-play', label: 'Play', action: () => this.simulation.start() },
                    { key: 'sim-pause', label: 'Pause', action: () => this.simulation.pause() },
                    { key: 'sim-step', label: 'Step', action: () => this.simulation.step() },
                    { key: 'sim-clear', label: 'Clear', action: () => { this.simulation.clear(); this.render(); } }
                ]
            },
            {
                key: 'view',
                label: 'View',
                expanded: false,
                items: [
                    { key: 'view-real', label: 'Lit', action: () => this.setRenderMode('real'), group: 'view' },
                    { key: 'view-wire', label: 'Wire', action: () => this.setRenderMode('wireframe'), group: 'view' }
                ]
            },
            {
                key: 'puzzle',
                label: 'Puzzle',
                expanded: false,
                items: [
                    { key: 'puzzle-reset', label: 'Reset', action: () => this.emit('puzzle-reset') },
                    { key: 'puzzle-check', label: 'Check', action: () => this.emit('puzzle-check') },
                    { key: 'puzzle-next', label: 'Next', action: () => this.emit('puzzle-next') }
                ]
            }
        ];

        sections.forEach(sec => this.createHUDSection(sec));

        this.setActiveButton('tool', 'tool-select');
        this.setActiveButton('view', 'view-real');
        this.layoutHUD();
        this.updatePuzzleSection();
    }

    createHUDSection(section) {
        if (!this.scene) return;
        const scene = this.scene;
        const headerHeight = 28;
        const width = 260;

        const headerBg = scene.add.rectangle(0, 0, width, headerHeight, 0x111a2a, 0.95).setOrigin(0).setScrollFactor(0).setDepth(1001);
        headerBg.setStrokeStyle(1, 0x2f3f56, 0.9);
        const title = scene.add.text(10, headerHeight / 2, section.label, {
            fontSize: '12px',
            color: '#e6edf7',
            fontFamily: 'Manrope',
            fontStyle: '700'
        }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(1002);

        const chevron = scene.add.text(width - 18, headerHeight / 2, section.expanded ? '▾' : '▸', {
            fontSize: '12px', color: '#9fb1c7', fontFamily: 'Manrope'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1002);

        const panel = scene.add.container(0, headerHeight).setScrollFactor(0).setDepth(1001);
        let x = 6;
        let y = 6;
        let rowH = 0;
        const maxInnerWidth = width - 12;
        section.items.forEach(item => {
            const btn = this.createHUDButton(item.label, x, y, () => item.action(item), item.key, item.group);
            panel.add(btn.container);
            this.hudButtons[item.key] = { ...btn, group: item.group, key: item.key };
            x += btn.width + 6;
            rowH = Math.max(rowH, btn.height);
            if (x + 60 > maxInnerWidth) {
                x = 6;
                y += rowH + 6;
                rowH = 0;
            }
        });
        y += rowH + 6;
        panel.height = y;
        panel.width = width;

        const container = scene.add.container(0, 0, [headerBg, title, chevron, panel]).setScrollFactor(0).setDepth(1001);
        container.width = width;
        container.height = headerHeight + (section.expanded ? panel.height : 0);
        panel.setVisible(section.expanded);

        const toggle = (pointer) => {
            if (pointer && pointer.event) {
                pointer.event.preventDefault();
                pointer.event.stopPropagation();
                pointer.event.cancelBubble = true;
            }
            const expanded = !panel.visible;
            panel.setVisible(expanded);
            chevron.setText(expanded ? '▾' : '▸');
            container.height = headerHeight + (expanded ? panel.height : 0);
            this.layoutHUD();
        };

        headerBg.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, headerHeight), Phaser.Geom.Rectangle.Contains);
        headerBg.on('pointerdown', toggle);
        title.setInteractive();
        title.on('pointerdown', toggle);
        chevron.setInteractive();
        chevron.on('pointerdown', toggle);

        container.panel = panel;
        container.chevron = chevron;
        container.headerHeight = headerHeight;
        this.sections.push(container);
        this.hudRoot.add(container);
    }

    createHUDButton(label, x, y, onClick, key, group) {
        const scene = this.scene;
        const width = Math.max(64, label.length * 7 + 22);
        const height = 28;
        const bg = scene.add.rectangle(0, 0, width, height, 0x152033, 0.92).setOrigin(0);
        bg.setStrokeStyle(1, 0x3a4c68, 1);
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
        if (!this.scene || !this.hudBg || !this.sections.length || !this.game) return;
        const margin = 10;
        const puzzleHeight = this.puzzleText ? this.puzzleText.height + 4 : 0;
        const sectionY = puzzleHeight ? puzzleHeight + 8 : margin;
        let x = margin;
        let maxHeight = 0;

        this.sections.forEach(sec => {
            sec.setPosition(x, sectionY);
            const bounds = sec.getBounds();
            x += bounds.width + 8;
            maxHeight = Math.max(maxHeight, bounds.height);
        });

        const bgWidth = x + margin;
        const bgHeight = sectionY + maxHeight + margin;
        this.hudBg.width = Math.max(360, bgWidth);
        this.hudBg.height = bgHeight;
        this.hudBg.setPosition(0, 0);

        const viewW = this.game.scale.width;
        const viewH = this.game.scale.height;
        const rootX = Math.max(margin, (viewW - this.hudBg.width) / 2);
        const rootY = viewH - this.hudBg.height - margin;
        this.hudRoot.setPosition(rootX, rootY);

        if (this.puzzleText) {
            this.puzzleText.setPosition(margin, 6);
            this.hudRoot.bringToTop(this.puzzleText);
        }
        this.hudRoot.bringToTop(this.hudBg);
    }

    updatePuzzleSection() {
        if (!this.scene) return;
        if (!this.puzzleMeta) {
            if (this.puzzleText) {
                this.puzzleText.destroy();
                this.puzzleText = null;
            }
            return;
        }

        const label = `Day ${this.puzzleMeta.day || '?'} · ${this.puzzleMeta.title || 'Puzzle'}`;
        const diff = this.puzzleMeta.difficulty ? ` (${this.puzzleMeta.difficulty})` : '';
        if (!this.puzzleText) {
            this.puzzleText = this.scene.add.text(0, 0, label + diff, {
                fontSize: '12px',
                color: '#9fb1c7',
                fontFamily: 'Manrope'
            }).setDepth(1002).setScrollFactor(0);
            if (this.hudRoot) this.hudRoot.add(this.puzzleText);
        } else {
            this.puzzleText.setText(label + diff);
        }
        this.layoutHUD();
    }
}
