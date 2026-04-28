// js/levels/stage7_main.js — FIRST & FOLLOW Bridge (Stage 7)
// User computes FIRST and FOLLOW sets for each non-terminal.
// System validates against internally computed correct answers.

import { updateScoreUI, addScore } from '../utils/score.js';
import { unlockLevel, completeLevel } from '../utils/storage.js';
import { getStoredEngine } from '../engine/global_engine.js';
import { fadeTransition, shakeElement, glowElement } from '../ui/animations.js';

// ===== CONSTANTS =====
const MAX_ATTEMPTS = 3;
const EPSILON = 'ε';
const END_MARKER = '$';

// ===================================================================
//  GRAMMAR PARSER (reused from Stage 6)
// ===================================================================

function parseGrammar(cfgText) {
    const lines = cfgText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return null;

    const productions = {};
    const nonTerminals = new Set();
    const nonTerminalOrder = []; // preserve insertion order
    const allSymbols = new Set();
    let startSymbol = null;

    for (const line of lines) {
        const arrowIdx = line.indexOf('->');
        const unicodeIdx = line.indexOf('→');
        let lhs, rhsRaw;

        if (arrowIdx !== -1) {
            lhs = line.substring(0, arrowIdx).trim();
            rhsRaw = line.substring(arrowIdx + 2).trim();
        } else if (unicodeIdx !== -1) {
            lhs = line.substring(0, unicodeIdx).trim();
            rhsRaw = line.substring(unicodeIdx + 1).trim();
        } else {
            continue;
        }

        if (!lhs || !rhsRaw) continue;

        if (!startSymbol) startSymbol = lhs;
        if (!nonTerminals.has(lhs)) {
            nonTerminals.add(lhs);
            nonTerminalOrder.push(lhs);
        }

        const alternatives = rhsRaw.split('|').map(a => a.trim());
        if (!productions[lhs]) productions[lhs] = [];

        for (const alt of alternatives) {
            if (alt === 'ε' || alt === 'epsilon' || alt === 'ε') {
                productions[lhs].push([EPSILON]);
            } else {
                const symbols = tokenizeProduction(alt);
                productions[lhs].push(symbols);
                symbols.forEach(s => allSymbols.add(s));
            }
        }
    }

    if (!startSymbol) return null;

    const terminals = new Set();
    allSymbols.forEach(s => {
        if (!nonTerminals.has(s) && s !== EPSILON) terminals.add(s);
    });

    return { startSymbol, nonTerminals, nonTerminalOrder, terminals, productions };
}

function tokenizeProduction(rhs) {
    const trimmed = rhs.trim();
    if (trimmed.includes(' ')) {
        return trimmed.split(/\s+/).filter(s => s.length > 0);
    }
    const symbols = [];
    for (let i = 0; i < trimmed.length; i++) {
        symbols.push(trimmed[i]);
    }
    return symbols;
}


// ===================================================================
//  FIRST SET COMPUTATION — standard fixed-point algorithm
// ===================================================================

function computeFirstSets(grammar) {
    const { nonTerminals, terminals, productions } = grammar;
    const first = {};

    // Initialize
    for (const nt of nonTerminals) {
        first[nt] = new Set();
    }
    for (const t of terminals) {
        first[t] = new Set([t]);
    }
    first[EPSILON] = new Set([EPSILON]);

    // Helper: FIRST of a sequence of symbols
    function firstOfSequence(symbols) {
        const result = new Set();
        if (symbols.length === 0) {
            result.add(EPSILON);
            return result;
        }

        for (let i = 0; i < symbols.length; i++) {
            const sym = symbols[i];
            const symFirst = first[sym] || new Set();

            // Add everything except epsilon
            for (const f of symFirst) {
                if (f !== EPSILON) result.add(f);
            }

            // If epsilon is NOT in FIRST(sym), stop
            if (!symFirst.has(EPSILON)) {
                return result;
            }

            // If we've gone through ALL symbols and all can derive ε
            if (i === symbols.length - 1) {
                result.add(EPSILON);
            }
        }
        return result;
    }

    // Fixed-point iteration
    let changed = true;
    let iterations = 0;
    const MAX_ITERATIONS = 100;

    while (changed && iterations < MAX_ITERATIONS) {
        changed = false;
        iterations++;

        for (const nt of nonTerminals) {
            const prods = productions[nt] || [];
            for (const prod of prods) {
                // Handle epsilon production
                if (prod.length === 1 && prod[0] === EPSILON) {
                    if (!first[nt].has(EPSILON)) {
                        first[nt].add(EPSILON);
                        changed = true;
                    }
                    continue;
                }

                const seqFirst = firstOfSequence(prod);
                for (const f of seqFirst) {
                    if (!first[nt].has(f)) {
                        first[nt].add(f);
                        changed = true;
                    }
                }
            }
        }
    }

    // Return only non-terminal FIRST sets
    const result = {};
    for (const nt of nonTerminals) {
        result[nt] = first[nt];
    }
    return result;
}


