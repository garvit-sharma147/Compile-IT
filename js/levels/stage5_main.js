// js/levels/stage5_main.js — Code Optimization (Stage 5)
// Two-phase flow:
//   Phase 1: User enters source code → system generates optimized version
//   Phase 2: User writes their optimized version → system validates

import { updateScoreUI, addScore } from '../utils/score.js';
import { unlockLevel, completeLevel } from '../utils/storage.js';
import { fadeTransition, shakeElement, glowElement } from '../ui/animations.js';

const MAX_ATTEMPTS = 3;


// ===================================================================
//  OPTIMIZATION ENGINE — Analyze code and produce optimized version
// ===================================================================

/**
 * Analyze user's C source code and generate an optimization challenge.
 * Applies: constant folding, algebraic simplification, dead code removal.
 *
 * @param {string} sourceCode - Raw C source code
 * @returns {{ optimized: string, techniques: string[], hints: string[] }}
 */
function optimizeCode(sourceCode) {
    let lines = sourceCode.split('\n').map(l => l.trimEnd());
    const techniques = new Set();
    const hints = [];

    // ---- PASS 1: Constant Folding ----
    // Evaluate pure-constant arithmetic in assignments: int x = 3 + 4 * 2;
    lines = lines.map((line, idx) => {
        const trimmed = line.trim();
        // Match: type var = expr;  OR  var = expr;
        const declMatch = trimmed.match(/^((?:int|float|double|char|long|short)\s+)?(\w+)\s*=\s*(.+?)\s*;$/);
        if (!declMatch) return line;

        const prefix = declMatch[1] || '';
        const varName = declMatch[2];
        let expr = declMatch[3].trim();

        // Check if the expression is purely numeric arithmetic
        if (isPureConstantExpr(expr)) {
            try {
                const result = safeEval(expr);
                if (result !== null && result !== undefined && !isNaN(result)) {
                    const newVal = Number.isInteger(result) ? String(result) : result.toFixed(2).replace(/\.?0+$/, '');
                    if (expr !== newVal) {
                        techniques.add('Constant Folding');
                        hints.push(`Line ${idx + 1}: "${expr}" → ${newVal} (evaluated at compile time)`);
                        const indent = line.match(/^(\s*)/)[1];
                        return `${indent}${prefix}${varName} = ${newVal};`;
                    }
                }
            } catch (e) { /* skip if eval fails */ }
        }
        return line;
    });

    // ---- PASS 2: Algebraic Simplification ----
    // x * 1 → x,  x + 0 → x,  0 + x → x,  x - 0 → x,  x * 0 → 0,  0 * x → 0
    lines = lines.map((line, idx) => {
        const trimmed = line.trim();
        const declMatch = trimmed.match(/^((?:int|float|double|char|long|short)\s+)?(\w+)\s*=\s*(.+?)\s*;$/);
        if (!declMatch) return line;

        const prefix = declMatch[1] || '';
        const varName = declMatch[2];
        let expr = declMatch[3].trim();
        const originalExpr = expr;

        // x * 1 or 1 * x → x
        expr = expr.replace(/^(\w+)\s*\*\s*1$/, '$1');
        expr = expr.replace(/^1\s*\*\s*(\w+)$/, '$1');

        // x + 0 or 0 + x → x
        expr = expr.replace(/^(\w+)\s*\+\s*0$/, '$1');
        expr = expr.replace(/^0\s*\+\s*(\w+)$/, '$1');

        // x - 0 → x
        expr = expr.replace(/^(\w+)\s*-\s*0$/, '$1');

        // x * 0 or 0 * x → 0
        expr = expr.replace(/^(\w+)\s*\*\s*0$/, '0');
        expr = expr.replace(/^0\s*\*\s*(\w+)$/, '0');

        // x / 1 → x
        expr = expr.replace(/^(\w+)\s*\/\s*1$/, '$1');

        if (expr !== originalExpr) {
            techniques.add('Algebraic Simplification');
            const opMatch = originalExpr.match(/[\+\-\*\/]/);
            const op = opMatch ? opMatch[0] : '';
            hints.push(`Line ${idx + 1}: "${originalExpr}" simplifies to "${expr}" (identity: algebraic rule)`);
            const indent = line.match(/^(\s*)/)[1];
            return `${indent}${prefix}${varName} = ${expr};`;
        }
        return line;
    });

    // ---- PASS 3: Dead Code Removal ----
    // Find declared variables that are never used elsewhere
    const declarations = [];  // { name, lineIdx }
    const allIdentifiers = new Map(); // name → count of uses (excluding declaration LHS)

    lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) return;

        // Detect declarations
        const declMatch = trimmed.match(/^(?:int|float|double|char|long|short)\s+(\w+)\s*=/);
        if (declMatch) {
            declarations.push({ name: declMatch[1], lineIdx: idx });
        }

        // Count all identifier usages (we'll subtract declarations later)
        const identifiers = trimmed.match(/[a-zA-Z_]\w*/g) || [];
        identifiers.forEach(id => {
            if (['int', 'float', 'double', 'char', 'void', 'long', 'short',
                 'if', 'else', 'for', 'while', 'do', 'return',
                 'printf', 'scanf', 'main'].includes(id)) return;
            allIdentifiers.set(id, (allIdentifiers.get(id) || 0) + 1);
        });
    });

    // A variable is dead if it's declared but only appears once total (the declaration itself)
    const deadLines = new Set();
    for (const decl of declarations) {
        const count = allIdentifiers.get(decl.name) || 0;
        if (count <= 1) {
            // Only appears in its own declaration — dead code
            deadLines.add(decl.lineIdx);
            techniques.add('Dead Code Removal');
            hints.push(`Line ${decl.lineIdx + 1}: "${decl.name}" is declared but never used → remove`);
        }
    }

    // Remove dead lines
    lines = lines.filter((_, idx) => !deadLines.has(idx));

    // Remove empty lines at the end
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
        lines.pop();
    }

    const optimized = lines.join('\n');

    // If no optimizations were found, inform the user
    if (techniques.size === 0) {
        return {
            optimized: sourceCode.split('\n').map(l => l.trimEnd()).join('\n'),
            techniques: [],
            hints: ['No optimization opportunities found in this code.']
        };
    }

    return {
        optimized,
        techniques: [...techniques],
        hints
    };
}


