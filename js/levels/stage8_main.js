// js/levels/stage8_main.js — LL(1) Tower (Stage 8)
// Visual/educational stage: automatic LL(1) parsing demonstration.

import { updateScoreUI, addScore } from '../utils/score.js';
import { unlockLevel, completeLevel } from '../utils/storage.js';
import { getStoredEngine } from '../engine/global_engine.js';
import { fadeTransition } from '../ui/animations.js';

const EPSILON = 'ε';
const END = '$';
const FALLBACK_GRAMMAR = "S -> A B\nA -> a A | a\nB -> b B | b";

// ===== GRAMMAR PARSER (reused) =====
function parseGrammar(cfgText) {
    const lines = cfgText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (!lines.length) return null;
    const productions = {}, nonTerminals = new Set(), ntOrder = [], allSymbols = new Set();
    let startSymbol = null;
    for (const line of lines) {
        const ai = line.indexOf('->'), ui = line.indexOf('→');
        let lhs, rhsRaw;
        if (ai !== -1) { lhs = line.substring(0, ai).trim(); rhsRaw = line.substring(ai + 2).trim(); }
        else if (ui !== -1) { lhs = line.substring(0, ui).trim(); rhsRaw = line.substring(ui + 1).trim(); }
        else continue;
        if (!lhs || !rhsRaw) continue;
        if (!startSymbol) startSymbol = lhs;
        if (!nonTerminals.has(lhs)) { nonTerminals.add(lhs); ntOrder.push(lhs); }
        const alts = rhsRaw.split('|').map(a => a.trim());
        if (!productions[lhs]) productions[lhs] = [];
        for (const alt of alts) {
            if (alt === 'ε' || alt === 'epsilon') { productions[lhs].push([EPSILON]); }
            else { const s = tokenize(alt); productions[lhs].push(s); s.forEach(x => allSymbols.add(x)); }
        }
    }
    if (!startSymbol) return null;
    const terminals = new Set();
    allSymbols.forEach(s => { if (!nonTerminals.has(s) && s !== EPSILON) terminals.add(s); });
    return { startSymbol, nonTerminals, ntOrder, terminals, productions };
}
function tokenize(rhs) {
    const t = rhs.trim();
    if (t.includes(' ')) return t.split(/\s+/).filter(s => s.length > 0);
    return [...t];
}

// ===== FIRST SETS =====
function computeFirst(g) {
    const first = {};
    for (const nt of g.nonTerminals) first[nt] = new Set();
    for (const t of g.terminals) first[t] = new Set([t]);
    first[EPSILON] = new Set([EPSILON]);
    function firstOfSeq(syms) {
        const r = new Set();
        if (!syms.length) { r.add(EPSILON); return r; }
        for (let i = 0; i < syms.length; i++) {
            const sf = first[syms[i]] || new Set();
            for (const f of sf) if (f !== EPSILON) r.add(f);
            if (!sf.has(EPSILON)) return r;
            if (i === syms.length - 1) r.add(EPSILON);
        }
        return r;
    }
    let changed = true, iter = 0;
    while (changed && iter++ < 100) {
        changed = false;
        for (const nt of g.nonTerminals) {
            for (const prod of (g.productions[nt] || [])) {
                const sf = (prod.length === 1 && prod[0] === EPSILON) ? new Set([EPSILON]) : firstOfSeq(prod);
                for (const f of sf) { if (!first[nt].has(f)) { first[nt].add(f); changed = true; } }
            }
        }
    }
    return first;
}

