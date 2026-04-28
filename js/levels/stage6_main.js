// js/levels/stage6_main.js — Grammar Temple (Stage 6)
// User validates whether strings belong to a Context-Free Grammar.
// Uses recursive leftmost derivation with depth limiting.

import { updateScoreUI, addScore } from '../utils/score.js';
import { unlockLevel, completeLevel } from '../utils/storage.js';
import { getStoredEngine } from '../engine/global_engine.js';
import { fadeTransition, shakeElement, glowElement } from '../ui/animations.js';

// ===== CONSTANTS =====
const MAX_DERIVATION_DEPTH = 50;
const VALIDATIONS_TO_COMPLETE = 3;

// ===================================================================
//  GRAMMAR PARSER — converts raw CFG text into structured format
// ===================================================================

function parseGrammar(cfgText) {
    const lines = cfgText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    if (lines.length === 0) return null;

    const productions = {};
    const nonTerminals = new Set();
    const allSymbols = new Set();
    let startSymbol = null;

    for (const line of lines) {
        // Support both -> and →
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
            continue; // skip malformed lines
        }

        if (!lhs || !rhsRaw) continue;

        if (!startSymbol) startSymbol = lhs;
        nonTerminals.add(lhs);

        // Split alternatives by |
        const alternatives = rhsRaw.split('|').map(a => a.trim());
        if (!productions[lhs]) productions[lhs] = [];

        for (const alt of alternatives) {
            if (alt === 'ε' || alt === 'epsilon' || alt === 'ε' || alt === 'e' && alt.length === 1) {
                // Check specifically: single 'e' is ambiguous, only treat as epsilon if it says epsilon/ε
                // We'll treat 'ε' and 'epsilon' as epsilon, not standalone 'e'
                if (alt === 'ε' || alt === 'epsilon' || alt === 'ε') {
                    productions[lhs].push([]); // empty production
                } else {
                    // 'e' treated as terminal
                    const symbols = tokenizeProduction(alt);
                    productions[lhs].push(symbols);
                    symbols.forEach(s => allSymbols.add(s));
                }
            } else {
                const symbols = tokenizeProduction(alt);
                productions[lhs].push(symbols);
                symbols.forEach(s => allSymbols.add(s));
            }
        }
    }

    if (!startSymbol) return null;

    // Determine terminals: all symbols that are not non-terminals
    const terminals = new Set();
    allSymbols.forEach(s => {
        if (!nonTerminals.has(s)) terminals.add(s);
    });

    return { startSymbol, nonTerminals, terminals, productions };
}

/**
 * Tokenize a production's right-hand side into individual symbols.
 * Handles multi-character non-terminals (e.g., "A B" space-separated)
 * and single-character terminals that might be concatenated (e.g., "aSb").
 */
function tokenizeProduction(rhs) {
    const trimmed = rhs.trim();

    // If the RHS contains spaces, treat as space-separated symbols
    if (trimmed.includes(' ')) {
        return trimmed.split(/\s+/).filter(s => s.length > 0);
    }

    // No spaces: split character by character, grouping consecutive
    // uppercase letters as potential multi-char non-terminals only if
    // they're single uppercase letters (standard CFG convention)
    const symbols = [];
    for (let i = 0; i < trimmed.length; i++) {
        symbols.push(trimmed[i]);
    }
    return symbols;
}


// ===================================================================
//  STRING VALIDATOR — recursive leftmost derivation
// ===================================================================

