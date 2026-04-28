// js/levels/stage5_main.js — Code Optimization (Stage 5)
// User manually rewrites code using optimization techniques.
// System validates against precomputed optimized version.

import { updateScoreUI, addScore } from '../utils/score.js';
import { unlockLevel, completeLevel } from '../utils/storage.js';
import { getStoredEngine } from '../engine/global_engine.js';
import { fadeTransition, shakeElement, glowElement } from '../ui/animations.js';

const MAX_ATTEMPTS = 3;

// ===== NORMALIZATION =====
// Strips whitespace differences so validation focuses on logic, not formatting
function normalize(code) {
    return code
        .split('\n')
        .map(line => line.replace(/\s+/g, ' ').trim())
        .filter(line => line.length > 0)
        .join('\n');
}

document.addEventListener('DOMContentLoaded', () => {
    updateScoreUI();

    const sourceDisplay = document.getElementById('source-display');
    const userInput     = document.getElementById('user-input');
    const consoleBox    = document.getElementById('output-msg');
    const verifyBtn     = document.getElementById('btn-verify');
    const resetBtn      = document.getElementById('btn-reset');
    const attemptDisp   = document.getElementById('attempt-display');
    const techniqueList = document.getElementById('technique-list');

    let attempts = 0;
    let completed = false;
    let hintLevel = 0;

    function setConsole(msg, isError = false) {
        consoleBox.innerText = msg;
        consoleBox.className = 'console-box ' + (isError ? 'error-msg' : 'success-msg');
    }

    function setConsoleHTML(html) {
        consoleBox.innerHTML = html;
        consoleBox.className = 'console-box success-msg';
    }

    // ===== LOAD ENGINE DATA =====
    const engine = getStoredEngine();
    if (!engine || !engine.optimizationChallenge) {
        setConsole('[ERROR] No engine data found.\nPlease complete Stage 1 first.', true);
        verifyBtn.disabled = true;
        return;
    }

    const challenge = engine.optimizationChallenge;

    // Display source code
    sourceDisplay.innerText = challenge.original;

    // Display technique badges
    const badgeClasses = {
        'Constant Folding': 'constant',
        'Algebraic Simplification': 'algebraic',
        'Dead Code Removal': 'deadcode'
    };

    challenge.techniques.forEach(tech => {
        const badge = document.createElement('span');
        badge.className = 'technique-badge ' + (badgeClasses[tech] || '');
        badge.innerText = tech;
        techniqueList.appendChild(badge);
    });

    // Initial console message
    setConsole(
        'Welcome to Code Optimization!\n\n' +
        'Study the source code on the left.\n' +
        'Apply the listed optimization techniques.\n' +
        'Write the optimized version below and click "Verify Optimization".\n\n' +
        'Techniques available:\n' +
        challenge.techniques.map(t => '  • ' + t).join('\n')
    );

    // ===== VERIFY =====
    verifyBtn.addEventListener('click', () => {
        if (completed) return;

        const userCode = userInput.value.trim();
        if (!userCode) {
            setConsole('[ERROR] Please write your optimized code first.', true);
            shakeElement(verifyBtn);
            return;
        }

        attempts++;
        attemptDisp.innerText = `Attempt ${attempts}/${MAX_ATTEMPTS}`;

        const normalizedUser = normalize(userCode);
        const normalizedExpected = normalize(challenge.optimized);

        if (normalizedUser === normalizedExpected) {
            // ===== SUCCESS =====
            completed = true;
            addScore(200);
            glowElement(verifyBtn, 'correct');

            userInput.style.borderColor = 'var(--correct-color)';
            userInput.readOnly = true;
            verifyBtn.disabled = true;
            verifyBtn.innerText = 'COMPLETED';

            setConsole(
                '[SUCCESS] Code optimization is correct!\n\n' +
                'Applied techniques:\n' +
                challenge.techniques.map(t => '  ✓ ' + t).join('\n') +
                '\n\nScore +200\n\n' +
                'Proceeding to next stage...'
            );

            completeLevel(5);
            unlockLevel(6);

            setTimeout(() => {
                fadeTransition(() => { window.location.href = '../../map.html'; });
            }, 2500);

        } else if (attempts >= MAX_ATTEMPTS) {
            // ===== FAILED 3x — reveal answer =====
            completed = true;
            shakeElement(verifyBtn);
            glowElement(verifyBtn, 'wrong');

            userInput.style.borderColor = 'var(--error-color)';
            userInput.readOnly = true;
            verifyBtn.disabled = true;
            verifyBtn.innerText = 'FAILED';

            setConsoleHTML(
                '<span style="color:var(--error-color);font-weight:700;">[FAILED] Maximum attempts reached.</span>\n\n' +
                '<span style="color:#aaa;">The correct optimized code is:</span>\n' +
                '<div class="correct-reveal">' + escapeHtml(challenge.optimized) + '</div>\n\n' +
                '<span style="color:#aaa;">Optimizations applied:</span>\n' +
                challenge.hints.map(h => '<div class="hint-line">• ' + escapeHtml(h) + '</div>').join('') +
                '\n<span style="color:#888;">You may still proceed to the next stage.</span>'
            );

            completeLevel(5);
            unlockLevel(6);

            const continueBtn = document.createElement('button');
            continueBtn.className = 'btn btn-verify';
            continueBtn.innerText = 'Continue →';
            continueBtn.style.marginTop = '8px';
            continueBtn.addEventListener('click', () => {
                fadeTransition(() => { window.location.href = '../../map.html'; });
            });
            document.querySelector('.input-controls').appendChild(continueBtn);

        } else {
            // ===== WRONG — retry =====
            shakeElement(verifyBtn);
            glowElement(verifyBtn, 'wrong');
            addScore(-25);

            // Show line-by-line diff hint
            const userLines = normalizedUser.split('\n');
            const expectedLines = normalizedExpected.split('\n');
            let diffMsg = '';

            if (userLines.length !== expectedLines.length) {
                diffMsg = `Your code has ${userLines.length} line(s), expected ${expectedLines.length}.\n`;
            }

            let wrongCount = 0;
            const maxCheck = Math.max(userLines.length, expectedLines.length);
            for (let i = 0; i < maxCheck; i++) {
                const u = userLines[i] || '(missing)';
                const e = expectedLines[i] || '(extra)';
                if (u !== e) wrongCount++;
            }

            setConsole(
                `[ERROR] Optimization is not correct.\n\n` +
                (diffMsg || '') +
                `${wrongCount} line(s) differ from the expected output.\n\n` +
                `${MAX_ATTEMPTS - attempts} attempt(s) remaining.\n` +
                `Score -25\n\n` +
                `Tip: Apply ${challenge.techniques[Math.min(hintLevel, challenge.techniques.length - 1)]} carefully.`,
                true
            );
        }
    });

    // ===== RESET =====
    resetBtn.addEventListener('click', () => {
        if (completed) return;
        userInput.value = '';
        userInput.focus();
        setConsole('Input cleared. Try again.');
    });

    // ===== HINTS (Progressive) =====
    document.getElementById('btn-hint').addEventListener('click', () => {
        if (completed) return;

        const score = parseInt(document.getElementById('player-score').innerText) || 0;
        if (score < 50) {
            setConsole('[SYSTEM] Not enough score (need 50 pts) for a hint.', true);
            return;
        }
        addScore(-50);

        if (hintLevel < challenge.hints.length) {
            const hint = challenge.hints[hintLevel];
            hintLevel++;

            setConsole(
                `[HINT ${hintLevel}/${challenge.hints.length}]\n\n` +
                hint + '\n\n' +
                (hintLevel < challenge.hints.length
                    ? `${challenge.hints.length - hintLevel} hint(s) remaining.`
                    : 'No more hints available.')
            );
        } else {
            // Final hint: reveal the answer
            setConsoleHTML(
                '<span style="color:#ffcc00;font-weight:700;">[HINT] Full answer revealed:</span>\n\n' +
                '<div class="correct-reveal">' + escapeHtml(challenge.optimized) + '</div>'
            );
        }
    });

    // ===== EXIT =====
    document.getElementById('btn-exit').addEventListener('click', () => {
        window.location.href = '../../map.html';
    });

    // ===== HELPERS =====
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
});
