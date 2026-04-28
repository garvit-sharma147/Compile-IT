// js/levels/stage2_main.js — Lexical Forest (Stage 2)
// Purpose: User splits their C code into tokens, system validates against stored tokens
import { updateScoreUI, addScore } from '../utils/score.js';
import { unlockLevel, completeLevel } from '../utils/storage.js';
import { getStoredEngine } from '../engine/global_engine.js';
import { fadeTransition, shakeElement, glowElement } from '../ui/animations.js';

document.addEventListener('DOMContentLoaded', () => {
    updateScoreUI();

    const consoleBox = document.getElementById('output-msg');
    const tokenInput = document.getElementById('token-input');
    const verifyBtn = document.getElementById('btn-verify');
    const attemptDisplay = document.getElementById('attempt-display');
    const codeDisplay = document.getElementById('code-display');

    // Load engine data
    const engineData = getStoredEngine();
    if (!engineData) {
        setConsoleMsg('[ERROR] No engine data found.\nPlease complete Stage 1 first.', true);
        verifyBtn.disabled = true;
        return;
    }

    // Display the source code (read-only)
    codeDisplay.innerText = engineData.sourceCode;

    // Expected tokens from engine
    const expectedTokens = engineData.tokens;

    let attempts = 0;
    const MAX_ATTEMPTS = 3;
    let completed = false;

    function setConsoleMsg(msg, isError = false) {
        consoleBox.innerText = msg;
        consoleBox.className = 'console-box ' + (isError ? 'error-msg' : 'success-msg');
    }

    function updateAttemptDisplay() {
        attemptDisplay.innerText = `Attempt ${attempts}/${MAX_ATTEMPTS}`;
    }

    // ===== VERIFY HANDLER =====
    verifyBtn.addEventListener('click', () => {
        if (completed) return;

        const userInput = tokenInput.value.trim();
        if (!userInput) {
            setConsoleMsg('[ERROR] Please enter your tokens before verifying.', true);
            return;
        }

        // Parse user tokens: split by pipe, trim whitespace, remove empty
        const userTokens = userInput.split('|').map(t => t.trim()).filter(t => t !== '');

        attempts++;
        updateAttemptDisplay();

        // Compare token by token
        const result = compareTokens(userTokens, expectedTokens);

        if (result.valid) {
            // SUCCESS
            completed = true;
            addScore(150);
            glowElement(verifyBtn, 'correct');
            setConsoleMsg(
                `[SUCCESS] All ${expectedTokens.length} tokens correctly identified!\n\n` +
                `Your tokens:\n${userTokens.join(' | ')}\n\n` +
                `Score +150\n\n` +
                `Proceeding to Token Valley...`
            );
            tokenInput.readOnly = true;
            tokenInput.style.opacity = '0.7';
            verifyBtn.disabled = true;
            verifyBtn.innerText = 'COMPLETED';

            completeLevel(2);
            unlockLevel(3); // Unlock Token Valley

            setTimeout(() => {
                fadeTransition(() => {
                    window.location.href = '../../map.html';
                });
            }, 2500);

        } else if (attempts >= MAX_ATTEMPTS) {
            // FAILED 3 TIMES — show answer
            completed = true;
            shakeElement(verifyBtn);
            glowElement(verifyBtn, 'wrong');
            setConsoleMsg(
                `[FAILED] Better luck next time!\n\n` +
                `${result.msg}\n\n` +
                `Correct tokens (${expectedTokens.length}):\n` +
                `${expectedTokens.join(' | ')}\n\n` +
                `You may still proceed to the next stage.`
            );
            tokenInput.readOnly = true;
            tokenInput.style.opacity = '0.7';
            verifyBtn.disabled = true;
            verifyBtn.innerText = 'FAILED';

            // Still unlock next stage (0 bonus points)
            completeLevel(2);
            unlockLevel(3);

            // Show continue button
            const continueBtn = document.createElement('button');
            continueBtn.className = 'btn btn-verify';
            continueBtn.innerText = 'Continue to Next Stage';
            continueBtn.style.marginTop = '10px';
            continueBtn.addEventListener('click', () => {
                fadeTransition(() => {
                    window.location.href = '../../map.html';
                });
            });
            document.getElementById('panel-interactive').appendChild(continueBtn);

        } else {
            // WRONG — still have attempts
            shakeElement(verifyBtn);
            glowElement(verifyBtn, 'wrong');
            addScore(-20);
            setConsoleMsg(
                `[ERROR] Incorrect tokens!\n\n` +
                `${result.msg}\n\n` +
                `${MAX_ATTEMPTS - attempts} attempt(s) remaining.\n` +
                `Score -20`,
                true
            );
        }
    });

    // ===== TOKEN COMPARISON =====
    function compareTokens(userTokens, expected) {
        // Check length first
        if (userTokens.length !== expected.length) {
            const diff = userTokens.length - expected.length;
            const hint = diff > 0
                ? `You have ${diff} extra token(s). Check for accidental splits.`
                : `You are missing ${Math.abs(diff)} token(s). Look carefully at the code.`;
            return {
                valid: false,
                msg: `Token count mismatch.\nExpected: ${expected.length} tokens\nGot: ${userTokens.length} tokens\n${hint}`
            };
        }

        // Check each token
        for (let i = 0; i < expected.length; i++) {
            if (userTokens[i] !== expected[i]) {
                return {
                    valid: false,
                    msg: `Mismatch at position ${i + 1}.\nExpected: "${expected[i]}"\nGot: "${userTokens[i]}"`
                };
            }
        }

        return { valid: true };
    }

    // ===== HINT HANDLER =====
    document.getElementById('btn-hint').addEventListener('click', () => {
        const currentScore = parseInt(document.getElementById('player-score').innerText) || 0;
        if (currentScore < 50) {
            setConsoleMsg('[SYSTEM] Not enough score (requires 50 pts) to use a hint.', true);
            return;
        }
        addScore(-50);

        // Progressive hints
        const tokenPreview = expectedTokens.slice(0, 5).join(' | ');
        const totalCount = expectedTokens.length;

        setConsoleMsg(
            `[HINT] Lexical Analysis Guide:\n\n` +
            `Total tokens expected: ${totalCount}\n\n` +
            `First 5 tokens: ${tokenPreview} ...\n\n` +
            `Remember:\n` +
            `• Keywords (int, while, for, if) are individual tokens\n` +
            `• Each operator (+, -, =, <, ++, <=) is one token\n` +
            `• Each delimiter (; , ( ) { }) is one token\n` +
            `• Variable names are individual tokens\n` +
            `• Numbers are individual tokens\n` +
            `• Whitespace is NOT a token`
        );
    });

    // ===== EXIT HANDLER =====
    document.getElementById('btn-exit').addEventListener('click', () => {
        window.location.href = '../../map.html';
    });

    updateAttemptDisplay();
});