function validateString(grammar, inputString) {
    const { startSymbol, nonTerminals, productions } = grammar;
    const target = inputString;

    // Memoization to avoid re-exploring identical states
    const visited = new Set();

    function isNonTerminal(symbol) {
        return nonTerminals.has(symbol);
    }

    /**
     * Attempt to derive 'target' from the given sentential form.
     * Uses leftmost derivation (always expand the leftmost non-terminal).
     * Returns { success: boolean, steps: string[] }
     */
    function derive(form, depth, steps) {
        // Depth check
        if (depth > MAX_DERIVATION_DEPTH) {
            return { success: false, reason: 'Derivation depth limit exceeded' };
        }

        // Build string representation of current form
        const formStr = form.join('');

        // Memoization: avoid revisiting the same sentential form
        const stateKey = formStr + '|' + depth;
        if (visited.has(formStr)) return { success: false };
        visited.add(formStr);

        // Find the leftmost non-terminal
        let ntIndex = -1;
        for (let i = 0; i < form.length; i++) {
            if (isNonTerminal(form[i])) {
                ntIndex = i;
                break;
            }
        }

        // No non-terminal found: sentential form is all terminals
        if (ntIndex === -1) {
            if (formStr === target) {
                return { success: true, steps };
            }
            return { success: false };
        }

        // Pruning: if the terminal prefix doesn't match target, abort
        let terminalPrefix = '';
        for (let i = 0; i < ntIndex; i++) {
            terminalPrefix += form[i];
        }
        if (!target.startsWith(terminalPrefix)) {
            return { success: false };
        }

        // Count remaining non-terminals for length pruning
        const terminalLength = form.filter(s => !isNonTerminal(s)).join('').length;
        // If we already have more terminal characters than the target, prune
        if (terminalLength > target.length) {
            return { success: false };
        }

        const nt = form[ntIndex];
        const prods = productions[nt];
        if (!prods) return { success: false };

        // Try each production for this non-terminal
        for (const prod of prods) {
            const newForm = [
                ...form.slice(0, ntIndex),
                ...prod,
                ...form.slice(ntIndex + 1)
            ];

            const newFormStr = newForm.join('');
            const newSteps = [...steps, formatDerivationStep(newForm, grammar)];

            const result = derive(newForm, depth + 1, newSteps);
            if (result.success) return result;
        }

        return { success: false };
    }

    // Start derivation from the start symbol
    const initialForm = [startSymbol];
    const initialStep = formatDerivationStep(initialForm, grammar);

    const result = derive(initialForm, 0, [initialStep]);

    if (result.success) {
        return {
            accepted: true,
            derivation: result.steps,
            reason: null
        };
    }

    // Determine rejection reason
    let reason = 'String cannot be derived from the grammar';

    // Check if input contains characters not in the terminal set
    const invalidChars = [];
    for (const ch of inputString) {
        if (!grammar.terminals.has(ch)) {
            invalidChars.push(ch);
        }
    }
    if (invalidChars.length > 0) {
        const unique = [...new Set(invalidChars)];
        reason = `Invalid character(s): "${unique.join('", "')}" — not in the grammar's terminal set {${[...grammar.terminals].join(', ')}}`;
    }

    return {
        accepted: false,
        derivation: [],
        reason
    };
}

/**
 * Format a sentential form for display, highlighting non-terminals.
 */
function formatDerivationStep(form, grammar) {
    if (form.length === 0) return 'ε';
    return form.map(s => s).join('');
}

/**
 * Generate a sample accepted string by random derivation.
 * Used for hints.
 */
function generateSampleString(grammar, maxDepth = 15) {
    const { startSymbol, nonTerminals, productions } = grammar;

    function expand(symbol, depth) {
        if (!nonTerminals.has(symbol)) return symbol;
        if (depth > maxDepth) {
            // Try to find an epsilon or shortest production
            const prods = productions[symbol] || [[]];
            const shortest = prods.reduce((a, b) => a.length <= b.length ? a : b);
            return shortest.map(s => expand(s, depth + 1)).join('');
        }

        const prods = productions[symbol];
        if (!prods || prods.length === 0) return '';

        // Pick a random production, bias towards shorter ones at high depth
        let chosen;
        if (depth > maxDepth / 2) {
            chosen = prods.reduce((a, b) => a.length <= b.length ? a : b);
        } else {
            chosen = prods[Math.floor(Math.random() * prods.length)];
        }

        return chosen.map(s => expand(s, depth + 1)).join('');
    }

    const result = expand(startSymbol, 0);
    return result || 'ε';
}


