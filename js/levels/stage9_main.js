// js/levels/stage9_main.js — Symbol Table City (Stage 9)
// User completes a partially filled symbol table from the source code.
// System analyzes the code, blanks random fields, and validates.

import { updateScoreUI, addScore } from '../utils/score.js';
import { unlockLevel, completeLevel } from '../utils/storage.js';
import { getStoredEngine } from '../engine/global_engine.js';
import { fadeTransition, shakeElement, glowElement } from '../ui/animations.js';

// ===== CONSTANTS =====
const MAX_ATTEMPTS = 3;

// ===================================================================
//  CODE ANALYSIS — Extract symbol table from C source code
// ===================================================================

/**
 * Analyze C source code and extract a symbol table.
 * Each entry: { name, type, value, scope, line }
 * @param {string} code - Raw C source code
 * @returns {object[]} Array of symbol table entries
 */
function analyzeCode(code) {
    const lines = code.split('\n');
    const symbols = [];
    const seenNames = new Set();

    // Track scope: count brace depth
    let braceDepth = 0;
    // Track if we've entered any block at all to determine global vs local
    // Variables at depth 0 = global, depth > 0 = local
    let initialBraceDepth = 0;

    // We scan through lines to find brace-depth changes and variable declarations
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const rawLine = lines[lineIdx];
        const trimLine = rawLine.trim();
        const lineNum = lineIdx + 1;

        if (trimLine === '' || trimLine.startsWith('//') || trimLine.startsWith('#')) {
            // Still count braces in preprocessor directives (unlikely but safe)
            for (const ch of trimLine) {
                if (ch === '{') braceDepth++;
                if (ch === '}') braceDepth = Math.max(0, braceDepth - 1);
            }
            continue;
        }

        // Count opening/closing braces BEFORE this line to get scope context
        // Approach: parse character by character, handle braces, then look for declarations
        const scopeAtStart = braceDepth;

        // Try to extract variable declarations from this line
        const decls = extractDeclarations(trimLine, lineNum, scopeAtStart);
        for (const decl of decls) {
            if (!seenNames.has(decl.name)) {
                seenNames.add(decl.name);
                symbols.push(decl);
            }
        }

        // Update brace depth AFTER processing declarations (for next line)
        for (const ch of trimLine) {
            if (ch === '{') braceDepth++;
            if (ch === '}') braceDepth = Math.max(0, braceDepth - 1);
        }
    }

    return symbols;
}

/**
 * Extract variable declarations from a single line of C code.
 * Handles: int x; int x = 5; float a, b; int x = 0, y = 1;
 * Also handles for-loop initializers: for(int i = 0; ...)
 * @returns {object[]} Array of { name, type, value, scope, line }
 */
