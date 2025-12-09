import { Component, Wire } from './components.js';

export class Engine {
    constructor(canvas, simulation) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.simulation = simulation;
        this.gridSize = 20;
        this.currentTool = 'Select';
        this.renderMode = 'real';

        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.lastMouse = { x: 0, y: 0 };

        // Wire creation state
        this.wireStart = null;
        this.tempWireEnd = null;

        this.setupEvents();
    }

    setTool(tool) {
        this.currentTool = tool;
        this.wireStart = null; // Reset wire creation if tool changes
    }

    setRenderMode(mode) {
        this.renderMode = mode === 'wireframe' ? 'wireframe' : 'real';
        this.draw();
    }

    setupEvents() {
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('contextmenu', e => e.preventDefault()); // Disable context menu
    }

    getGridPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        return {
            x: Math.round(x / this.gridSize) * this.gridSize,
            y: Math.round(y / this.gridSize) * this.gridSize,
            rawX: x,
            rawY: y
        };
    }

    handleMouseDown(e) {
        const pos = this.getGridPos(e);

        if (this.currentTool === 'Select') {
            // Check if clicked on a component
            const clickedComponent = this.simulation.findComponentAt(pos.x, pos.y);
            if (clickedComponent) {
                if (clickedComponent.isInteractive) {
                    clickedComponent.toggle();
                    this.simulation.update();
                } else if (!clickedComponent.locked) {
                    // Start dragging component
                    this.isDragging = true;
                    this.dragStart = pos;
                    this.selectedComponent = clickedComponent;
                }
            }
        } else if (this.currentTool === 'Wire') {
            this.wireStart = pos;
            this.tempWireEnd = pos;
        } else if (this.currentTool === 'Delete') {
            this.simulation.removeAt(pos.x, pos.y);
        } else {
            // Place component
            this.simulation.addComponent(this.currentTool, pos.x, pos.y);
        }

        this.draw();
    }

    handleMouseMove(e) {
        const pos = this.getGridPos(e);
        this.lastMouse = pos;

        if (this.isDragging && this.selectedComponent) {
            this.selectedComponent.x = pos.x;
            this.selectedComponent.y = pos.y;
        } else if (this.currentTool === 'Wire' && this.wireStart) {
            this.tempWireEnd = pos;
        }

        this.draw();
    }

    handleMouseUp(e) {
        const pos = this.getGridPos(e);

        if (this.isDragging) {
            this.isDragging = false;
            this.selectedComponent = null;
        } else if (this.currentTool === 'Wire' && this.wireStart) {
            this.simulation.addWire(this.wireStart.x, this.wireStart.y, pos.x, pos.y);
            this.wireStart = null;
            this.tempWireEnd = null;
        }

        this.draw();
    }

    start() {
        const loop = () => {
            if (this.simulation.isRunning) {
                this.simulation.tick();
                this.draw();
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    draw() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Clear
        if (this.renderMode === 'wireframe') {
            ctx.fillStyle = '#0b0f1f';
            ctx.fillRect(0, 0, width, height);
        } else {
            const bg = ctx.createLinearGradient(0, 0, width, height);
            bg.addColorStop(0, '#0c0f1a');
            bg.addColorStop(1, '#121a2c');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, width, height);

            // Subtle spotlight to guide the build area
            const radial = ctx.createRadialGradient(width * 0.45, height * 0.45, 60, width * 0.45, height * 0.45, width * 0.7);
            radial.addColorStop(0, 'rgba(108,242,156,0.07)');
            radial.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = radial;
            ctx.fillRect(0, 0, width, height);
        }

        // Draw Grid
        ctx.strokeStyle = this.renderMode === 'wireframe' ? '#30354a' : '#262c3b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= width; x += this.gridSize) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
        }
        for (let y = 0; y <= height; y += this.gridSize) {
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
        }
        ctx.stroke();

        // Major gridlines every 5 units for easier placement
        ctx.strokeStyle = this.renderMode === 'wireframe' ? 'rgba(122,163,255,0.35)' : 'rgba(108,242,156,0.15)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const majorStep = this.gridSize * 5;
        for (let x = 0; x <= width; x += majorStep) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
        }
        for (let y = 0; y <= height; y += majorStep) {
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
        }
        ctx.stroke();

        // Draw Wires
        const now = performance.now();
        this.simulation.wires.forEach(wire => wire.draw(ctx, this.gridSize, now, this.renderMode));

        // Draw temp wire
        if (this.wireStart && this.tempWireEnd) {
            ctx.strokeStyle = this.renderMode === 'wireframe' ? '#7aa3ff' : '#888';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.wireStart.x, this.wireStart.y);
            ctx.lineTo(this.tempWireEnd.x, this.tempWireEnd.y);
            ctx.stroke();
        }

        // Draw Components
        this.simulation.components.forEach(comp => comp.draw(ctx, this.gridSize, this.renderMode));

        // Draw ghost component if placing
        if (this.currentTool !== 'Select' && this.currentTool !== 'Wire' && this.currentTool !== 'Delete') {
            ctx.globalAlpha = 0.5;
            // Simple ghost representation
            ctx.fillStyle = this.renderMode === 'wireframe' ? 'rgba(150,180,255,0.6)' : '#6cf29c';
            ctx.fillRect(this.lastMouse.x - 10, this.lastMouse.y - 10, 20, 20);
            ctx.globalAlpha = 1.0;
        }
    }
}
