import { Engine } from './engine.js';
import { Simulation } from './simulation.js';
import { PuzzleManager } from './puzzles.js';

document.addEventListener('DOMContentLoaded', () => {
    const mount = document.getElementById('phaser-root');
    const simulation = new Simulation();
    const engine = new Engine(mount, simulation);
    const puzzleManager = new PuzzleManager();

    let currentLevelIndex = 0;
    let activePuzzle = null;

    const toastEl = document.getElementById('toast');
    const truthTableEl = document.getElementById('truth-table');
    const puzzleTitle = document.getElementById('puzzle-title');
    const puzzleTitleInline = document.getElementById('puzzle-title-inline');
    const puzzleDesc = document.getElementById('puzzle-desc');
    const puzzleDay = document.getElementById('puzzle-day');
    const puzzleDayInline = document.getElementById('puzzle-day-inline');
    const puzzleLevel = document.getElementById('puzzle-level');
    const puzzleLevelInline = document.getElementById('puzzle-level-inline');
    const puzzleStatus = document.getElementById('puzzle-status');
    const progressFill = document.getElementById('progress-fill');
    const progressValue = document.getElementById('progress-value');
    const dailyBadge = document.getElementById('daily-badge');
    const viewButtons = document.querySelectorAll('#view-toggle .seg-btn');
    const themeButtons = document.querySelectorAll('#theme-toggle .seg-btn');
    const liveOutputList = document.getElementById('live-output-list');

    function showToast(message, tone = 'info') {
        toastEl.textContent = message;
        toastEl.classList.toggle('show', true);
        toastEl.style.borderColor = tone === 'error' ? '#ff6b6b' : '#6cf29c';
        toastEl.style.background = tone === 'error' ? 'rgba(255, 107, 107, 0.18)' : 'rgba(108, 242, 156, 0.18)';
        setTimeout(() => toastEl.classList.remove('show'), 2000);
    }

    function renderProgress(index) {
        const progress = ((index) / (puzzleManager.puzzles.length - 1)) * 100;
        progressFill.style.width = `${progress}%`;
        if (progressValue) progressValue.textContent = `${Math.round(progress)}%`;
    }

    function renderPuzzle(index = 0) {
        currentLevelIndex = index;
        activePuzzle = puzzleManager.getPuzzle(index);
        if (!activePuzzle) return;

        puzzleTitle.textContent = activePuzzle.title;
        if (puzzleTitleInline) puzzleTitleInline.textContent = activePuzzle.title;
        puzzleDesc.textContent = activePuzzle.description;
        const dayText = `Day ${puzzleManager.dayIndex}`;
        const levelText = `Level ${index + 1} · ${activePuzzle.difficulty}`;
        puzzleDay.textContent = dayText;
        puzzleLevel.textContent = levelText;
        if (puzzleDayInline) puzzleDayInline.textContent = dayText;
        if (puzzleLevelInline) puzzleLevelInline.textContent = levelText;
        truthTableEl.textContent = puzzleManager.formatTruthTable(activePuzzle);
        puzzleStatus.textContent = activePuzzle.hint;
        dailyBadge.textContent = `Daily Generator · ${puzzleManager.dayIndex}`;

        renderProgress(index);
        simulation.loadPuzzle(activePuzzle);
        engine.render();
        renderLiveOutputs();
    }

    function renderLiveOutputs() {
        if (!liveOutputList) return;
        const outputs = simulation.components.filter(c => c.type === 'OutputPin');
        liveOutputList.innerHTML = '';
        outputs.forEach(out => {
            const row = document.createElement('div');
            const on = !!out.value;
            row.className = `io-row ${on ? 'on' : 'off'}`;
            row.innerHTML = `<span><span class="dot"></span>${out.label || out.id || 'OUT'}</span><span>${on ? 'HIGH' : 'LOW'}</span>`;
            liveOutputList.appendChild(row);
        });
    }

    // Toolbar interactions
    const toolBtns = document.querySelectorAll('.tool-btn');
    toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            toolBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            engine.setTool(btn.dataset.type);
        });
    });

    // Control buttons
    document.getElementById('play-btn').addEventListener('click', () => { simulation.start(); });
    document.getElementById('pause-btn').addEventListener('click', () => { simulation.pause(); renderLiveOutputs(); });
    document.getElementById('step-btn').addEventListener('click', () => { simulation.step(); renderLiveOutputs(); });
    document.getElementById('clear-btn').addEventListener('click', () => {
        simulation.clear();
        engine.render();
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
                engine.render();
                renderLiveOutputs();
            };
            reader.readAsText(file);
        };
        input.click();
    });

    document.getElementById('create-chip-btn').addEventListener('click', () => {
        const name = prompt('Enter chip name:');
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
            renderProgress(currentLevelIndex + 1);
        } else {
            puzzleStatus.textContent = 'Not quite right yet. Check your truth table.';
            showToast('Outputs do not match the target yet.', 'error');
        }
        renderLiveOutputs();
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
            engine.setRenderMode(btn.dataset.mode);
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

    // Phaser drives its own loop; keep API symmetry
    engine.start();
    renderPuzzle(0);
});
