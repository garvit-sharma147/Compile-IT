// js/utils/storage.js — Clean localStorage wrapper for all game data

const KEYS = {
    SCORE: 'compileit_score',
    UNLOCKED: 'compileit_unlocked',
    COMPLETED: 'compileit_completed',
    ENGINE_DATA: 'compileit_engine_data'
};

// ===== SCORE =====
export function getScore() {
    const score = localStorage.getItem(KEYS.SCORE);
    return score ? parseInt(score, 10) : 200;
}

export function setScore(val) {
    localStorage.setItem(KEYS.SCORE, val.toString());
}

// ===== UNLOCKED LEVELS =====
export function getUnlockedLevels() {
    const data = localStorage.getItem(KEYS.UNLOCKED);
    return data ? JSON.parse(data) : [1]; // Stage 1 always unlocked
}

export function unlockLevel(levelId) {
    const unlocked = getUnlockedLevels();
    if (!unlocked.includes(levelId)) {
        unlocked.push(levelId);
        localStorage.setItem(KEYS.UNLOCKED, JSON.stringify(unlocked));
    }
}

// ===== COMPLETED LEVELS =====
export function getCompletedLevels() {
    const data = localStorage.getItem(KEYS.COMPLETED);
    return data ? JSON.parse(data) : [];
}

export function completeLevel(levelId) {
    const completed = getCompletedLevels();
    if (!completed.includes(levelId)) {
        completed.push(levelId);
        localStorage.setItem(KEYS.COMPLETED, JSON.stringify(completed));
    }
}

// ===== ENGINE DATA (Global Computation Results) =====
export function saveEngineData(data) {
    localStorage.setItem(KEYS.ENGINE_DATA, JSON.stringify(data));
}

export function getEngineData() {
    const data = localStorage.getItem(KEYS.ENGINE_DATA);
    return data ? JSON.parse(data) : null;
}

export function isEngineReady() {
    return localStorage.getItem(KEYS.ENGINE_DATA) !== null;
}

// ===== RESET =====
export function resetAllProgress() {
    localStorage.removeItem(KEYS.SCORE);
    localStorage.removeItem(KEYS.UNLOCKED);
    localStorage.removeItem(KEYS.COMPLETED);
    localStorage.removeItem(KEYS.ENGINE_DATA);
}