function extractDeclarations(line, lineNum, braceDepth) {
    const results = [];
    const dataTypes = ['int', 'float', 'double', 'char', 'long', 'short', 'unsigned', 'void', 'string'];

    // Handle for-loop initializers: for(int i = 0; ...)
    const forMatch = line.match(/for\s*\(\s*(int|float|double|char|long|short)\s+(.+?);/);
    if (forMatch) {
        const type = forMatch[1];
        const declPart = forMatch[2];
        const forDecls = parseVarList(declPart, type, lineNum, braceDepth + 1); // for-body is local
        results.push(...forDecls);
    }

    // Handle standard declarations: type var = val;
    // Match: type identifier(s) [= value(s)] [, ...] ;
    for (const dtype of dataTypes) {
        // Pattern: starts with a data type, followed by at least one identifier
        const pattern = new RegExp('^' + dtype + '\\s+(.+?)\\s*;', '');
        const match = line.match(pattern);
        if (match) {
            const declPart = match[1];
            const decls = parseVarList(declPart, dtype, lineNum, braceDepth);
            results.push(...decls);
            break; // Only one type declaration per line
        }
    }

    return results;
}

/**
 * Parse a comma-separated variable list: "x = 5, y, z = 10"
 * @returns {object[]}
 */
function parseVarList(declPart, type, lineNum, braceDepth) {
    const results = [];
    const parts = declPart.split(',');

    for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        // Match: identifier = value  OR  just identifier
        const assignMatch = trimmed.match(/^([a-zA-Z_]\w*)\s*=\s*(.+)$/);
        if (assignMatch) {
            const name = assignMatch[1].trim();
            let value = assignMatch[2].trim();
            // Clean up value: remove trailing non-value chars
            value = value.replace(/[;,]$/, '').trim();
            // For expressions, simplify
            if (/^[0-9]+(\.[0-9]+)?$/.test(value)) {
                // It's a simple number, keep it
            } else if (/^"[^"]*"$/.test(value)) {
                // String literal, keep it
            } else if (/^'[^']*'$/.test(value)) {
                // Char literal, keep it
            } else {
                // Complex expression — keep as-is for display
            }
            results.push({
                name,
                type,
                value,
                scope: braceDepth > 0 ? 'local' : 'global',
                line: String(lineNum)
            });
        } else {
            // Just an identifier, no assignment
            const identMatch = trimmed.match(/^([a-zA-Z_]\w*)/);
            if (identMatch) {
                results.push({
                    name: identMatch[1],
                    type,
                    value: '—',
                    scope: braceDepth > 0 ? 'local' : 'global',
                    line: String(lineNum)
                });
            }
        }
    }

    return results;
}


// ===================================================================
//  TABLE GENERATION — Blank random fields for user input
// ===================================================================

/**
 * Generate the user-facing table with some cells blanked out.
 * Each entry gets a mask: { type, value, scope, line }
 * true = show (pre-filled), false = blank (user must fill)
 *
 * Strategy: for each row, blank 2 of the 4 fields.
 * Always keep 'Identifier' visible. Mix the blanked columns.
 *
 * @param {object[]} symbols - Correct symbol table
 * @returns {object[]} symbols with added `mask` property
 */
function generateMasks(symbols) {
    const fields = ['type', 'value', 'scope', 'line'];

    // Distribute blanks evenly across all cells
    // For each row, blank 2 fields (out of 4)
    const patterns = [
        { type: false, value: false, scope: true, line: true },
        { type: true, value: false, scope: false, line: true },
        { type: true, value: true, scope: false, line: false },
        { type: false, value: true, scope: true, line: false },
        { type: false, value: true, scope: false, line: true },
        { type: true, value: false, scope: true, line: false },
    ];

    // Assign patterns round-robin with some shuffling
    const shuffled = [...patterns].sort(() => Math.random() - 0.5);

    return symbols.map((sym, i) => ({
        ...sym,
        mask: shuffled[i % shuffled.length]
    }));
}


// ===================================================================
//  HELPERS (module-level)
// ===================================================================

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}


// ===================================================================
//  CODE RENDERING — Syntax-highlighted source code display
// ===================================================================