// ===================================================================
//  FOLLOW SET COMPUTATION — standard fixed-point algorithm
// ===================================================================

function computeFollowSets(grammar, firstSets) {
    const { startSymbol, nonTerminals, productions } = grammar;
    const follow = {};

    // Initialize
    for (const nt of nonTerminals) {
        follow[nt] = new Set();
    }

    // Rule 1: Add $ to FOLLOW(start symbol)
    follow[startSymbol].add(END_MARKER);

    // Helper: FIRST of a sequence (using precomputed firstSets)
    function firstOfSeq(symbols) {
        const result = new Set();
        if (symbols.length === 0) {
            result.add(EPSILON);
            return result;
        }

        for (let i = 0; i < symbols.length; i++) {
            const sym = symbols[i];
            let symFirst;

            if (grammar.nonTerminals.has(sym)) {
                symFirst = firstSets[sym] || new Set();
            } else if (sym === EPSILON) {
                symFirst = new Set([EPSILON]);
            } else {
                // Terminal
                symFirst = new Set([sym]);
            }

            for (const f of symFirst) {
                if (f !== EPSILON) result.add(f);
            }

            if (!symFirst.has(EPSILON)) {
                return result;
            }

            if (i === symbols.length - 1) {
                result.add(EPSILON);
            }
        }
        return result;
    }

    // Fixed-point iteration
    let changed = true;
    let iterations = 0;
    const MAX_ITERATIONS = 100;

    while (changed && iterations < MAX_ITERATIONS) {
        changed = false;
        iterations++;

        for (const A of nonTerminals) {
            const prods = productions[A] || [];
            for (const prod of prods) {
                for (let i = 0; i < prod.length; i++) {
                    const B = prod[i];

                    // Only process non-terminals
                    if (!grammar.nonTerminals.has(B)) continue;

                    // β = everything after B
                    const beta = prod.slice(i + 1);

                    // Rule 2: Add FIRST(β) - {ε} to FOLLOW(B)
                    const betaFirst = firstOfSeq(beta);
                    for (const f of betaFirst) {
                        if (f !== EPSILON && !follow[B].has(f)) {
                            follow[B].add(f);
                            changed = true;
                        }
                    }

                    // Rule 3: If β can derive ε (or β is empty), add FOLLOW(A) to FOLLOW(B)
                    if (betaFirst.has(EPSILON)) {
                        for (const f of follow[A]) {
                            if (!follow[B].has(f)) {
                                follow[B].add(f);
                                changed = true;
                            }
                        }
                    }
                }
            }
        }
    }

    return follow;
}


// ===================================================================
//  USER INPUT PARSING & VALIDATION
// ===================================================================

/**
 * Parse a user's comma-separated input into a normalized Set.
 * Handles: "a, b", "a,b", "ε", "epsilon", "eps", "$"
 */
function parseUserInput(inputStr) {
    if (!inputStr || inputStr.trim() === '') return new Set();

    const items = inputStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
    const result = new Set();

    for (let item of items) {
        // Normalize epsilon variants
        if (item === 'epsilon' || item === 'eps' || item === 'ε' || item === 'e' && items.length === 1 && inputStr.trim() === 'e') {
            // Be careful: 'e' alone could be a terminal. Only treat as epsilon if it's literally "epsilon" or "eps" or "ε"
        }
        if (item === 'epsilon' || item === 'eps' || item === 'ε') {
            result.add(EPSILON);
        } else {
            result.add(item);
        }
    }

    return result;
}

/**
 * Compare two sets for equality.
 */
