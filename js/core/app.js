// js/core/app.js — Menu bootstrapper
import { registerRoute, navigate } from './router.js';
import { getScore } from '../utils/storage.js';

// ===== Main Menu View =====
function renderMainMenu() {
    // Hide top HUD on menu
    const topBar = document.getElementById('top-bar');
    if (topBar) topBar.classList.add('hidden');

    const container = document.createElement('div');
    container.className = 'view-container';

    container.innerHTML = `
        <h1 class="title-text">Compile-IT</h1>
        <div class="card menu-card">
            <button id="btn-start" class="btn">Start Game</button>
            <button id="btn-levels" class="btn">Select Level</button>
            <button id="btn-instruct" class="btn">Instructions</button>
            <button id="btn-exit" class="btn" style="background-color: var(--error-color);">Exit</button>
        </div>
    `;

    setTimeout(() => {
        document.getElementById('btn-start').onclick = () => {
            window.location.href = 'map.html';
        };
        document.getElementById('btn-levels').onclick = () => {
            window.location.href = 'map.html';
        };
        document.getElementById('btn-instruct').onclick = () => {
            alert(
                'Welcome to Compile-IT!\n\n' +
                '1. Start by entering your C code and CFG grammar in Stage 1.\n' +
                '2. The system will process your input and prepare all compiler phases.\n' +
                '3. Navigate the map to complete stages across two branches:\n' +
                '   - Left Branch: C Code Analysis (Tokenization, AST, etc.)\n' +
                '   - Right Branch: CFG Analysis (Grammar, FIRST/FOLLOW, LL(1))\n' +
                '4. Each stage teaches a compiler concept through interactive challenges.\n' +
                '5. Earn points for correct answers. Use hints (-50 pts) if stuck.\n' +
                '6. You get 3 attempts per challenge before the answer is shown.\n\n' +
                'Good luck, Compiler Architect!'
            );
        };
        document.getElementById('btn-exit').onclick = () => {
            alert('Please close the browser tab to exit the game.');
        };
    }, 0);

    return container;
}

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    registerRoute('/menu', renderMainMenu);
    navigate('/menu');
});