function renderSourceCode(code, container) {
    const KEYWORDS = new Set(['if', 'else', 'for', 'while', 'do', 'return', 'switch', 'case', 'break', 'continue', 'struct', 'typedef']);
    const TYPES = new Set(['int', 'float', 'double', 'char', 'void', 'long', 'short', 'unsigned', 'string']);
    const FUNCTIONS = new Set(['printf', 'scanf', 'main', 'strlen', 'strcpy', 'malloc', 'free', 'sizeof']);

    const lines = code.split('\n');
    let html = '';

    for (const line of lines) {
        let lineHtml = '<span class="code-line">';

        // Tokenize the line for coloring
        const regex = /("(?:[^"\\]|\\.)*")|('(?:[^'\\]|\\.)*')|(\/\/.*$)|(#\w+)|([a-zA-Z_]\w*)|([0-9]+(?:\.[0-9]+)?)|([<>=!+\-*/%&|^~]+(?:=)?)|([;(){},\[\]])|(\s+)/g;
        let match;
        let lastIdx = 0;

        while ((match = regex.exec(line)) !== null) {
            // Add any unmatched characters
            if (match.index > lastIdx) {
                lineHtml += escapeHtml(line.substring(lastIdx, match.index));
            }
            lastIdx = match.index + match[0].length;

            const token = match[0];

            if (match[1]) {
                // String literal
                lineHtml += `<span class="code-string">${escapeHtml(token)}</span>`;
            } else if (match[2]) {
                // Char literal
                lineHtml += `<span class="code-string">${escapeHtml(token)}</span>`;
            } else if (match[3]) {
                // Comment
                lineHtml += `<span style="color:#546e7a;">${escapeHtml(token)}</span>`;
            } else if (match[4]) {
                // Preprocessor
                lineHtml += `<span class="code-keyword">${escapeHtml(token)}</span>`;
            } else if (match[5]) {
                // Identifier or keyword
                if (KEYWORDS.has(token)) {
                    lineHtml += `<span class="code-keyword">${escapeHtml(token)}</span>`;
                } else if (TYPES.has(token)) {
                    lineHtml += `<span class="code-type">${escapeHtml(token)}</span>`;
                } else if (FUNCTIONS.has(token)) {
                    lineHtml += `<span class="code-func">${escapeHtml(token)}</span>`;
                } else {
                    lineHtml += `<span class="code-ident">${escapeHtml(token)}</span>`;
                }
            } else if (match[6]) {
                // Number
                lineHtml += `<span class="code-number">${escapeHtml(token)}</span>`;
            } else if (match[7]) {
                // Operator
                lineHtml += `<span class="code-operator">${escapeHtml(token)}</span>`;
            } else if (match[8]) {
                // Delimiter
                lineHtml += `<span class="code-delim">${escapeHtml(token)}</span>`;
            } else {
                // Whitespace or other
                lineHtml += escapeHtml(token);
            }
        }

        // Any remaining
        if (lastIdx < line.length) {
            lineHtml += escapeHtml(line.substring(lastIdx));
        }

        lineHtml += '</span>';
        html += lineHtml;
    }

    container.innerHTML = html;
}


// ===================================================================
//  DOM READY — Wire up Stage 9 UI
// ===================================================================