// ===== FOLLOW SETS =====
function computeFollow(g, first) {
    const follow = {};
    for (const nt of g.nonTerminals) follow[nt] = new Set();
    follow[g.startSymbol].add(END);
    function firstOfSeq(syms) {
        const r = new Set();
        if (!syms.length) { r.add(EPSILON); return r; }
        for (let i = 0; i < syms.length; i++) {
            const sf = g.nonTerminals.has(syms[i]) ? (first[syms[i]] || new Set()) : (syms[i] === EPSILON ? new Set([EPSILON]) : new Set([syms[i]]));
            for (const f of sf) if (f !== EPSILON) r.add(f);
            if (!sf.has(EPSILON)) return r;
            if (i === syms.length - 1) r.add(EPSILON);
        }
        return r;
    }
    let changed = true, iter = 0;
    while (changed && iter++ < 100) {
        changed = false;
        for (const A of g.nonTerminals) {
            for (const prod of (g.productions[A] || [])) {
                for (let i = 0; i < prod.length; i++) {
                    const B = prod[i];
                    if (!g.nonTerminals.has(B)) continue;
                    const beta = prod.slice(i + 1);
                    const bf = firstOfSeq(beta);
                    for (const f of bf) { if (f !== EPSILON && !follow[B].has(f)) { follow[B].add(f); changed = true; } }
                    if (bf.has(EPSILON)) { for (const f of follow[A]) { if (!follow[B].has(f)) { follow[B].add(f); changed = true; } } }
                }
            }
        }
    }
    return follow;
}

// ===== GRAMMAR VALIDATION =====
function validateGrammar(g, first, follow) {
    const issues = [];
    // Check 1: Left recursion (direct & indirect via DFS)
    const startsWithGraph = {};
    for (const nt of g.nonTerminals) {
        startsWithGraph[nt] = new Set();
        for (const prod of (g.productions[nt] || [])) {
            if (prod.length > 0 && prod[0] !== EPSILON && g.nonTerminals.has(prod[0])) {
                startsWithGraph[nt].add(prod[0]);
            }
        }
    }
    for (const nt of g.nonTerminals) {
        // Direct
        for (const prod of (g.productions[nt] || [])) {
            if (prod.length > 0 && prod[0] === nt) {
                issues.push({ type: 'LEFT_RECURSION', nt, detail: `Direct left recursion: ${nt} → ${prod.join(' ')}` });
            }
        }
        // Indirect via BFS
        const visited = new Set(), queue = [...(startsWithGraph[nt] || [])];
        while (queue.length) {
            const cur = queue.shift();
            if (cur === nt) { issues.push({ type: 'LEFT_RECURSION', nt, detail: `Indirect left recursion involving ${nt}` }); break; }
            if (visited.has(cur)) continue;
            visited.add(cur);
            for (const next of (startsWithGraph[cur] || [])) queue.push(next);
        }
    }
    // Check 2: FIRST/FIRST conflicts
    for (const nt of g.nonTerminals) {
        const prods = g.productions[nt] || [];
        for (let i = 0; i < prods.length; i++) {
            for (let j = i + 1; j < prods.length; j++) {
                const fi = firstOfProd(prods[i], first), fj = firstOfProd(prods[j], first);
                for (const t of fi) { if (t !== EPSILON && fj.has(t)) { issues.push({ type: 'FIRST_FIRST', nt, detail: `FIRST/FIRST conflict in ${nt}: terminal '${t}' in both "${prods[i].join('')}" and "${prods[j].join('')}"` }); } }
            }
        }
    }
    // Check 3: FIRST/FOLLOW conflicts
    for (const nt of g.nonTerminals) {
        if (first[nt] && first[nt].has(EPSILON)) {
            const fnt = new Set(first[nt]); fnt.delete(EPSILON);
            for (const t of fnt) { if (follow[nt] && follow[nt].has(t)) { issues.push({ type: 'FIRST_FOLLOW', nt, detail: `FIRST/FOLLOW conflict in ${nt}: '${t}' in both FIRST and FOLLOW` }); } }
        }
    }
    return issues;
}
function firstOfProd(prod, first) {
    const r = new Set();
    if (prod.length === 1 && prod[0] === EPSILON) { r.add(EPSILON); return r; }
    for (let i = 0; i < prod.length; i++) {
        const sf = first[prod[i]] || new Set();
        for (const f of sf) if (f !== EPSILON) r.add(f);
        if (!sf.has(EPSILON)) return r;
        if (i === prod.length - 1) r.add(EPSILON);
    }
    return r;
}

