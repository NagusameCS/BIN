import { Engine } from './engine.js';
import { Simulation } from './simulation.js';
import { PuzzleManager } from './puzzles.js';

document.addEventListener('DOMContentLoaded', () => {
    const mount = document.getElementById('phaser-root');
    const toastEl = document.getElementById('toast');

    const simulation = new Simulation();
    const engine = new Engine(mount, simulation);
    const puzzleManager = new PuzzleManager();

    let currentLevelIndex = 0;
    let activePuzzle = null;

    const showToast = (message) => {
        if (!toastEl) return;
        toastEl.textContent = message;
        toastEl.classList.add('show');
        setTimeout(() => toastEl.classList.remove('show'), 1800);
    };

    const loadPuzzle = (index = 0) => {
        currentLevelIndex = index;
        const puzzle = puzzleManager.getPuzzle(index);
        if (!puzzle) return;
        activePuzzle = puzzle;
        simulation.loadPuzzle(puzzle);
        engine.setPuzzleMeta({
            title: puzzle.title,
            day: puzzleManager.dayIndex,
            difficulty: puzzle.difficulty
        });
        engine.render();
        showToast(`${puzzle.title} loaded`);
    };

    engine.on('puzzle-reset', () => {
        loadPuzzle(currentLevelIndex);
        showToast('Puzzle reset');
    });

    engine.on('puzzle-next', () => {
        const next = Math.min(currentLevelIndex + 1, puzzleManager.puzzles.length - 1);
        loadPuzzle(next);
        showToast(`Level ${next + 1}`);
    });

    engine.on('puzzle-check', () => {
        if (!activePuzzle) return;
        const solved = simulation.checkTruthTable(activePuzzle);
        showToast(solved ? 'Solved!' : 'Outputs mismatch');
    });

    engine.start();
    loadPuzzle(0);
});