/**
 * Check if an expression contains only numbers and arithmetic operators.
 */
function isPureConstantExpr(expr) {
    // Must contain at least one operator to be "foldable"
    if (!/[\+\-\*\/%]/.test(expr)) return false;
    // Must contain ONLY: digits, whitespace, operators, parens, dots
    return /^[\d\s\+\-\*\/%\(\)\.]+$/.test(expr.trim());
}

/**
 * Safely evaluate a constant arithmetic expression.
 * Only allows numbers and basic operators.
 */
function safeEval(expr) {
    // Validate: only digits, operators, parens, spaces, dots
    if (!/^[\d\s\+\-\*\/%\(\)\.]+$/.test(expr)) return null;
    try {
        // Use Function constructor to avoid direct eval
        const fn = new Function(`return (${expr});`);
        return fn();
    } catch (e) {
        return null;
    }
}


// ===================================================================
//  NORMALIZATION — Strip whitespace for logical comparison
// ===================================================================

function normalize(code) {
    return code
        .split('\n')
        .map(line => line.replace(/\s+/g, ' ').trim())
        .filter(line => line.length > 0)
        .join('\n');
}


// ===================================================================
//  DOM READY — Wire up Stage 5 UI
// ===================================================================

document.addEventListener('DOMContentLoaded', () => {
    updateScoreUI();

    // DOM references
    const sourceInput    = document.getElementById('source-input');
    const sourceDisplay  = document.getElementById('source-display');
    const userOptimized  = document.getElementById('user-optimized');
    const consoleBox     = document.getElementById('output-msg');
    const submitBtn      = document.getElementById('btn-submit');
    const verifyBtn      = document.getElementById('btn-verify');
    const resetBtn       = document.getElementById('btn-reset');
    const attemptDisp    = document.getElementById('attempt-display');
    const submitControls = document.getElementById('submit-controls');
    const panelOptimized = document.getElementById('panel-optimized');
    const phase1Badge    = document.getElementById('phase1-badge');
    const phase2Badge    = document.getElementById('phase2-badge');

    let attempts = 0;
    let completed = false;
    let hintLevel = 0;
    let challenge = null;  // { optimized, techniques, hints }
    let phase = 1;         // 1 = input code, 2 = input optimized

    // ===== CONSOLE HELPERS =====
    function setConsole(msg, isError = false) {
        consoleBox.innerText = msg;
        consoleBox.className = 'console-box ' + (isError ? 'error-msg' : 'success-msg');
    }

    function setConsoleHTML(html) {
        consoleBox.innerHTML = html;
        consoleBox.className = 'console-box success-msg';
    }


    // =================================================================
    //  PHASE 1: SUBMIT SOURCE CODE
    // =================================================================

    submitBtn.addEventListener('click', () => {
        const code = sourceInput.value.trim();

        if (!code) {
            setConsole('[ERROR] Please enter your source code first.', true);
            shakeElement(submitBtn);
            return;
        }

        // Validate: at least one declaration-like line
        const hasDecl = /\b(int|float|double|char)\s+\w+/.test(code);
        if (!hasDecl) {
            setConsole(
                '[ERROR] Code must contain at least one variable declaration.\n\n' +
                'Example:\n  int x = 3 + 4 * 2;\n  int y = x * 1;\n  int unused = 99;\n  int result = x + y;',
                true
            );
            shakeElement(submitBtn);
            return;
        }

        // Generate optimization challenge
        challenge = optimizeCode(code);

        if (challenge.techniques.length === 0) {
            setConsole(
                '[WARNING] No optimization opportunities found in your code.\n\n' +
                'Try including patterns like:\n' +
                '  • Constant expressions: int x = 3 + 4 * 2;\n' +
                '  • Algebraic identities: int y = x * 1;\n' +
                '  • Unused variables:     int unused = 99;\n\n' +
                'Please revise and submit again.',
                true
            );
            shakeElement(submitBtn);
            return;
        }

        // ===== Transition to Phase 2 =====
        phase = 2;

        // Lock source input → show as read-only display
        sourceInput.classList.add('hidden');
        sourceDisplay.innerText = code;
        sourceDisplay.classList.remove('hidden');
        submitControls.classList.add('hidden');

        // Update phase badges
        phase1Badge.innerText = '✓ LOCKED';
        phase1Badge.style.background = 'rgba(76,175,80,0.2)';
        phase1Badge.style.color = '#66bb6a';
        phase1Badge.style.borderColor = 'rgba(76,175,80,0.4)';

        phase2Badge.innerText = 'PHASE 2';

        // Enable optimized panel
        panelOptimized.classList.remove('disabled-panel');
        userOptimized.disabled = false;
        verifyBtn.disabled = false;
        resetBtn.disabled = false;
        userOptimized.focus();

        // Console feedback
        let msg = 'Code received. Optimization challenge ready!\n\n';
        msg += `Detected ${challenge.techniques.length} optimization technique(s):\n`;
        challenge.techniques.forEach(t => { msg += `  • ${t}\n`; });
        msg += '\nWrite your optimized version in the panel below.\n';
        msg += 'Click "Verify Optimization" when ready.';
        setConsole(msg);

        addScore(50); // Points for submitting code
    });


    // =================================================================
    //  PHASE 2: VERIFY OPTIMIZATION
    // =================================================================

    verifyBtn.addEventListener('click', () => {
        if (completed || !challenge) return;

        const userCode = userOptimized.value.trim();
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
            const scoreMap = { 1: 200, 2: 150, 3: 100 };
            const points = scoreMap[attempts] || 100;
            addScore(points);
            glowElement(verifyBtn, 'correct');

            userOptimized.style.borderColor = 'var(--correct-color)';
            userOptimized.readOnly = true;
            verifyBtn.disabled = true;
            verifyBtn.innerText = 'COMPLETED ✓';

            setConsole(
                '✓ Code optimization is correct!\n\n' +
                'Applied techniques:\n' +
                challenge.techniques.map(t => '  ✓ ' + t).join('\n') +
                '\n\nScore +' + points + '\n\n' +
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

            userOptimized.style.borderColor = 'var(--error-color)';
            userOptimized.readOnly = true;
            verifyBtn.disabled = true;
            verifyBtn.innerText = 'FAILED';

            let html = '<span style="color:var(--error-color);font-weight:700;">[FAILED] Maximum attempts reached.</span><br><br>';
            html += '<span style="color:#aaa;">The correct optimized code is:</span><br>';
            html += '<div class="correct-reveal">' + escapeHtml(challenge.optimized) + '</div><br>';
            html += '<span style="color:#aaa;">Optimizations applied:</span><br>';
            challenge.hints.forEach(h => {
                html += '<div class="hint-line">• ' + escapeHtml(h) + '</div>';
            });
            html += '<br><span style="color:#888;">You may still proceed to the next stage.</span>';
            setConsoleHTML(html);

            completeLevel(5);
            unlockLevel(6);

            const continueBtn = document.createElement('button');
            continueBtn.className = 'btn btn-verify';
            continueBtn.innerText = 'Continue →';
            continueBtn.style.marginTop = '8px';
            continueBtn.addEventListener('click', () => {
                fadeTransition(() => { window.location.href = '../../map.html'; });
            });
            document.querySelector('#panel-optimized .input-controls').appendChild(continueBtn);

        } else {
            // ===== WRONG — retry =====
            shakeElement(verifyBtn);
            glowElement(verifyBtn, 'wrong');
            addScore(-25);

            const userLines = normalizedUser.split('\n');
            const expectedLines = normalizedExpected.split('\n');
            let diffMsg = '';

            if (userLines.length !== expectedLines.length) {
                diffMsg = `Your code has ${userLines.length} line(s), expected ${expectedLines.length}.\n`;
            }

            let wrongCount = 0;
            const maxCheck = Math.max(userLines.length, expectedLines.length);
            for (let i = 0; i < maxCheck; i++) {
                if ((userLines[i] || '') !== (expectedLines[i] || '')) wrongCount++;
            }

            setConsole(
                `[ERROR] Optimization is not correct.\n\n` +
                (diffMsg || '') +
                `${wrongCount} line(s) differ from the expected output.\n\n` +
                `${MAX_ATTEMPTS - attempts} attempt(s) remaining.\n` +
                `Score -25\n\n` +
                `Tip: Check if you applied ${challenge.techniques[Math.min(attempts - 1, challenge.techniques.length - 1)]} correctly.`,
                true
            );
        }
    });


    // =================================================================
    //  RESET
    // =================================================================

    resetBtn.addEventListener('click', () => {
        if (completed) return;
        userOptimized.value = '';
        userOptimized.focus();
        userOptimized.style.borderColor = '#333';
        setConsole('Optimized code cleared. Try again.');
    });


    // =================================================================
    //  HINTS (Progressive)
    // =================================================================

    document.getElementById('btn-hint').addEventListener('click', () => {
        if (completed) return;

        if (phase === 1) {
            setConsole(
                '[HINT] Enter code with optimization opportunities:\n\n' +
                '• Use constant expressions: int x = 3 + 4 * 2;\n' +
                '• Add algebraic identities: int y = x * 1;\n' +
                '• Include unused variables:  int unused = 99;\n\n' +
                'Then click "Submit Code".'
            );
            return;
        }

        const score = parseInt(document.getElementById('player-score').innerText) || 0;
        if (score < 50) {
            setConsole('[SYSTEM] Not enough score (need 50 pts) for a hint.', true);
            return;
        }
        addScore(-50);

        if (!challenge) return;

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
            // Final hint: reveal the full answer
            let html = '<span style="color:#ffcc00;font-weight:700;">[HINT] Full answer revealed:</span><br><br>';
            html += '<div class="correct-reveal">' + escapeHtml(challenge.optimized) + '</div>';
            setConsoleHTML(html);
        }
    });


    // =================================================================
    //  EXIT
    // =================================================================

    document.getElementById('btn-exit').addEventListener('click', () => {
        window.location.href = '../../map.html';
    });


    // =================================================================
    //  HELPERS
    // =================================================================

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
});
