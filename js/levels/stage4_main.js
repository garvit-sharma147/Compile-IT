// js/levels/stage4_main.js — Parse Tree Visualizer (Stage 4)
// Reads precomputed parse tree from engine, renders it with proper layout,
// shows dynamic explanation, allows user to explore and then proceed.

import { updateScoreUI, addScore } from '../utils/score.js';
import { unlockLevel, completeLevel } from '../utils/storage.js';
import { getStoredEngine } from '../engine/global_engine.js';
import { fadeTransition } from '../ui/animations.js';

// ===== LAYOUT CONSTANTS =====
const NODE_H_GAP = 20;     // Horizontal gap between sibling subtrees
const NODE_V_GAP = 65;     // Vertical gap between levels
const NT_MIN_W = 90;       // Non-terminal min width
const T_MIN_W = 55;        // Terminal min width
const NODE_H = 42;         // Node height (non-terminal)
const NODE_T_H = 48;       // Node height (terminal — has label + value)
const PADDING = 40;        // Canvas padding

document.addEventListener('DOMContentLoaded', () => {
    updateScoreUI();

    const treeCanvas = document.getElementById('tree-canvas');
    const treeSvg    = document.getElementById('tree-svg');
    const tooltip    = document.getElementById('node-tooltip');
    const sourceEl   = document.getElementById('source-preview');
    const explEl     = document.getElementById('explanation-content');

    // ===== LOAD ENGINE DATA =====
    const engine = getStoredEngine();
    if (!engine) {
        showError('No engine data found. Please complete Stage 1 first.');
        return;
    }

    sourceEl.innerText = engine.sourceCode;

    const tree = engine.parseTree;
    if (!tree || !tree.children || tree.children.length === 0) {
        showError('Could not generate a parse tree for this input. The code may be invalid or unsupported.');
        return;
    }

    // ===== DISPLAY EXPLANATION =====
    if (engine.explanation && engine.explanation.length) {
        explEl.innerHTML = engine.explanation.map(e =>
            `<div class="expl-item"><h4>${e.title}</h4><p>${e.text}</p></div>`
        ).join('');
    } else {
        explEl.innerHTML = '<p style="color:#999;">No detailed explanation available.</p>';
    }

    // ===== LAYOUT TREE =====
    // Phase 1: Compute subtree widths (bottom-up)
    function computeWidth(node) {
        if (!node) return 0;
        const nodeW = node.terminal ? T_MIN_W : NT_MIN_W;

        if (!node.children || node.children.length === 0) {
            // Measure text width (approximate)
            const textLen = (node.value || node.label || '').length;
            node._width = Math.max(nodeW, textLen * 8 + 24);
            node._subtreeWidth = node._width;
            return node._subtreeWidth;
        }

        let totalChildWidth = 0;
        node.children.forEach((child, i) => {
            totalChildWidth += computeWidth(child);
            if (i < node.children.length - 1) totalChildWidth += NODE_H_GAP;
        });

        const textLen = (node.label || '').length;
        node._width = Math.max(nodeW, textLen * 8 + 24);
        node._subtreeWidth = Math.max(node._width, totalChildWidth);
        return node._subtreeWidth;
    }

    // Phase 2: Assign positions (top-down)
    function assignPositions(node, x, y) {
        if (!node) return;

        const nodeH = node.terminal ? NODE_T_H : NODE_H;

        if (!node.children || node.children.length === 0) {
            node._x = x + (node._subtreeWidth - node._width) / 2;
            node._y = y;
            return;
        }

        // Position this node centered above children
        let childX = x;
        const childY = y + nodeH + NODE_V_GAP;

        // Total children width including gaps
        let totalChildWidth = 0;
        node.children.forEach((child, i) => {
            totalChildWidth += child._subtreeWidth;
            if (i < node.children.length - 1) totalChildWidth += NODE_H_GAP;
        });

        // Center children within this node's subtree width
        const childStart = x + (node._subtreeWidth - totalChildWidth) / 2;
        childX = childStart;

        node.children.forEach((child, i) => {
            assignPositions(child, childX, childY);
            childX += child._subtreeWidth + NODE_H_GAP;
        });

        // Center this node above its children
        const firstChild = node.children[0];
        const lastChild = node.children[node.children.length - 1];
        const childCenter = (firstChild._x + lastChild._x + lastChild._width) / 2;
        node._x = childCenter - node._width / 2;
        node._y = y;
    }

    computeWidth(tree);
    assignPositions(tree, PADDING, PADDING);

    // Compute canvas size
    let maxX = 0, maxY = 0;
    function findBounds(node) {
        if (!node) return;
        const nodeH = node.terminal ? NODE_T_H : NODE_H;
        maxX = Math.max(maxX, (node._x || 0) + (node._width || 0));
        maxY = Math.max(maxY, (node._y || 0) + nodeH);
        (node.children || []).forEach(findBounds);
    }
    findBounds(tree);

    treeCanvas.style.width  = (maxX + PADDING * 2) + 'px';
    treeCanvas.style.height = (maxY + PADDING * 2) + 'px';

    // Update SVG size
    treeSvg.setAttribute('width',  maxX + PADDING * 2);
    treeSvg.setAttribute('height', maxY + PADDING * 2);

    // ===== RENDER SVG LINES =====
    function renderLines(node) {
        if (!node || !node.children) return;
        const nodeH = node.terminal ? NODE_T_H : NODE_H;
        const px = node._x + node._width / 2;
        const py = node._y + nodeH;

        node.children.forEach(child => {
            if (!child) return;
            const cx = child._x + child._width / 2;
            const cy = child._y;

            // Bezier curve
            const midY = py + (cy - py) * 0.5;
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', `M ${px} ${py} C ${px} ${midY}, ${cx} ${midY}, ${cx} ${cy}`);
            treeSvg.appendChild(path);

            renderLines(child);
        });
    }
    renderLines(tree);

    // ===== RENDER NODES =====
    function renderNodes(node) {
        if (!node) return;
        const nodeH = node.terminal ? NODE_T_H : NODE_H;

        const el = document.createElement('div');
        el.className = 'tree-node ' + (node.terminal ? 'terminal' : 'non-terminal');
        el.style.left = node._x + 'px';
        el.style.top = node._y + 'px';
        el.style.width = node._width + 'px';
        el.style.height = nodeH + 'px';

        if (node.terminal) {
            el.innerHTML = `<span class="node-label">${node.label}</span><span class="node-value">${escapeHtml(node.value)}</span>`;
        } else {
            el.innerHTML = `<span class="node-label">${node.label}</span>`;
        }

        // Tooltip on hover
        el.addEventListener('mouseenter', (e) => {
            let text = '';
            if (node.terminal) {
                text = `<strong>Terminal</strong><br>Type: ${node.label}<br>Value: <code>${escapeHtml(node.value)}</code>`;
            } else {
                const childCount = node.children ? node.children.length : 0;
                text = `<strong>Non-Terminal</strong><br>Rule: ${node.label}<br>Children: ${childCount}`;
            }
            tooltip.innerHTML = text;
            tooltip.style.display = 'block';

            const rect = el.getBoundingClientRect();
            const section = document.getElementById('tree-section').getBoundingClientRect();
            tooltip.style.left = (rect.left - section.left + rect.width / 2 - 60) + 'px';
            tooltip.style.top = (rect.top - section.top - 55) + 'px';
        });

        el.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
        });

        treeCanvas.appendChild(el);

        (node.children || []).forEach(renderNodes);
    }
    renderNodes(tree);

    // ===== COMPLETE & CONTINUE =====
    document.getElementById('btn-complete').addEventListener('click', () => {
        addScore(150);
        completeLevel(4);
        unlockLevel(5);
        fadeTransition(() => { window.location.href = '../../map.html'; });
    });

    // ===== HINT — reveals explanation about the tree =====
    document.getElementById('btn-hint').addEventListener('click', () => {
        const score = parseInt(document.getElementById('player-score').innerText) || 0;
        if (score < 50) return;
        addScore(-50);

        // Scroll explanation panel to top and highlight it
        const explPanel = document.querySelector('.explanation-panel');
        explPanel.style.boxShadow = '0 0 20px rgba(212,167,106,0.5) inset';
        explPanel.scrollTop = 0;
        setTimeout(() => { explPanel.style.boxShadow = 'none'; }, 2000);
    });

    // ===== EXIT =====
    document.getElementById('btn-exit').addEventListener('click', () => {
        window.location.href = '../../map.html';
    });

    // ===== HELPERS =====
    function showError(msg) {
        document.getElementById('tree-section').innerHTML = `
            <div class="error-overlay">
                <div>
                    <h2>⚠ Parse Error</h2>
                    <p>${msg}</p>
                </div>
            </div>`;
        document.getElementById('btn-complete').disabled = true;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
});
