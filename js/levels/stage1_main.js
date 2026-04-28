// js/levels/stage1_main.js — Start Challenge (Stage 1)
// Purpose: Collect user's C code + CFG, run basic computation, store results
import { updateScoreUI, addScore } from '../utils/score.js';
import { unlockLevel, completeLevel } from '../utils/storage.js';
import { processAll } from '../engine/global_engine.js';
import { fadeTransition } from '../ui/animations.js';

document.addEventListener('DOMContentLoaded', () => {
    updateScoreUI();

    const codeInput = document.getElementById('c-code-input');
    const cfgInput = document.getElementById('cfg-input');
    const consoleBox = document.getElementById('output-msg');
    const submitBtn = document.getElementById('btn-submit');

    function setConsoleMsg(msg, isError = false) {
        consoleBox.innerText = msg;
        consoleBox.className = 'console-box ' + (isError ? 'error-msg' : 'success-msg');
    }

    // ===== SUBMIT HANDLER =====
    submitBtn.addEventListener('click', () => {
        const cCode = codeInput.value.trim();
        const cfgText = cfgInput.value.trim();

        // Validation
        if (!cCode) {
            setConsoleMsg('[ERROR] C Code cannot be empty.\nPlease provide valid C source code.', true);
            return;
        }

        if (!cfgText || !cfgText.includes('->')) {
            setConsoleMsg('[ERROR] Invalid CFG detected.\nProductions must use "->" format.\nExample: S -> a A | b', true);
            return;
        }

        // Process everything through the global engine
        const engineData = processAll(cCode, cfgText);

        // Display results in console
        const tokenCount = engineData.tokens.length;
        const tokenPreview = engineData.tokens.slice(0, 10).join(' | ');
        const moreText = tokenCount > 10 ? ` ... (${tokenCount - 10} more)` : '';

        setConsoleMsg(
            `[SYSTEM] Initialization Complete!\n\n` +
            `Tokens found: ${tokenCount}\n` +
            `Preview: ${tokenPreview}${moreText}\n\n` +
            `CFG grammar saved successfully.\n\n` +
            `You may proceed to the next stages.\n` +
            `Score +100`
        );

        // Update game state
        addScore(100);
        completeLevel(1);
        unlockLevel(2);  // Unlock Lexical Forest (Left branch)
        unlockLevel(6);  // Unlock Grammar Temple (Right branch)

        // Make inputs read-only after submission
        codeInput.readOnly = true;
        codeInput.style.opacity = '0.7';
        cfgInput.readOnly = true;
        cfgInput.style.opacity = '0.7';
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.5';
        submitBtn.innerText = 'LOCKED IN';

        // Auto-redirect to map after delay
        setTimeout(() => {
            fadeTransition(() => {
                window.location.href = '../../map.html';
            });
        }, 2500);
    });

    // ===== EXIT HANDLER =====
    document.getElementById('btn-exit').addEventListener('click', () => {
        window.location.href = '../../map.html';
    });

    // ===== HINT HANDLER =====
    document.getElementById('btn-hint').addEventListener('click', () => {
        const currentScore = parseInt(document.getElementById('player-score').innerText) || 0;
        if (currentScore < 50) {
            setConsoleMsg('[SYSTEM] Not enough score to use a hint (requires 50 pts).', true);
            return;
        }
        addScore(-50);
        setConsoleMsg(
            '[HINT] Stage 1 Guide:\n\n' +
            '1. Enter any valid C code in the Source Code panel.\n' +
            '   Example: int x = 5; if(x > 0) { printf("hi"); }\n\n' +
            '2. Enter a CFG grammar in the Input panel.\n' +
            '   Format: NonTerminal -> production1 | production2\n' +
            '   Example: S -> a A | b\n' +
            '            A -> a A | epsilon\n\n' +
            '3. Click "Submit & Lock" to initialize the compiler engine.'
        );
    });
});
