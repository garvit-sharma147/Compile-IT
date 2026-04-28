// js/levels/stage3_main.js — Token Valley (Stage 3)
// Purpose: User classifies each token into its category (Keyword, Identifier, etc.)
import { updateScoreUI, addScore } from '../utils/score.js';
import { unlockLevel, completeLevel } from '../utils/storage.js';
import { getStoredEngine } from '../engine/global_engine.js';
import { fadeTransition, shakeElement, glowElement } from '../ui/animations.js';

const CATEGORIES = ['Keyword', 'Identifier', 'Operator', 'Number', 'Delimiter', 'String', 'Function', 'Header'];

document.addEventListener('DOMContentLoaded', () => {
    updateScoreUI();

    const consoleBox = document.getElementById('output-msg');
    const tokenGrid = document.getElementById('token-grid');
    const categoryBar = document.getElementById('category-bar');
    const selectPrompt = document.getElementById('select-prompt');
    const verifyBtn = document.getElementById('btn-verify');
    const attemptDisplay = document.getElementById('attempt-display');
    const codeDisplay = document.getElementById('code-display');

    // Load engine data
    const engineData = getStoredEngine();
    if (!engineData) {
        setConsoleMsg('[ERROR] No engine data found.\nPlease complete Stage 1 first.', true);
        verifyBtn.disabled = true;
        return;
    }

    // Display source code
    codeDisplay.innerText = engineData.sourceCode;

    const tokens = engineData.tokens;
    const expectedTypes = engineData.tokenTypes;

    // User's classifications (indexed same as tokens)
    const userClassifications = new Array(tokens.length).fill(null);

    let selectedIndex = null;
    let attempts = 0;
    const MAX_ATTEMPTS = 3;
    let completed = false;
    let hintLevel = 0;

    function setConsoleMsg(msg, isError = false) {
        consoleBox.innerText = msg;
        consoleBox.className = 'console-box ' + (isError ? 'error-msg' : 'success-msg');
    }

    function updateAttemptDisplay() {
        attemptDisplay.innerText = `Attempt ${attempts}/${MAX_ATTEMPTS}`;
    }

    // ===== BUILD TOKEN CARDS =====
    function buildTokenCards() {
        tokenGrid.innerHTML = '';
        tokens.forEach((token, i) => {
            const card = document.createElement('div');
            card.className = 'token-card';
            card.dataset.index = i;

            const tokenText = document.createElement('span');
            tokenText.className = 'token-text';
            tokenText.innerText = token;
            card.appendChild(tokenText);

            const label = document.createElement('span');
            label.className = 'label';
            label.innerText = '';
            card.appendChild(label);

            // Click to select
            card.addEventListener('click', () => {
                if (completed) return;
                selectToken(i);
            });

            tokenGrid.appendChild(card);
        });
    }

    // ===== SELECT A TOKEN =====
    function selectToken(index) {
        selectedIndex = index;

        // Update card visual states
        tokenGrid.querySelectorAll('.token-card').forEach((card, i) => {
            card.classList.toggle('selected', i === index);
            card.classList.remove('wrong');
        });

        // Show category buttons
        showCategoryButtons();

        setConsoleMsg(
            `Selected token: "${tokens[index]}"\n` +
            `Position: ${index + 1} of ${tokens.length}\n\n` +
            `Choose a category to classify this token.`
        );
    }

    // ===== SHOW CATEGORY BUTTONS =====
    function showCategoryButtons() {
        // Clear existing buttons (keep the label)
        const label = categoryBar.querySelector('.label');
        categoryBar.innerHTML = '';
        categoryBar.appendChild(label);

        // Remove prompt
        if (selectPrompt) selectPrompt.remove();

        CATEGORIES.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = `cat-btn cat-${cat}`;
            btn.innerText = cat;

            // Highlight if this category is already assigned to selected token
            if (selectedIndex !== null && userClassifications[selectedIndex] === cat) {
                btn.classList.add('active');
            }

            btn.addEventListener('click', () => {
                if (completed || selectedIndex === null) return;
                assignCategory(selectedIndex, cat);
            });

            categoryBar.appendChild(btn);
        });
    }

    // ===== ASSIGN CATEGORY =====
    function assignCategory(index, category) {
        userClassifications[index] = category;

        // Update card appearance
        const card = tokenGrid.children[index];
        card.classList.add('classified');
        card.classList.remove('selected');
        card.dataset.assigned = category;
        card.querySelector('.label').innerText = category;

        // Count progress
        const classifiedCount = userClassifications.filter(c => c !== null).length;

        setConsoleMsg(
            `Token "${tokens[index]}" classified as ${category}.\n\n` +
            `Progress: ${classifiedCount}/${tokens.length} tokens classified.` +
            (classifiedCount === tokens.length ? '\n\nAll tokens classified! Click "Verify Classification".' : '')
        );

        // Auto-advance to next unclassified token
        const nextUnclassified = userClassifications.findIndex((c, i) => c === null && i > index);
        if (nextUnclassified !== -1) {
            selectToken(nextUnclassified);
        } else {
            // Check if there's any unclassified before this index
            const anyUnclassified = userClassifications.findIndex(c => c === null);
            if (anyUnclassified !== -1) {
                selectToken(anyUnclassified);
            } else {
                // All classified — deselect
                selectedIndex = null;
                tokenGrid.querySelectorAll('.token-card').forEach(c => c.classList.remove('selected'));
                showCategoryButtons();
            }
        }
    }

    // ===== VERIFY HANDLER =====
    verifyBtn.addEventListener('click', () => {
        if (completed) return;

        // Check if all tokens are classified
        const unclassified = userClassifications.filter(c => c === null).length;
        if (unclassified > 0) {
            setConsoleMsg(
                `[ERROR] ${unclassified} token(s) not yet classified.\n` +
                `Please classify all tokens before verifying.`,
                true
            );
            return;
        }

        attempts++;
        updateAttemptDisplay();

        // Compare classifications
        const wrong = [];
        for (let i = 0; i < tokens.length; i++) {
            if (userClassifications[i] !== expectedTypes[i]) {
                wrong.push({ index: i, token: tokens[i], expected: expectedTypes[i], got: userClassifications[i] });
            }
        }

        if (wrong.length === 0) {
            // ALL CORRECT
            completed = true;
            addScore(150);
            glowElement(verifyBtn, 'correct');
            setConsoleMsg(
                `[SUCCESS] All ${tokens.length} tokens correctly classified!\n\n` +
                `Score +150\n\n` +
                `Proceeding to Parse Tree Tower...`
            );
            verifyBtn.disabled = true;
            verifyBtn.innerText = 'COMPLETED';

            completeLevel(3);
            unlockLevel(4);

            setTimeout(() => {
                fadeTransition(() => {
                    window.location.href = '../../map.html';
                });
            }, 2500);

        } else if (attempts >= MAX_ATTEMPTS) {
            // FAILED 3 TIMES — show answers
            completed = true;
            shakeElement(verifyBtn);
            glowElement(verifyBtn, 'wrong');

            // Highlight wrong tokens
            wrong.forEach(w => {
                const card = tokenGrid.children[w.index];
                card.classList.add('wrong');
            });

            // Show correct answer in console
            const corrections = wrong.map(w =>
                `  "${w.token}" → ${w.expected} (you said: ${w.got})`
            ).join('\n');

            setConsoleMsg(
                `[FAILED] Better luck next time!\n\n` +
                `${wrong.length} token(s) incorrectly classified:\n${corrections}\n\n` +
                `Correct classifications:\n` +
                tokens.map((t, i) => `  ${t} → ${expectedTypes[i]}`).join('\n') +
                `\n\nYou may still proceed to the next stage.`
            );

            verifyBtn.disabled = true;
            verifyBtn.innerText = 'FAILED';

            // Show all correct answers on cards
            tokens.forEach((t, i) => {
                const card = tokenGrid.children[i];
                card.dataset.assigned = expectedTypes[i];
                card.querySelector('.label').innerText = expectedTypes[i];
                card.classList.add('classified');
            });

            completeLevel(3);
            unlockLevel(4);

            const continueBtn = document.createElement('button');
            continueBtn.className = 'btn btn-verify';
            continueBtn.innerText = 'Continue to Next Stage';
            continueBtn.style.marginTop = '10px';
            continueBtn.addEventListener('click', () => {
                fadeTransition(() => {
                    window.location.href = '../../map.html';
                });
            });
            document.getElementById('panel-interactive').appendChild(continueBtn);

        } else {
            // WRONG — still have attempts
            shakeElement(verifyBtn);
            glowElement(verifyBtn, 'wrong');
            addScore(-20);

            // Highlight wrong tokens
            wrong.forEach(w => {
                const card = tokenGrid.children[w.index];
                card.classList.add('wrong');
            });

            setConsoleMsg(
                `[ERROR] ${wrong.length} token(s) incorrectly classified.\n\n` +
                `Wrong tokens are highlighted in red.\n` +
                `Click a highlighted token to re-classify it.\n\n` +
                `${MAX_ATTEMPTS - attempts} attempt(s) remaining.\n` +
                `Score -20`,
                true
            );
        }
    });

    // ===== HINT HANDLER (Progressive) =====
    document.getElementById('btn-hint').addEventListener('click', () => {
        if (completed) return;

        const currentScore = parseInt(document.getElementById('player-score').innerText) || 0;
        if (currentScore < 50) {
            setConsoleMsg('[SYSTEM] Not enough score (requires 50 pts) to use a hint.', true);
            return;
        }
        addScore(-50);
        hintLevel++;

        if (hintLevel === 1) {
            // Hint 1: Find a wrongly classified token and highlight it
            const wrongIdx = userClassifications.findIndex((c, i) => c !== null && c !== expectedTypes[i]);
            if (wrongIdx !== -1) {
                const card = tokenGrid.children[wrongIdx];
                card.classList.add('wrong');
                setConsoleMsg(
                    `[HINT 1] Token "${tokens[wrongIdx]}" is incorrectly classified.\n` +
                    `It's currently labeled as "${userClassifications[wrongIdx]}".\n\n` +
                    `Try a different category.`
                );
            } else {
                // No wrong ones yet, show a general hint
                const unclassified = userClassifications.findIndex(c => c === null);
                if (unclassified !== -1) {
                    setConsoleMsg(
                        `[HINT 1] Start classifying! Token "${tokens[unclassified]}" is waiting.\n\n` +
                        `Keywords: int, float, char, void, if, else, while, for, return\n` +
                        `Functions: printf, scanf, main\n` +
                        `Operators: +, -, =, <, >, ==, !=, ++, --, etc.\n` +
                        `Delimiters: ; ( ) { } , [ ]`
                    );
                }
            }
        } else if (hintLevel === 2) {
            // Hint 2: Reveal correct category for one token
            const wrongIdx = userClassifications.findIndex((c, i) => c !== null && c !== expectedTypes[i]);
            const targetIdx = wrongIdx !== -1 ? wrongIdx : userClassifications.findIndex(c => c === null);

            if (targetIdx !== -1) {
                setConsoleMsg(
                    `[HINT 2] Correct classification revealed:\n\n` +
                    `Token "${tokens[targetIdx]}" → ${expectedTypes[targetIdx]}`
                );
                // Auto-assign it
                assignCategory(targetIdx, expectedTypes[targetIdx]);
            }
        } else {
            // Hint 3+: Reveal all remaining
            setConsoleMsg(
                `[HINT 3] All classifications revealed:\n\n` +
                tokens.map((t, i) => `  ${t} → ${expectedTypes[i]}`).join('\n')
            );
            // Auto-assign all
            tokens.forEach((t, i) => {
                if (userClassifications[i] !== expectedTypes[i]) {
                    assignCategory(i, expectedTypes[i]);
                }
            });
        }
    });

    // ===== EXIT HANDLER =====
    document.getElementById('btn-exit').addEventListener('click', () => {
        window.location.href = '../../map.html';
    });

    // ===== INIT =====
    buildTokenCards();
    updateAttemptDisplay();
});