function setsEqual(a, b) {
    if (a.size !== b.size) return false;
    for (const item of a) {
        if (!b.has(item)) return false;
    }
    return true;
}

/**
 * Format a set for display: { a, b, $ }
 */
function formatSet(s) {
    if (s.size === 0) return '{ }';
    const sorted = [...s].sort((a, b) => {
        // Sort: terminals first, then ε, then $
        if (a === EPSILON) return 1;
        if (b === EPSILON) return -1;
        if (a === END_MARKER) return 1;
        if (b === END_MARKER) return -1;
        return a.localeCompare(b);
    });
    return '{ ' + sorted.join(', ') + ' }';
}


// ===================================================================
//  DOM READY — Wire up the Stage 7 UI
// ===================================================================

document.addEventListener('DOMContentLoaded', () => {
    updateScoreUI();

    // DOM references
    const grammarDisplay  = document.getElementById('grammar-display');
    const tableBody       = document.getElementById('ff-table-body');
    const consoleBox      = document.getElementById('output-msg');
    const verifyBtn       = document.getElementById('btn-verify');
    const resetBtn        = document.getElementById('btn-reset');
    const attemptDisplay  = document.getElementById('attempt-display');

    let attempts = 0;
    let completed = false;
    let hintLevel = 0;
    let grammar = null;
    let correctFirst = null;
    let correctFollow = null;

    // ===== CONSOLE HELPERS =====
    function setConsole(msg, isError = false) {
        consoleBox.innerText = msg;
        consoleBox.className = 'console-box ' + (isError ? 'error-msg' : 'success-msg');
    }

    function setConsoleHTML(html) {
        consoleBox.innerHTML = html;
        consoleBox.className = 'console-box';
    }

    // ===== LOAD ENGINE DATA =====
    const engine = getStoredEngine();
    if (!engine || !engine.cfgText) {
        setConsole('[ERROR] No grammar data found.\nPlease complete Stage 1 first and enter a CFG.', true);
        verifyBtn.disabled = true;
        return;
    }

    // ===== PARSE GRAMMAR =====
    grammar = parseGrammar(engine.cfgText);
    if (!grammar) {
        setConsole('[ERROR] Invalid grammar format.\nCould not parse the CFG.\nGrammar must use "->" or "→" format.', true);
        verifyBtn.disabled = true;
        return;
    }

    // ===== COMPUTE CORRECT ANSWERS =====
    correctFirst = computeFirstSets(grammar);
    correctFollow = computeFollowSets(grammar, correctFirst);

    // ===== RENDER GRAMMAR (Syntax-Highlighted) =====
    renderGrammar(engine.cfgText, grammar);

    // ===== GENERATE TABLE ROWS =====
    generateTable(grammar);

    // ===== INITIAL CONSOLE MESSAGE =====
    setConsole(
        'Welcome to the FIRST & FOLLOW Bridge!\n\n' +
        'Your grammar has been loaded.\n' +
        `Start symbol: ${grammar.startSymbol}\n` +
        `Non-terminals: {${grammar.nonTerminalOrder.join(', ')}}\n` +
        `Terminals: {${[...grammar.terminals].join(', ')}}\n\n` +
        'Fill in the FIRST and FOLLOW sets for each\n' +
        'non-terminal in the table, then click "Verify Answer".\n\n' +
        'Format: comma-separated symbols (e.g., a, b)\n' +
        'Use ε for epsilon, $ for end-of-input.'
    );


    // =================================================================
    //  RENDER GRAMMAR (same as Stage 6)
    // =================================================================

    function renderGrammar(cfgText, grammar) {
        const lines = cfgText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        let html = '';

        for (const line of lines) {
            const arrowIdx = line.indexOf('->');
            const unicodeIdx = line.indexOf('→');
            let lhs, rhsRaw;

            if (arrowIdx !== -1) {
                lhs = line.substring(0, arrowIdx).trim();
                rhsRaw = line.substring(arrowIdx + 2).trim();
            } else if (unicodeIdx !== -1) {
                lhs = line.substring(0, unicodeIdx).trim();
                rhsRaw = line.substring(unicodeIdx + 1).trim();
            } else {
                html += `<div class="production-line">${escapeHtml(line)}</div>`;
                continue;
            }

            let lineHtml = `<div class="production-line">`;
            lineHtml += `<span class="non-terminal">${escapeHtml(lhs)}</span>`;
            lineHtml += `<span class="arrow"> → </span>`;

            const alternatives = rhsRaw.split('|');
            alternatives.forEach((alt, i) => {
                const trimmed = alt.trim();
                if (i > 0) {
                    lineHtml += `<span class="pipe"> | </span>`;
                }
                if (trimmed === 'ε' || trimmed === 'epsilon' || trimmed === 'ε') {
                    lineHtml += `<span class="epsilon">ε</span>`;
                } else {
                    for (const ch of trimmed) {
                        if (ch === ' ') {
                            lineHtml += ' ';
                        } else if (grammar.nonTerminals.has(ch)) {
                            lineHtml += `<span class="non-terminal">${escapeHtml(ch)}</span>`;
                        } else {
                            lineHtml += `<span class="terminal-sym">${escapeHtml(ch)}</span>`;
                        }
                    }
                }
            });

            lineHtml += `</div>`;
            html += lineHtml;
        }

        grammarDisplay.innerHTML = html;
    }


    // =================================================================
    //  GENERATE DYNAMIC TABLE
    // =================================================================

    function generateTable(grammar) {
        tableBody.innerHTML = '';

        for (const nt of grammar.nonTerminalOrder) {
            const row = document.createElement('tr');
            row.dataset.nt = nt;

            // NT label cell
            const labelCell = document.createElement('td');
            labelCell.className = 'ff-label';
            labelCell.textContent = nt;
            row.appendChild(labelCell);

            // FIRST input cell
            const firstCell = document.createElement('td');
            const firstInput = document.createElement('input');
            firstInput.type = 'text';
            firstInput.className = 'ff-input';
            firstInput.id = `first-${nt}`;
            firstInput.placeholder = `FIRST(${nt})`;
            firstInput.spellcheck = false;
            firstInput.autocomplete = 'off';
            firstCell.appendChild(firstInput);
            row.appendChild(firstCell);

            // FOLLOW input cell
            const followCell = document.createElement('td');
            const followInput = document.createElement('input');
            followInput.type = 'text';
            followInput.className = 'ff-input';
            followInput.id = `follow-${nt}`;
            followInput.placeholder = `FOLLOW(${nt})`;
            followInput.spellcheck = false;
            followInput.autocomplete = 'off';
            followCell.appendChild(followInput);
            row.appendChild(followCell);

            tableBody.appendChild(row);
        }
    }


    // =================================================================
    //  VERIFY HANDLER
    // =================================================================

    verifyBtn.addEventListener('click', () => {
        if (completed) return;

        attempts++;
        attemptDisplay.innerText = `Attempt ${attempts}/${MAX_ATTEMPTS}`;

        let allCorrect = true;
        const results = [];

        for (const nt of grammar.nonTerminalOrder) {
            const firstInput = document.getElementById(`first-${nt}`);
            const followInput = document.getElementById(`follow-${nt}`);

            const userFirst = parseUserInput(firstInput.value);
            const userFollow = parseUserInput(followInput.value);

            const firstCorrect = setsEqual(userFirst, correctFirst[nt]);
            const followCorrect = setsEqual(userFollow, correctFollow[nt]);

            // Apply visual feedback
            firstInput.classList.remove('correct', 'wrong');
            followInput.classList.remove('correct', 'wrong');
            firstInput.classList.add(firstCorrect ? 'correct' : 'wrong');
            followInput.classList.add(followCorrect ? 'correct' : 'wrong');

            if (!firstCorrect || !followCorrect) allCorrect = false;

            results.push({
                nt,
                firstCorrect,
                followCorrect,
                userFirst,
                userFollow,
                expectedFirst: correctFirst[nt],
                expectedFollow: correctFollow[nt]
            });
        }

        if (allCorrect) {
            // ===== SUCCESS =====
            completed = true;
            const scoreMap = { 1: 200, 2: 150, 3: 100 };
            const points = scoreMap[attempts] || 100;
            addScore(points);
            glowElement(verifyBtn, 'correct');

            verifyBtn.disabled = true;
            verifyBtn.innerText = 'COMPLETED';

            // Lock all inputs
            document.querySelectorAll('.ff-input').forEach(inp => {
                inp.readOnly = true;
            });

            renderSuccessConsole(results, points);

            completeLevel(7);
            unlockLevel(8); // Unlock LL(1) Tower

            setTimeout(() => {
                fadeTransition(() => {
                    window.location.href = '../../map.html';
                });
            }, 2500);

        } else if (attempts >= MAX_ATTEMPTS) {
            // ===== FAILED 3x — reveal answers =====
            completed = true;
            shakeElement(verifyBtn);
            glowElement(verifyBtn, 'wrong');

            verifyBtn.disabled = true;
            verifyBtn.innerText = 'FAILED';

            // Lock all inputs
            document.querySelectorAll('.ff-input').forEach(inp => {
                inp.readOnly = true;
            });

            renderRevealConsole(results);

            completeLevel(7);
            unlockLevel(8);

            // Add continue button
            const continueBtn = document.createElement('button');
            continueBtn.className = 'btn btn-verify';
            continueBtn.innerText = 'Continue →';
            continueBtn.style.marginTop = '8px';
            continueBtn.addEventListener('click', () => {
                fadeTransition(() => {
                    window.location.href = '../../map.html';
                });
            });
            document.querySelector('.input-controls').appendChild(continueBtn);

        } else {
            // ===== WRONG — retry =====
            shakeElement(verifyBtn);
            glowElement(verifyBtn, 'wrong');
            addScore(-25);

            renderFeedbackConsole(results, attempts);
        }
    });


    // =================================================================
    //  CONSOLE RENDERERS
    // =================================================================

    function renderSuccessConsole(results, points) {
        let html = `<div style="color:#66bb6a;font-weight:700;font-size:1rem;margin-bottom:10px;">✓ All FIRST & FOLLOW sets are correct!</div>`;
        html += `<div style="color:#aaa;margin-bottom:12px;">Score +${points}</div>`;

        for (const r of results) {
            html += `<div class="ff-result-row">`;
            html += `<span class="ff-result-nt">${escapeHtml(r.nt)}</span>: `;
            html += `FIRST = <span class="ff-set-display">${formatSet(r.expectedFirst)}</span> `;
            html += `<span class="ff-result-correct">✓</span> · `;
            html += `FOLLOW = <span class="ff-set-display">${formatSet(r.expectedFollow)}</span> `;
            html += `<span class="ff-result-correct">✓</span>`;
            html += `</div>`;
        }

        html += `<div style="margin-top:12px;padding:10px;background:rgba(90,142,3,0.15);border-radius:6px;border:1px solid #5a8e03;">`;
        html += `<span style="color:#66bb6a;font-weight:700;">🌉 FIRST & FOLLOW Bridge Complete!</span><br>`;
        html += `<span style="color:#aaa;font-size:0.85rem;">Stage 7 cleared. Proceeding to LL(1) Tower...</span>`;
        html += `</div>`;

        setConsoleHTML(html);
    }

    function renderFeedbackConsole(results, attemptNum) {
        const wrongCount = results.filter(r => !r.firstCorrect || !r.followCorrect).length;
        let html = `<div style="color:#ef5350;font-weight:700;margin-bottom:8px;">[ERROR] ${wrongCount} non-terminal(s) have incorrect entries.</div>`;
        html += `<div style="color:#aaa;margin-bottom:10px;">${MAX_ATTEMPTS - attemptNum} attempt(s) remaining. Score -25</div>`;

        for (const r of results) {
            html += `<div class="ff-result-row">`;
            html += `<span class="ff-result-nt">${escapeHtml(r.nt)}</span>: `;

            // FIRST feedback
            html += `FIRST `;
            if (r.firstCorrect) {
                html += `<span class="ff-result-correct">✓</span>`;
            } else {
                html += `<span class="ff-result-wrong">✗ incorrect</span>`;
            }

            html += ` · FOLLOW `;
            if (r.followCorrect) {
                html += `<span class="ff-result-correct">✓</span>`;
            } else {
                html += `<span class="ff-result-wrong">✗ incorrect</span>`;
            }

            html += `</div>`;
        }

        html += `<div style="margin-top:10px;color:#888;font-size:0.82rem;">Review the grammar rules and try again. Use hints if needed.</div>`;

        setConsoleHTML(html);
    }

    function renderRevealConsole(results) {
        let html = `<div style="color:#ef5350;font-weight:700;font-size:1rem;margin-bottom:8px;">[FAILED] Maximum attempts reached.</div>`;
        html += `<div style="color:#aaa;margin-bottom:12px;">Correct answers:</div>`;

        for (const r of results) {
            html += `<div class="ff-result-row">`;
            html += `<span class="ff-result-nt">${escapeHtml(r.nt)}</span>:<br>`;
            html += `  FIRST = <span class="ff-set-display">${formatSet(r.expectedFirst)}</span> `;
            html += r.firstCorrect
                ? `<span class="ff-result-correct">✓</span>`
                : `<span class="ff-result-wrong">✗ (you had: ${formatSet(r.userFirst)})</span>`;
            html += `<br>`;
            html += `  FOLLOW = <span class="ff-set-display">${formatSet(r.expectedFollow)}</span> `;
            html += r.followCorrect
                ? `<span class="ff-result-correct">✓</span>`
                : `<span class="ff-result-wrong">✗ (you had: ${formatSet(r.userFollow)})</span>`;
            html += `</div>`;
        }

        html += `<div style="margin-top:10px;color:#888;font-size:0.82rem;">You may still proceed to the next stage.</div>`;

        setConsoleHTML(html);
    }


    // =================================================================
    //  RESET
    // =================================================================

    resetBtn.addEventListener('click', () => {
        if (completed) return;

        document.querySelectorAll('.ff-input').forEach(inp => {
            inp.value = '';
            inp.classList.remove('correct', 'wrong');
        });

        setConsole('All fields cleared. Try again.');
    });


    // =================================================================
    //  HINTS (Progressive)
    // =================================================================

    document.getElementById('btn-hint').addEventListener('click', () => {
        if (completed) return;

        const score = parseInt(document.getElementById('player-score').innerText) || 0;
        if (score < 50) {
            setConsole('[SYSTEM] Not enough score (need 50 pts) for a hint.', true);
            return;
        }
        addScore(-50);
        hintLevel++;

        if (hintLevel === 1) {
            // Hint 1: Rules summary
            setConsole(
                `[HINT 1/3] FIRST Set Rules:\n\n` +
                `For each non-terminal X:\n` +
                `  • If X → a... (starts with terminal a)\n` +
                `    → add 'a' to FIRST(X)\n` +
                `  • If X → Y... (starts with non-terminal Y)\n` +
                `    → add FIRST(Y) to FIRST(X)\n` +
                `  • If X → ε\n` +
                `    → add ε to FIRST(X)\n` +
                `  • If X → Y₁Y₂... and ε ∈ FIRST(Y₁)\n` +
                `    → also add FIRST(Y₂), etc.\n\n` +
                `Start symbol: ${grammar.startSymbol}\n` +
                `Terminals: {${[...grammar.terminals].join(', ')}}`
            );
        } else if (hintLevel === 2) {
            // Hint 2: Reveal all FIRST sets
            let msg = `[HINT 2/3] Correct FIRST sets:\n\n`;
            for (const nt of grammar.nonTerminalOrder) {
                msg += `  FIRST(${nt}) = ${formatSet(correctFirst[nt])}\n`;

                // Auto-fill the FIRST inputs
                const input = document.getElementById(`first-${nt}`);
                if (input && !input.readOnly) {
                    input.value = [...correctFirst[nt]].join(', ');
                    input.classList.remove('wrong');
                    input.classList.add('correct');
                }
            }
            msg += `\nFIRST sets have been auto-filled.\nNow compute the FOLLOW sets.`;
            setConsole(msg);
        } else {
            // Hint 3: Reveal all FOLLOW sets
            let msg = `[HINT 3/3] Correct FOLLOW sets:\n\n`;
            for (const nt of grammar.nonTerminalOrder) {
                msg += `  FOLLOW(${nt}) = ${formatSet(correctFollow[nt])}\n`;

                // Auto-fill the FOLLOW inputs
                const input = document.getElementById(`follow-${nt}`);
                if (input && !input.readOnly) {
                    input.value = [...correctFollow[nt]].join(', ');
                    input.classList.remove('wrong');
                    input.classList.add('correct');
                }
            }
            msg += `\nFOLLOW sets have been auto-filled.\nClick "Verify Answer" to confirm.`;
            setConsole(msg);
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