// ===== LL(1) TABLE CONSTRUCTION =====
function buildLL1Table(g, first, follow) {
    const table = {}, conflicts = [];
    const termsPlusDollar = [...g.terminals, END];
    for (const nt of g.nonTerminals) {
        table[nt] = {};
        for (const t of termsPlusDollar) table[nt][t] = [];
    }
    for (const A of g.nonTerminals) {
        for (const prod of (g.productions[A] || [])) {
            const fp = firstOfProd(prod, first);
            for (const a of fp) {
                if (a !== EPSILON && table[A][a] !== undefined) table[A][a].push(prod);
            }
            if (fp.has(EPSILON)) {
                for (const b of (follow[A] || [])) {
                    if (table[A][b] !== undefined) table[A][b].push(prod);
                }
            }
        }
    }
    let isLL1 = true;
    for (const nt of g.nonTerminals) {
        for (const t of termsPlusDollar) {
            if (table[nt][t] && table[nt][t].length > 1) {
                isLL1 = false;
                conflicts.push({ nt, terminal: t, prods: table[nt][t] });
            }
        }
    }
    return { table, isLL1, conflicts, termsPlusDollar };
}

// ===== SAMPLE STRING GENERATION =====
function generateSample(g, maxD = 12) {
    function expand(sym, d) {
        if (!g.nonTerminals.has(sym)) return sym === EPSILON ? '' : sym;
        if (d > maxD) {
            const prods = g.productions[sym] || [[]];
            const shortest = prods.reduce((a, b) => a.length <= b.length ? a : b);
            return shortest.map(s => expand(s, d + 1)).join('');
        }
        const prods = g.productions[sym] || [];
        if (!prods.length) return '';
        const chosen = d > maxD / 2 ? prods.reduce((a, b) => a.length <= b.length ? a : b) : prods[Math.floor(Math.random() * prods.length)];
        return chosen.map(s => expand(s, d + 1)).join('');
    }
    // Try a few times to get a short string
    let best = expand(g.startSymbol, 0);
    for (let i = 0; i < 5; i++) {
        const s = expand(g.startSymbol, 0);
        if (s.length > 0 && s.length < best.length) best = s;
        if (best.length > 0 && best.length <= 4) break;
    }
    return best || 'ab';
}

// ===== LL(1) PARSER EXECUTION =====
function runLL1Parser(table, g, input) {
    const stack = [END, g.startSymbol];
    const inputArr = [...input, END];
    let ip = 0, stepNum = 0;
    const steps = [];
    // Tree construction
    let nodeId = 0;
    const root = { id: nodeId++, label: g.startSymbol, terminal: false, children: [] };
    const nodeStack = [root]; // parallel to parsing stack (non-terminals only)
    let accepted = false, error = null;

    while (stack.length > 0 && stepNum < 200) {
        stepNum++;
        const top = stack[stack.length - 1];
        const cur = inputArr[ip];
        const stackStr = [...stack].reverse().join(' ');
        const inputStr = inputArr.slice(ip).join(' ');

        if (top === END && cur === END) {
            steps.push({ step: stepNum, stack: stackStr, input: inputStr, action: '✓ Accept', type: 'accept' });
            accepted = true;
            break;
        }
        if (top === END || cur === undefined) {
            steps.push({ step: stepNum, stack: stackStr, input: inputStr, action: `✗ Error: unexpected end`, type: 'error' });
            error = 'Unexpected end of input';
            break;
        }
        if (!g.nonTerminals.has(top)) {
            // Terminal on stack
            if (top === cur) {
                steps.push({ step: stepNum, stack: stackStr, input: inputStr, action: `Match '${top}'`, type: 'match' });
                stack.pop();
                // Mark the corresponding tree node
                ip++;
            } else {
                steps.push({ step: stepNum, stack: stackStr, input: inputStr, action: `✗ Error: expected '${top}', got '${cur}'`, type: 'error' });
                error = `Expected '${top}', got '${cur}'`;
                break;
            }
        } else {
            // Non-terminal: look up table
            const entry = table[top] && table[top][cur];
            if (!entry || entry.length === 0) {
                steps.push({ step: stepNum, stack: stackStr, input: inputStr, action: `✗ Error: no rule for [${top}, ${cur}]`, type: 'error' });
                error = `No entry in table for [${top}, ${cur}]`;
                break;
            }
            const prod = entry[0]; // use first if conflict
            const prodStr = prod.length === 1 && prod[0] === EPSILON ? 'ε' : prod.join(' ');
            steps.push({ step: stepNum, stack: stackStr, input: inputStr, action: `${top} → ${prodStr}`, type: 'production' });
            stack.pop();
            // Find the tree node for this NT
            const treeNode = nodeStack.pop();
            if (prod.length === 1 && prod[0] === EPSILON) {
                treeNode.children.push({ id: nodeId++, label: 'ε', terminal: true, children: [], epsilon: true });
            } else {
                // Push RHS in reverse onto stack, create tree children
                const childNodes = [];
                for (const sym of prod) {
                    const child = { id: nodeId++, label: sym, terminal: !g.nonTerminals.has(sym), children: [] };
                    childNodes.push(child);
                }
                treeNode.children = childNodes;
                for (let i = prod.length - 1; i >= 0; i--) {
                    stack.push(prod[i]);
                    if (g.nonTerminals.has(prod[i])) nodeStack.push(childNodes[i]);
                }
            }
        }
    }
    return { accepted, error, steps, tree: root };
}

