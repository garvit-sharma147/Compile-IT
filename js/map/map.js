// js/map/map.js — Map renderer with data-driven navigation
import { levels } from './levels.js';
import { getUnlockedLevels, getCompletedLevels, getScore } from '../utils/storage.js';

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('map-canvas');
    const ctx = canvas.getContext('2d');
    const mapContainer = document.getElementById('map-container');
    const levelsContainer = document.getElementById('levels-container');

    const unlocked = getUnlockedLevels();
    const completed = getCompletedLevels();

    // Update score display
    const scoreEl = document.getElementById('player-score');
    if (scoreEl) scoreEl.innerText = getScore();

    // Drag-to-pan state
    let isDragging = false;
    let startY = 0;
    let scrollTop = 0;

    function resizeCanvas() {
        canvas.width = levelsContainer.clientWidth;
        canvas.height = levelsContainer.clientHeight;
        drawMap();
    }

    function drawMap() {
        // Clear existing nodes
        levelsContainer.querySelectorAll('.level').forEach(n => n.remove());
        levelsContainer.querySelectorAll('.branch-label').forEach(n => n.remove());

        const offset = 0;

        // Draw connection lines
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        ctx.strokeStyle = '#fdf5e6';
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 8]);

        levels.forEach(lvl => {
            if (!lvl.next || lvl.next.length === 0) return;
            lvl.next.forEach(nextId => {
                const target = levels.find(l => l.id === nextId);
                if (target) {
                    ctx.moveTo(lvl.x + offset + 50, lvl.y + 50);
                    ctx.lineTo(target.x + offset + 50, target.y + 50);
                }
            });
        });

        ctx.stroke();
        ctx.setLineDash([]);

        // Draw branch labels
        const labelLeft = document.createElement('div');
        labelLeft.className = 'branch-label';
        labelLeft.innerText = 'C CODE PATH';
        labelLeft.style.left = (50 + offset) + 'px';
        labelLeft.style.top = '180px';
        levelsContainer.appendChild(labelLeft);

        const labelRight = document.createElement('div');
        labelRight.className = 'branch-label';
        labelRight.innerText = 'CFG PATH';
        labelRight.style.left = (300 + offset) + 'px';
        labelRight.style.top = '180px';
        levelsContainer.appendChild(labelRight);

        // Draw level nodes
        levels.forEach(level => {
            const el = document.createElement('div');
            el.className = 'level';

            // Set state classes
            if (completed.includes(level.id)) {
                el.classList.add('completed');
            } else if (unlocked.includes(level.id)) {
                el.classList.add('unlocked');
                // Find the lowest unlocked-but-not-completed level to mark as current
                const isCurrentCandidate = !completed.includes(level.id);
                if (isCurrentCandidate) {
                    // Check if it's the first unlocked & uncompleted in its branch
                    const branchLevels = levels.filter(l => l.branch === level.branch || (level.branch === null));
                    const firstUncompleted = branchLevels.find(l => unlocked.includes(l.id) && !completed.includes(l.id));
                    if (firstUncompleted && firstUncompleted.id === level.id) {
                        el.classList.add('current');
                    }
                }
            } else {
                el.classList.add('locked');
            }

            // Branch-specific colors for unlocked nodes
            if (level.branch === 'CFG' && !el.classList.contains('locked') && !el.classList.contains('completed')) {
                el.style.backgroundColor = '#8b4f6d';
            }

            el.style.left = (level.x + offset) + 'px';
            el.style.top = level.y + 'px';
            el.innerText = level.name;

            // Tooltip
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.innerText = `${level.name} (Stage ${level.id})`;
            el.appendChild(tooltip);

            // Click handler — data-driven navigation
            el.addEventListener('click', () => {
                if (unlocked.includes(level.id)) {
                    window.location.href = level.url;
                } else {
                    alert('Stage Locked. Complete previous stages to unlock.');
                }
            });

            levelsContainer.appendChild(el);
        });
    }

    // Drag-to-pan
    mapContainer.addEventListener('mousedown', (e) => {
        isDragging = true;
        startY = e.pageY - mapContainer.offsetTop;
        scrollTop = mapContainer.scrollTop;
        mapContainer.style.cursor = 'grabbing';
    });

    mapContainer.addEventListener('mouseleave', () => {
        isDragging = false;
        mapContainer.style.cursor = 'grab';
    });

    mapContainer.addEventListener('mouseup', () => {
        isDragging = false;
        mapContainer.style.cursor = 'grab';
    });

    mapContainer.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const y = e.pageY - mapContainer.offsetTop;
        const walk = (y - startY) * 2;
        mapContainer.scrollTop = scrollTop - walk;
    });

    // Back to menu button
    document.getElementById('btn-menu').addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    // Init
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Scroll to bottom so Stage 1 is visible first
    mapContainer.scrollTop = mapContainer.scrollHeight;
});
