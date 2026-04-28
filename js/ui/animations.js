// js/ui/animations.js — UI animations (NO zoom/scale on body or containers)

/**
 * Shake an element (wrong answer feedback)
 */
export function shakeElement(el) {
    el.classList.add('shake');
    setTimeout(() => {
        el.classList.remove('shake');
    }, 450);
}

/**
 * Glow an element with correct/wrong color
 * @param {HTMLElement} el 
 * @param {'correct'|'wrong'} type 
 */
export function glowElement(el, type) {
    const className = `glow-${type}`;
    el.classList.add(className);
    setTimeout(() => {
        el.classList.remove(className);
    }, 1500);
}

/**
 * Fade transition — fades out the body then calls the callback.
 * Replaces the old triggerGateOpen zoom effect.
 * @param {Function} callback - Called after fade completes
 */
export function fadeTransition(callback) {
    document.body.classList.add('fade-out');
    setTimeout(() => {
        if (callback) callback();
    }, 700); // Slightly longer than the CSS animation (600ms)
}