// ===== TREE LAYOUT =====
const NODE_W = 52, NODE_H = 34, H_GAP = 12, V_GAP = 60, PAD = 30;
function layoutTree(node) {
    function calcWidth(n) {
        if (!n.children || n.children.length === 0) { n._w = NODE_W; return NODE_W; }
        let total = 0;
        n.children.forEach(c => { total += calcWidth(c); });
        total += (n.children.length - 1) * H_GAP;
        n._w = Math.max(NODE_W, total);
        return n._w;
    }
    function position(n, x, y) {
        n._x = x; n._y = y;
        if (!n.children || n.children.length === 0) return;
        let startX = x - n._w / 2;
        n.children.forEach(c => {
            const cx = startX + c._w / 2;
            position(c, cx, y + V_GAP);
            startX += c._w + H_GAP;
        });
    }
    calcWidth(node);
    const rootX = node._w / 2 + PAD;
    position(node, rootX, PAD + 10);
    // Calculate bounds
    let maxX = 0, maxY = 0;
    function bounds(n) {
        maxX = Math.max(maxX, n._x + NODE_W / 2 + PAD);
        maxY = Math.max(maxY, n._y + NODE_H + PAD);
        (n.children || []).forEach(bounds);
    }
    bounds(node);
    return { width: maxX, height: maxY };
}

