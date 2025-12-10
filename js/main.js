import { Engine } from './engine.js';
import { Simulation } from './simulation.js';
import { PuzzleManager } from './puzzles.js';

document.addEventListener('DOMContentLoaded', () => {
    const mount = document.getElementById('phaser-root');
    const toastEl = document.getElementById('toast');

    const simulation = new Simulation();
    const engine = new Engine(mount, simulation);
    const puzzleManager = new PuzzleManager();

    const showToast = (message) => {
        if (!toastEl) return;
        toastEl.textContent = message;
        toastEl.classList.add('show');
        setTimeout(() => toastEl.classList.remove('show'), 1800);
    };

    const loadPuzzle = (index = 0) => {
        const puzzle = puzzleManager.getPuzzle(index);
        if (!puzzle) return;
        simulation.loadPuzzle(puzzle);
        engine.render();
        showToast(`${puzzle.title} loaded`);
    };

    engine.start();
    loadPuzzle(0);
});
