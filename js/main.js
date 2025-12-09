import { Engine } from './engine.js';
import { Simulation } from './simulation.js';

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('circuit-canvas');
    const simulation = new Simulation();
    const engine = new Engine(canvas, simulation);

    // Resize canvas to fit container
    function resizeCanvas() {
        const container = document.getElementById('canvas-container');
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        engine.draw();
    }
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Toolbar interactions
    const toolBtns = document.querySelectorAll('.tool-btn');
    toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all
            toolBtns.forEach(b => b.classList.remove('active'));
            // Add to clicked
            btn.classList.add('active');
            
            const type = btn.dataset.type;
            engine.setTool(type);
        });
    });

    // Control buttons
    document.getElementById('play-btn').addEventListener('click', () => simulation.start());
    document.getElementById('pause-btn').addEventListener('click', () => simulation.pause());
    document.getElementById('step-btn').addEventListener('click', () => simulation.step());
    document.getElementById('clear-btn').addEventListener('click', () => {
        simulation.clear();
        engine.draw();
    });

    document.getElementById('save-btn').addEventListener('click', () => {
        const json = simulation.toJSON();
        const blob = new Blob([json], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'circuit.json';
        a.click();
        URL.revokeObjectURL(url);
    });

    document.getElementById('load-btn').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = event => {
                simulation.loadJSON(event.target.result);
                engine.draw();
            };
            reader.readAsText(file);
        };
        input.click();
    });

    document.getElementById('create-chip-btn').addEventListener('click', () => {
        const name = prompt("Enter chip name:");
        if (!name) return;
        
        const def = simulation.createChip(name);
        if (def) {
            const container = document.getElementById('custom-chips-container');
            const btn = document.createElement('button');
            btn.className = 'tool-btn';
            btn.dataset.type = name;
            btn.textContent = name;
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                engine.setTool(name);
            });
            container.appendChild(btn);
            alert(`Chip '${name}' created!`);
        }
    });
    
    // Start the engine loop
    engine.start();
});
