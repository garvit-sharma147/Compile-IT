// js/utils/score.js — Score management + UI update
import { getScore, setScore } from './storage.js';

export function updateScoreUI() {
    const scoreEl = document.getElementById('player-score');
    if (scoreEl) {
        scoreEl.innerText = getScore();
    }
}

export function addScore(points) {
    let current = getScore();
    current += points;
    if (current < 0) current = 0; // Never go negative
    setScore(current);
    updateScoreUI();

    // Pulse animation on score change
    const scoreEl = document.getElementById('player-score');
    if (scoreEl) {
        scoreEl.classList.remove('pulse-gold');
        void scoreEl.offsetWidth; // Force reflow to re-trigger animation
        scoreEl.classList.add('pulse-gold');
    }
}