// ===================================================================
//  DOM READY — Wire up the stage UI
// ===================================================================

document.addEventListener('DOMContentLoaded', () => {
    updateScoreUI();

    // DOM references
    const grammarDisplay  = document.getElementById('grammar-display');
    const stringInput     = document.getElementById('string-input');
    const consoleBox      = document.getElementById('output-msg');
    const validateBtn     = document.getElementById('btn-validate');
    const clearBtn        = document.getElementById('btn-clear');
    const counterDisplay  = document.getElementById('validation-counter');
    const completeBar     = document.getElementById('complete-bar');
    const completeBtn     = document.getElementById('btn-complete');

    let validationCount = 0;
    let firstAcceptedDone = false;
    let completed = false;
    let hintLevel = 0;
    let grammar = null;
    const validationHistory = [];

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
        validateBtn.disabled = true;
        return;
    }

    // ===== PARSE GRAMMAR =====
    grammar = parseGrammar(engine.cfgText);
    if (!grammar) {
        setConsole('[ERROR] Invalid grammar format.\nCould not parse the CFG from Stage 1.\nGrammar must use "->" or "→" format.', true);
        validateBtn.disabled = true;
        return;
    }

    // ===== RENDER GRAMMAR (Syntax-Highlighted) =====
    renderGrammar(engine.cfgText, grammar);

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

            // Syntax-highlight the production
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
                    // Highlight each character
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

    // ===== INITIAL CONSOLE MESSAGE =====
    setConsole(
        'Welcome to Grammar Temple!\n\n' +
        'Your grammar has been loaded.\n' +
        `Start symbol: ${grammar.startSymbol}\n` +
        `Non-terminals: {${[...grammar.nonTerminals].join(', ')}}\n` +
        `Terminals: {${[...grammar.terminals].join(', ')}}\n\n` +
        'Enter a string in the input field and click\n"Validate String" to check if it belongs to this grammar.'
    );

    // ===== VALIDATE HANDLER =====
    validateBtn.addEventListener('click', () => {
        if (completed) return;

        let inputStr = stringInput.value;

        // Treat ε input as empty string
        if (inputStr.trim() === 'ε' || inputStr.trim() === 'epsilon') {
            inputStr = '';
        } else {
            inputStr = inputStr.trim();
        }

        // Validate the string
        const result = validateString(grammar, inputStr);
        validationCount++;
        counterDisplay.innerText = `${validationCount} / ${VALIDATIONS_TO_COMPLETE} validations`;

        const displayStr = inputStr === '' ? 'ε' : inputStr;

        // Build result entry
        const entry = {
            string: displayStr,
            accepted: result.accepted,
            reason: result.reason,
            derivation: result.derivation
        };
        validationHistory.push(entry);

        // Scoring
        if (result.accepted) {
            if (!firstAcceptedDone) {
                addScore(100);
                firstAcceptedDone = true;
            } else {
                addScore(25);
            }
            glowElement(validateBtn, 'correct');
        } else {
            addScore(10);
            glowElement(validateBtn, 'wrong');
        }

        // Render full history in console
        renderValidationHistory();

        // Check completion
        if (validationCount >= VALIDATIONS_TO_COMPLETE && !completed) {
            completeBar.classList.add('visible');
        }
    });

    function renderValidationHistory() {
        let html = '';

        validationHistory.forEach((entry, idx) => {
            html += `<div class="result-entry">`;
            html += `<span class="result-string">${escapeHtml(entry.string)}</span> → `;

            if (entry.accepted) {
                html += `<span class="result-accepted">✓ Accepted</span>`;
                if (entry.derivation && entry.derivation.length > 0) {
                    const chain = entry.derivation.join(' → ');
                    html += `<div class="derivation-chain">${escapeHtml(chain)}</div>`;
                }
            } else {
                html += `<span class="result-rejected">✗ Rejected</span>`;
                if (entry.reason) {
                    html += `<span class="result-reason">${escapeHtml(entry.reason)}</span>`;
                }
            }

            html += `</div>`;
        });

        // Append stats
        const acceptedCount = validationHistory.filter(e => e.accepted).length;
        const rejectedCount = validationHistory.filter(e => !e.accepted).length;
        html += `<div style="margin-top:10px;padding-top:8px;border-top:1px solid #444;color:#888;font-size:0.8rem;">`;
        html += `Total: ${validationHistory.length} | `;
        html += `<span style="color:#66bb6a;">Accepted: ${acceptedCount}</span> | `;
        html += `<span style="color:#ef5350;">Rejected: ${rejectedCount}</span>`;
        html += `</div>`;

        setConsoleHTML(html);
    }

    // ===== CLEAR =====
    clearBtn.addEventListener('click', () => {
        stringInput.value = '';
        stringInput.focus();
    });

    // ===== COMPLETE =====
    completeBtn.addEventListener('click', () => {
        if (completed) return;
        completed = true;

        addScore(50); // Completion bonus

        validateBtn.disabled = true;
        validateBtn.innerText = 'COMPLETED';
        completeBtn.disabled = true;
        completeBtn.innerText = 'COMPLETED ✓';

        completeLevel(6);
        unlockLevel(7); // Unlock FIRST & FOLLOW

        // Add completion message to console
        const currentHTML = consoleBox.innerHTML;
        consoleBox.innerHTML = currentHTML +
            `<div style="margin-top:12px;padding:10px;background:rgba(90,142,3,0.15);border-radius:6px;border:1px solid #5a8e03;">` +
            `<span style="color:#66bb6a;font-weight:700;">🏛️ Grammar Temple Complete!</span><br>` +
            `<span style="color:#aaa;font-size:0.85rem;">Stage 6 cleared. Score +50 bonus. Proceeding to FIRST & FOLLOW...</span>` +
            `</div>`;

        setTimeout(() => {
            fadeTransition(() => {
                window.location.href = '../../map.html';
            });
        }, 2500);
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
        hintLevel++;

        if (hintLevel === 1) {
            // Hint 1: Grammar overview
            setConsole(
                `[HINT 1/3] Grammar Overview:\n\n` +
                `Start symbol: ${grammar.startSymbol}\n` +
                `Non-terminals: {${[...grammar.nonTerminals].join(', ')}}\n` +
                `Terminals: {${[...grammar.terminals].join(', ')}}\n\n` +
                `Strings in this language are composed ONLY of\n` +
                `the terminal symbols listed above.\n\n` +
                `Try entering a string made of these characters.`
            );
        } else if (hintLevel === 2) {
            // Hint 2: Generate a sample accepted string
            const sample = generateSampleString(grammar);
            setConsole(
                `[HINT 2/3] Sample Valid String:\n\n` +
                `The string "${sample}" is accepted by this grammar.\n\n` +
                `Try entering it to see the derivation, then\n` +
                `experiment with variations.`
            );
        } else {
            // Hint 3: Show derivation of sample
            const sample = generateSampleString(grammar);
            const result = validateString(grammar, sample);
            let derivationStr = 'Could not derive sample within depth limit.';
            if (result.accepted && result.derivation.length > 0) {
                const steps = result.derivation.slice(0, 5);
                derivationStr = steps.join(' → ');
                if (result.derivation.length > 5) {
                    derivationStr += ' → ...';
                }
            }
            setConsole(
                `[HINT 3/3] Derivation Example:\n\n` +
                `String: "${sample}"\n` +
                `Derivation: ${derivationStr}\n\n` +
                `Each step replaces the leftmost non-terminal\n` +
                `with one of its production rules.\n\n` +
                `No more hints available.`
            );
        }
    });

    // ===== EXIT =====
    document.getElementById('btn-exit').addEventListener('click', () => {
        window.location.href = '../../map.html';
    });

    // ===== Enter key triggers validation =====
    stringInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !completed) {
            validateBtn.click();
        }
    });

    // ===== HELPERS =====
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
});