document.addEventListener('DOMContentLoaded', () => {
    updateScoreUI();

    // DOM references
    const codeDisplay    = document.getElementById('code-display');
    const stBody         = document.getElementById('st-body');
    const consoleBox     = document.getElementById('output-msg');
    const verifyBtn      = document.getElementById('btn-verify');
    const resetBtn       = document.getElementById('btn-reset');
    const attemptDisplay = document.getElementById('attempt-display');

    let attempts = 0;
    let completed = false;
    let hintLevel = 0;
    let symbols = [];     // Correct symbol table
    let maskedSymbols = []; // With blanked fields

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
    if (!engine || !engine.sourceCode) {
        setConsole('[ERROR] No source code found.\nPlease complete Stage 1 first.', true);
        verifyBtn.disabled = true;
        return;
    }

    // ===== RENDER SOURCE CODE =====
    renderSourceCode(engine.sourceCode, codeDisplay);

    // ===== ANALYZE CODE & BUILD SYMBOL TABLE =====
    symbols = analyzeCode(engine.sourceCode);

    // If no symbols found, use a fallback demo code
    if (symbols.length === 0) {
        const demoCode = 'int x = 10;\nint y = 20;\nint sum = x + y;';
        symbols = analyzeCode(demoCode);
        renderSourceCode(demoCode, codeDisplay);

        setConsoleHTML(
            `<div style="color:#ff9800;font-weight:700;margin-bottom:8px;">⚠ No variable declarations found in your code.</div>` +
            `<div style="color:#aaa;">Using demo code for the symbol table exercise.</div>`
        );
    } else {
        setConsole(
            `Welcome to Symbol Table City!\n\n` +
            `${symbols.length} identifier(s) found in your code.\n\n` +
            `Fill in the blank cells and click "Verify Table".\n\n` +
            `• Type: the data type (int, float, etc.)\n` +
            `• Value: the assigned value (or — if none)\n` +
            `• Scope: global or local\n` +
            `• Line: the line number of declaration`
        );
    }

    // ===== GENERATE MASKS & RENDER TABLE =====
    maskedSymbols = generateMasks(symbols);
    renderTable(maskedSymbols);


    // =================================================================
    //  RENDER SYMBOL TABLE
    // =================================================================

    function renderTable(maskedList) {
        stBody.innerHTML = '';

        for (let i = 0; i < maskedList.length; i++) {
            const sym = maskedList[i];
            const row = document.createElement('tr');
            row.dataset.idx = i;

            // Identifier — always shown
            const idCell = document.createElement('td');
            idCell.className = 'st-fixed';
            idCell.textContent = sym.name;
            row.appendChild(idCell);

            // Type
            row.appendChild(createCell(sym, 'type', i));

            // Value
            row.appendChild(createCell(sym, 'value', i));

            // Scope
            row.appendChild(createCell(sym, 'scope', i));

            // Line
            row.appendChild(createCell(sym, 'line', i));

            stBody.appendChild(row);
        }
    }

    function createCell(sym, field, rowIdx) {
        const td = document.createElement('td');

        if (sym.mask[field]) {
            // Pre-filled (read-only)
            td.className = 'st-fixed';
            td.textContent = sym[field];
        } else {
            // Blank — editable
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'st-input';
            input.id = `st-${field}-${rowIdx}`;
            input.spellcheck = false;
            input.autocomplete = 'off';
            input.dataset.field = field;
            input.dataset.row = rowIdx;

            // Placeholder hints
            const placeholders = {
                type: 'e.g. int',
                value: 'e.g. 0 or —',
                scope: 'global / local',
                line: 'e.g. 1'
            };
            input.placeholder = placeholders[field] || '';

            td.appendChild(input);
        }

        return td;
    }


    // =================================================================
    //  VERIFY HANDLER
    // =================================================================

    verifyBtn.addEventListener('click', () => {
        if (completed) return;

        attempts++;
        attemptDisplay.innerText = `Attempt ${attempts}/${MAX_ATTEMPTS}`;

        let allCorrect = true;
        const errors = [];

        for (let i = 0; i < maskedSymbols.length; i++) {
            const sym = maskedSymbols[i];

            for (const field of ['type', 'value', 'scope', 'line']) {
                if (sym.mask[field]) continue; // Pre-filled, skip

                const input = document.getElementById(`st-${field}-${i}`);
                if (!input) continue;

                const userVal = normalizeValue(input.value.trim(), field);
                const correct = normalizeValue(sym[field], field);

                input.classList.remove('correct', 'wrong');

                if (userVal === correct) {
                    input.classList.add('correct');
                } else {
                    input.classList.add('wrong');
                    allCorrect = false;
                    errors.push({
                        name: sym.name,
                        field,
                        expected: sym[field],
                        got: input.value.trim() || '(empty)'
                    });
                }
            }
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
            lockAllInputs();

            renderSuccessConsole(points);

            completeLevel(9);
            // No next level to unlock — final stage!

            setTimeout(() => {
                fadeTransition(() => {
                    window.location.href = '../../map.html';
                });
            }, 3000);

        } else if (attempts >= MAX_ATTEMPTS) {
            // ===== FAILED 3x — reveal answers =====
            completed = true;
            shakeElement(verifyBtn);
            glowElement(verifyBtn, 'wrong');

            verifyBtn.disabled = true;
            verifyBtn.innerText = 'FAILED';

            lockAllInputs();
            renderRevealConsole(errors);

            completeLevel(9);

            // Add continue button
            const continueBtn = document.createElement('button');
            continueBtn.className = 'btn btn-verify';
            continueBtn.innerText = 'Finish Game →';
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

            renderFeedbackConsole(errors);
        }
    });


    // =================================================================
    //  NORMALIZATION — Flexible matching for user inputs
    // =================================================================

    function normalizeValue(val, field) {
        if (!val) return '';
        let v = val.trim().toLowerCase();

        if (field === 'scope') {
            // Accept various scope inputs
            if (v === 'g' || v === 'glob' || v === 'global') return 'global';
            if (v === 'l' || v === 'loc' || v === 'local') return 'local';
            return v;
        }

        if (field === 'line') {
            // Accept just the number
            return v.replace(/[^0-9]/g, '');
        }

        if (field === 'value') {
            // Normalize dash variants for "no value"
            if (v === '-' || v === '—' || v === '–' || v === 'none' || v === 'n/a' || v === 'null' || v === 'undefined') {
                return '—';
            }
            return v;
        }

        // Type: direct lowercase match
        return v;
    }


    // =================================================================
    //  CONSOLE RENDERERS
    // =================================================================

    function renderSuccessConsole(points) {
        let html = `<div style="color:#66bb6a;font-weight:700;font-size:1rem;margin-bottom:10px;">✓ Symbol Table Complete!</div>`;
        html += `<div style="color:#aaa;margin-bottom:12px;">Score +${points}</div>`;

        // Show the full correct table
        html += renderCorrectTable();

        html += `<div style="margin-top:12px;padding:10px;background:rgba(90,142,3,0.15);border-radius:6px;border:1px solid #5a8e03;">`;
        html += `<span style="color:#66bb6a;font-weight:700;">🏙️ Symbol Table City Conquered!</span><br>`;
        html += `<span style="color:#aaa;font-size:0.85rem;">You've completed the final stage. All compiler phases mastered!</span>`;
        html += `</div>`;

        setConsoleHTML(html);
    }

    function renderFeedbackConsole(errors) {
        let html = `<div style="color:#ef5350;font-weight:700;margin-bottom:8px;">[ERROR] ${errors.length} field(s) are incorrect.</div>`;
        html += `<div style="color:#aaa;margin-bottom:10px;">${MAX_ATTEMPTS - attempts} attempt(s) remaining. Score -25</div>`;

        for (const e of errors) {
            const fieldLabels = { type: 'Type', value: 'Value', scope: 'Scope', line: 'Line' };
            html += `<div style="color:#ef9a9a;font-size:0.85rem;margin:3px 0;">`;
            html += `• <span style="color:#81d4fa;font-weight:600;">${escapeHtml(e.name)}</span> → `;
            html += `${fieldLabels[e.field]} is incorrect`;
            html += `</div>`;
        }

        html += `<div style="margin-top:10px;color:#888;font-size:0.82rem;">Review the source code and try again. Use hints if needed.</div>`;

        setConsoleHTML(html);
    }

    function renderRevealConsole(errors) {
        let html = `<div style="color:#ef5350;font-weight:700;font-size:1rem;margin-bottom:8px;">[FAILED] Maximum attempts reached.</div>`;
        html += `<div style="color:#aaa;margin-bottom:12px;">Correct symbol table:</div>`;

        html += renderCorrectTable();

        if (errors.length > 0) {
            html += `<div style="margin-top:10px;color:#888;font-size:0.82rem;">Your errors:</div>`;
            for (const e of errors) {
                const fieldLabels = { type: 'Type', value: 'Value', scope: 'Scope', line: 'Line' };
                html += `<div style="color:#ef9a9a;font-size:0.82rem;margin:2px 0;">`;
                html += `• ${escapeHtml(e.name)}.${fieldLabels[e.field]}: expected "${e.expected}", got "${escapeHtml(e.got)}"`;
                html += `</div>`;
            }
        }

        html += `<div style="margin-top:10px;color:#888;font-size:0.82rem;">You may still finish the game.</div>`;

        setConsoleHTML(html);
    }

    function renderCorrectTable() {
        let html = `<table class="result-table">`;
        html += `<thead><tr><th>Identifier</th><th>Type</th><th>Value</th><th>Scope</th><th>Line</th></tr></thead>`;
        html += `<tbody>`;

        for (const sym of symbols) {
            html += `<tr>`;
            html += `<td style="color:#81d4fa;font-weight:700;">${escapeHtml(sym.name)}</td>`;
            html += `<td>${escapeHtml(sym.type)}</td>`;
            html += `<td>${escapeHtml(sym.value)}</td>`;
            html += `<td>${escapeHtml(sym.scope)}</td>`;
            html += `<td>${escapeHtml(sym.line)}</td>`;
            html += `</tr>`;
        }

        html += `</tbody></table>`;
        return html;
    }


    // =================================================================
    //  LOCK ALL INPUTS
    // =================================================================

    function lockAllInputs() {
        document.querySelectorAll('.st-input').forEach(inp => {
            inp.readOnly = true;
            inp.style.opacity = '0.7';
        });
    }


    // =================================================================
    //  RESET
    // =================================================================

    resetBtn.addEventListener('click', () => {
        if (completed) return;

        document.querySelectorAll('.st-input').forEach(inp => {
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
            // Hint 1: General guidance
            let msg = `[HINT 1/3] Symbol Table Tips:\n\n`;
            msg += `• Look at variable declarations in the source code.\n`;
            msg += `• The TYPE is the data type keyword (int, float, etc.)\n`;
            msg += `• The VALUE is what appears after the = sign.\n`;
            msg += `  If no assignment, the value is "—"\n`;
            msg += `• SCOPE is "global" if outside { }, "local" if inside.\n`;
            msg += `• LINE is the line number where the variable is declared.\n`;
            msg += `\nIdentifiers found: ${symbols.map(s => s.name).join(', ')}`;
            setConsole(msg);
        } else if (hintLevel === 2) {
            // Hint 2: Reveal types and scopes
            let msg = `[HINT 2/3] Partial Reveal:\n\n`;
            for (const sym of symbols) {
                msg += `  ${sym.name} → type: ${sym.type}, scope: ${sym.scope}\n`;
            }
            msg += `\nFill in the remaining Value and Line fields.`;

            // Auto-fill type and scope inputs
            for (let i = 0; i < maskedSymbols.length; i++) {
                const sym = maskedSymbols[i];
                for (const field of ['type', 'scope']) {
                    if (!sym.mask[field]) {
                        const input = document.getElementById(`st-${field}-${i}`);
                        if (input && !input.readOnly) {
                            input.value = sym[field];
                            input.classList.remove('wrong');
                            input.classList.add('correct');
                        }
                    }
                }
            }

            setConsole(msg);
        } else {
            // Hint 3: Reveal everything
            let msg = `[HINT 3/3] Full Reveal:\n\n`;
            for (const sym of symbols) {
                msg += `  ${sym.name} → type: ${sym.type}, value: ${sym.value}, scope: ${sym.scope}, line: ${sym.line}\n`;
            }
            msg += `\nAll fields have been auto-filled. Click "Verify Table".`;

            // Auto-fill all blank inputs
            for (let i = 0; i < maskedSymbols.length; i++) {
                const sym = maskedSymbols[i];
                for (const field of ['type', 'value', 'scope', 'line']) {
                    if (!sym.mask[field]) {
                        const input = document.getElementById(`st-${field}-${i}`);
                        if (input && !input.readOnly) {
                            input.value = sym[field];
                            input.classList.remove('wrong');
                            input.classList.add('correct');
                        }
                    }
                }
            }

            setConsole(msg);
        }
    });


    // =================================================================
    //  EXIT
    // =================================================================

    document.getElementById('btn-exit').addEventListener('click', () => {
        window.location.href = '../../map.html';
    });


    // escapeHtml is defined at module level above
});
