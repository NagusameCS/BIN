import { Engine } from './engine.js';
import { Simulation } from './simulation.js';
import { PuzzleManager } from './puzzles.js';

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('circuit-canvas');
    const simulation = new Simulation();
    const engine = new Engine(canvas, simulation);
    const puzzleManager = new PuzzleManager();

    let currentLevelIndex = 0;
    let activePuzzle = null;

    // Resize canvas to fit container
    function resizeCanvas() {
        const container = document.getElementById('canvas-container');
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        engine.draw();
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const toastEl = document.getElementById('toast');
    const truthTableEl = document.getElementById('truth-table');
    const puzzleTitle = document.getElementById('puzzle-title');
    const puzzleDesc = document.getElementById('puzzle-desc');
    const puzzleDay = document.getElementById('puzzle-day');
    const puzzleLevel = document.getElementById('puzzle-level');
    const puzzleStatus = document.getElementById('puzzle-status');
    const progressFill = document.getElementById('progress-fill');
    const dailyBadge = document.getElementById('daily-badge');
    const viewButtons = document.querySelectorAll('#view-toggle .seg-btn');
    const themeButtons = document.querySelectorAll('#theme-toggle .seg-btn');

    function showToast(message, tone = 'info') {
        toastEl.textContent = message;
        toastEl.classList.toggle('show', true);
        toastEl.style.borderColor = tone === 'error' ? '#ff6b6b' : '#6cf29c';
        toastEl.style.background = tone === 'error' ? 'rgba(255, 107, 107, 0.18)' : 'rgba(108, 242, 156, 0.18)';
        setTimeout(() => toastEl.classList.remove('show'), 2000);
    }

    function renderPuzzle(index = 0) {
        currentLevelIndex = index;
        activePuzzle = puzzleManager.getPuzzle(index);
        if (!activePuzzle) return;

        puzzleTitle.textContent = activePuzzle.title;
        puzzleDesc.textContent = activePuzzle.description;
        puzzleDay.textContent = `Day ${puzzleManager.dayIndex}`;
        puzzleLevel.textContent = `Level ${index + 1} · ${activePuzzle.difficulty}`;
        truthTableEl.textContent = puzzleManager.formatTruthTable(activePuzzle);
        puzzleStatus.textContent = activePuzzle.hint;
        dailyBadge.textContent = `Daily Generator · ${puzzleManager.dayIndex}`;

        const progress = ((index) / (puzzleManager.puzzles.length - 1)) * 100;
        progressFill.style.width = `${progress}%`;

        simulation.loadPuzzle(activePuzzle);
        engine.draw();
    }

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
        const blob = new Blob([json], { type: 'application/json' });
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

    document.getElementById('reset-puzzle-btn').addEventListener('click', () => {
        renderPuzzle(currentLevelIndex);
        showToast('Puzzle reset');
    });

    document.getElementById('check-puzzle-btn').addEventListener('click', () => {
        const solved = simulation.checkTruthTable(activePuzzle);
        if (solved) {
            puzzleStatus.textContent = 'Solved! Load the next level to keep going.';
            showToast('Puzzle solved!');
            const progress = ((currentLevelIndex + 1) / puzzleManager.puzzles.length) * 100;
            progressFill.style.width = `${progress}%`;
        } else {
            puzzleStatus.textContent = 'Not quite right yet. Check your truth table.';
            showToast('Outputs do not match the target yet.', 'error');
        }
    });

    document.getElementById('next-level-btn').addEventListener('click', () => {
        const next = Math.min(currentLevelIndex + 1, puzzleManager.puzzles.length - 1);
        renderPuzzle(next);
        showToast(`Level ${next + 1} loaded`);
    });

    viewButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            viewButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const mode = btn.dataset.mode;
            engine.setRenderMode(mode);
        });
    });

    themeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            themeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const theme = btn.dataset.theme;
            document.documentElement.setAttribute('data-theme', theme);
            showToast(`Theme: ${theme}`);
        });
    });

    // Start the engine loop
    engine.start();

    // Load the daily puzzle set
    renderPuzzle(0);
});