// ===== DOM READY =====
document.addEventListener('DOMContentLoaded', () => {
    updateScoreUI();
    const treeCanvas = document.getElementById('tree-canvas');
    const treeSvg = document.getElementById('tree-svg');
    const stepsBody = document.getElementById('steps-body');
    const consoleBox = document.getElementById('output-msg');
    const completeBtn = document.getElementById('btn-complete');
    const parsedStringEl = document.getElementById('parsed-string');
    let completed = false, hintLevel = 0;

    function setConsole(msg, err = false) { consoleBox.innerText = msg; consoleBox.className = 'console-box ' + (err ? 'error-msg' : 'success-msg'); }
    function setConsoleHTML(html) { consoleBox.innerHTML = html; consoleBox.className = 'console-box'; }
    function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    const engine = getStoredEngine();
    if (!engine || !engine.cfgText) { setConsole('[ERROR] No grammar data found.\nComplete Stage 1 first.', true); return; }

    let grammar = parseGrammar(engine.cfgText);
    if (!grammar) { setConsole('[ERROR] Could not parse grammar.', true); return; }

    let firstSets = computeFirst(grammar);
    let followSets = computeFollow(grammar, firstSets);
    let validationIssues = validateGrammar(grammar, firstSets, followSets);
    let ll1Result = buildLL1Table(grammar, firstSets, followSets);
    let usingFallback = false;
    let diagnosticHTML = '';

    // If not LL(1), build diagnostics and switch to fallback
    if (validationIssues.length > 0 || !ll1Result.isLL1) {
        usingFallback = true;
        diagnosticHTML = buildDiagnosticHTML(validationIssues, ll1Result, grammar);
        // Switch to fallback grammar
        grammar = parseGrammar(FALLBACK_GRAMMAR);
        firstSets = computeFirst(grammar);
        followSets = computeFollow(grammar, firstSets);
        ll1Result = buildLL1Table(grammar, firstSets, followSets);
    }

    // Generate sample string and run parser
    const sampleStr = generateSample(grammar);
    parsedStringEl.textContent = sampleStr + ' $';
    const parseResult = runLL1Parser(ll1Result.table, grammar, sampleStr);

    // Award observation points
    addScore(100);

    // Render everything
    renderTree(parseResult.tree);
    renderSteps(parseResult.steps);
    renderConsole(ll1Result, grammar, parseResult, diagnosticHTML, usingFallback);

    // ===== RENDER TREE =====
    function renderTree(tree) {
        const { width, height } = layoutTree(tree);
        treeCanvas.style.minWidth = width + 'px';
        treeCanvas.style.minHeight = height + 'px';
        treeSvg.setAttribute('width', width);
        treeSvg.setAttribute('height', height);
        // Remove old nodes
        treeCanvas.querySelectorAll('.tree-node').forEach(n => n.remove());
        treeSvg.innerHTML = '';
        // Draw lines first
        function drawLines(n) {
            if (!n.children) return;
            for (const c of n.children) {
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                const x1 = n._x, y1 = n._y + NODE_H;
                const x2 = c._x, y2 = c._y;
                const my = (y1 + y2) / 2;
                path.setAttribute('d', `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`);
                treeSvg.appendChild(path);
                drawLines(c);
            }
        }
        drawLines(tree);
        // Draw nodes
        function drawNode(n) {
            const el = document.createElement('div');
            const isEps = n.epsilon;
            const isTerm = n.terminal;
            el.className = 'tree-node ' + (isEps ? 'epsilon-node terminal' : isTerm ? 'terminal' : 'non-terminal');
            el.style.left = (n._x - NODE_W / 2) + 'px';
            el.style.top = n._y + 'px';
            el.style.width = NODE_W + 'px';
            el.style.height = NODE_H + 'px';
            el.innerHTML = `<span class="node-label">${esc(n.label)}</span>`;
            treeCanvas.appendChild(el);
            (n.children || []).forEach(drawNode);
        }
        drawNode(tree);
    }

    // ===== RENDER STEPS =====
    function renderSteps(steps) {
        stepsBody.innerHTML = '';
        for (const s of steps) {
            const tr = document.createElement('tr');
            const cls = s.type === 'production' ? 'action-production' : s.type === 'match' ? 'action-match' : s.type === 'accept' ? 'action-accept' : 'action-error';
            tr.innerHTML = `<td>${s.step}</td><td>${esc(s.stack)}</td><td>${esc(s.input)}</td><td class="${cls}">${esc(s.action)}</td>`;
            stepsBody.appendChild(tr);
        }
    }

    // ===== RENDER CONSOLE =====
    function renderConsole(ll1, g, result, diagHTML, fallback) {
        let html = '';
        if (fallback) {
            html += diagHTML;
            html += `<div class="fallback-notice"><strong>⚠ Using demo grammar</strong> for LL(1) demonstration:<br><code>S → A B, A → a A | a, B → b B | b</code></div>`;
        }
        // LL(1) Parsing Table
        html += `<div style="color:#81d4fa;font-weight:700;margin-bottom:6px;">LL(1) Parsing Table</div>`;
        html += `<table class="ll1-table"><thead><tr><th></th>`;
        for (const t of ll1.termsPlusDollar) html += `<th>${esc(t)}</th>`;
        html += `</tr></thead><tbody>`;
        for (const nt of g.ntOrder) {
            html += `<tr><td>${esc(nt)}</td>`;
            for (const t of ll1.termsPlusDollar) {
                const entries = ll1.table[nt][t] || [];
                if (entries.length === 0) {
                    html += `<td class="empty-cell">—</td>`;
                } else if (entries.length > 1) {
                    const strs = entries.map(p => `${nt}→${p.join('')}`).join(', ');
                    html += `<td class="conflict-cell">${esc(strs)}</td>`;
                } else {
                    const p = entries[0];
                    const ps = p.length === 1 && p[0] === EPSILON ? 'ε' : p.join('');
                    html += `<td>${esc(nt)}→${esc(ps)}</td>`;
                }
            }
            html += `</tr>`;
        }
        html += `</tbody></table>`;
        // Parse result
        html += `<div style="margin-top:10px;padding:8px;border-radius:6px;border:1px solid ${result.accepted ? '#5a8e03' : '#ef5350'};background:rgba(${result.accepted ? '90,142,3' : '231,76,60'},0.1);">`;
        html += result.accepted
            ? `<span style="color:#66bb6a;font-weight:700;">✓ String "${esc(sampleStr)}" — Accepted</span>`
            : `<span style="color:#ef5350;font-weight:700;">✗ String "${esc(sampleStr)}" — Rejected</span><br><span style="color:#999;font-size:0.82rem;">${esc(result.error || '')}</span>`;
        html += `</div>`;
        setConsoleHTML(html);
    }

    // ===== DIAGNOSTICS BUILDER =====
    function buildDiagnosticHTML(issues, ll1, g) {
        let html = `<div class="diagnostic-notice"><strong>⚠ Grammar Issues Detected</strong><br>`;
        const seen = new Set();
        for (const iss of issues) {
            const key = iss.type + iss.nt;
            if (seen.has(key)) continue;
            seen.add(key);
            html += `• ${esc(iss.detail)}<br>`;
        }
        if (ll1.conflicts.length > 0) {
            for (const c of ll1.conflicts) {
                html += `• Table conflict at [${esc(c.nt)}, ${esc(c.terminal)}]: ${c.prods.map(p => p.join('')).join(' / ')}<br>`;
            }
        }
        html += `</div>`;
        return html;
    }

    // ===== COMPLETE =====
    completeBtn.addEventListener('click', () => {
        if (completed) return;
        completed = true;
        addScore(50);
        completeBtn.disabled = true;
        completeBtn.innerText = 'COMPLETED ✓';
        completeLevel(8);
        // Final stage on the CFG branch — no next level to unlock
        setTimeout(() => { fadeTransition(() => { window.location.href = '../../map.html'; }); }, 2000);
    });

    // ===== HINTS =====
    document.getElementById('btn-hint').addEventListener('click', () => {
        if (completed) return;
        const score = parseInt(document.getElementById('player-score').innerText) || 0;
        if (score < 50) { setConsole('[SYSTEM] Not enough score for a hint.', true); return; }
        addScore(-50);
        hintLevel++;
        if (hintLevel === 1) {
            setConsole(`[HINT 1/3] How to read the parsing steps:\n\n• Stack starts with: ${grammar.startSymbol} $\n• Each step either:\n  - Applies a production (replace NT with RHS)\n  - Matches a terminal (pop stack & advance input)\n• Parsing succeeds when both stack and input reach $`);
        } else if (hintLevel === 2) {
            let msg = `[HINT 2/3] FIRST & FOLLOW sets:\n\n`;
            for (const nt of grammar.ntOrder) {
                msg += `FIRST(${nt}) = { ${[...firstSets[nt]].join(', ')} }\n`;
                msg += `FOLLOW(${nt}) = { ${[...followSets[nt]].join(', ')} }\n`;
            }
            setConsole(msg);
        } else {
            setConsole(`[HINT 3/3] LL(1) Table Lookup:\n\nFor non-terminal X and lookahead symbol a:\n  table[X][a] tells which production to use.\n\nThe table is built using:\n  FIRST(α) for each production X → α\n  FOLLOW(X) when ε ∈ FIRST(α)\n\nNo more hints available.`);
        }
    });

    // ===== EXIT =====
    document.getElementById('btn-exit').addEventListener('click', () => { window.location.href = '../../map.html'; });
});
