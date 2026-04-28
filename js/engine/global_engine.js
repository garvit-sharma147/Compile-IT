// js/engine/global_engine.js — Central computation engine
// Phase 1: Only tokenization + classification
// Future phases will add AST, FIRST/FOLLOW, LL(1), Symbol Table

import { saveEngineData, getEngineData } from '../utils/storage.js';

/**
 * Tokenize C source code into individual tokens
 * @param {string} code - Raw C source code
 * @returns {string[]} Array of token strings
 */
function tokenize(code) {
    const regex = /\s*(int|float|char|double|void|if|else|for|while|do|return|printf|scanf|#include|[a-zA-Z_]\w*|<=|>=|==|!=|\+\+|--|&&|\|\||->|[-+*/%=<>!&|]|[0-9]+(?:\.[0-9]+)?|[;(){}",\[\]#<>.]|"[^"]*")/g;
    const tokens = [];
    let match;

    while ((match = regex.exec(code)) !== null) {
        const token = match[1].trim();
        if (token) tokens.push(token);
    }

    return tokens;
}

/**
 * Classify each token into its category
 * @param {string[]} tokens - Array of token strings
 * @returns {string[]} Array of classification strings
 */
function classifyTokens(tokens) {
    const keywords = new Set(['int', 'float', 'char', 'double', 'void', 'if', 'else', 'for', 'while', 'do', 'return']);
    const functions = new Set(['printf', 'scanf', 'main', 'strlen', 'strcpy', 'malloc', 'free', 'sizeof']);
    const headers = new Set(['#include']);
    const operators = new Set(['+', '-', '*', '/', '%', '=', '<', '>', '!', '&', '|', '++', '--', '==', '!=', '<=', '>=', '&&', '||', '->']);
    const delimiters = new Set([';', '(', ')', '{', '}', ',', '[', ']', '#', '.', '"']);

    return tokens.map(token => {
        if (headers.has(token)) return 'Header';
        if (functions.has(token)) return 'Function';
        if (keywords.has(token)) return 'Keyword';
        if (operators.has(token)) return 'Operator';
        if (delimiters.has(token)) return 'Delimiter';
        if (/^[0-9]+(\.[0-9]+)?$/.test(token)) return 'Number';
        if (/^"[^"]*"$/.test(token)) return 'String';
        if (/^<[^>]+>$/.test(token)) return 'Header';
        if (/^[a-zA-Z_]\w*$/.test(token)) return 'Identifier';
        return 'Delimiter';
    });
}

// ===== PARSE TREE GENERATOR =====
// Maps token types to grammar non-terminal labels
const TYPE_TO_GRAMMAR = {
    'Keyword': 'TYPE', 'Identifier': 'ID', 'Operator': 'OP',
    'Number': 'NUM', 'Delimiter': 'DELIM', 'String': 'STR',
    'Function': 'FUNC', 'Header': 'HDR'
};

const COMPLEX_KEYWORDS = ['while', 'for', 'if', 'else', 'do', 'switch', 'case'];

/**
 * Extract the first simple statement from token list.
 * Returns null if no simple statement is found.
 */
function extractSimpleStatement(tokens, types) {
    const statements = [];
    let start = 0;
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] === ';') {
            statements.push({
                tokens: tokens.slice(start, i + 1),
                types: types.slice(start, i + 1)
            });
            start = i + 1;
        }
    }

    for (const stmt of statements) {
        const hasComplex = stmt.tokens.some(t => COMPLEX_KEYWORDS.includes(t));
        const hasBraces = stmt.tokens.some(t => t === '{' || t === '}');
        if (!hasComplex && !hasBraces && stmt.tokens.length >= 3 && stmt.tokens.length <= 8) {
            const rootLabel = detectRootLabel(stmt.tokens, stmt.types);
            if (rootLabel) return { ...stmt, rootLabel };
        }
    }
    return null;
}

/**
 * Detect the root label (statement type) based on token pattern.
 */
function detectRootLabel(tokens, types) {
    if (types[0] === 'Keyword' && types.length >= 3) {
        if (types.includes('Operator')) return 'DECLARATION';
        return 'DECLARATION';
    }
    if (types[0] === 'Identifier' && types[1] === 'Operator') return 'ASSIGNMENT';
    if (types[0] === 'Function') return 'FUNC_CALL';
    return 'STATEMENT';
}

/**
 * Build a structured parse tree from a simple statement.
 * Tree has 3 levels: Root → Grammar Categories → Token Values
 * Each node: { id, label, children, level, isTerminal }
 */
function buildParseTree(stmt) {
    if (!stmt) return null;

    let nodeId = 0;

    // Root node (level 0)
    const root = {
        id: nodeId++,
        label: stmt.rootLabel,
        level: 0,
        isTerminal: false,
        children: []
    };

    // For each token, create a grammar-category node (level 1) with a token-value child (level 2)
    stmt.tokens.forEach((token, i) => {
        const grammarLabel = TYPE_TO_GRAMMAR[stmt.types[i]] || stmt.types[i];

        const categoryNode = {
            id: nodeId++,
            label: grammarLabel,
            level: 1,
            isTerminal: false,
            children: []
        };

        const tokenNode = {
            id: nodeId++,
            label: token,
            level: 2,
            isTerminal: true,
            children: []
        };

        categoryNode.children.push(tokenNode);
        root.children.push(categoryNode);
    });

    return root;
}

// ===== MAIN: PROCESS ALL =====
/**
 * Process all inputs and store computed data.
 * Called once from Stage 1 when user submits.
 * @param {string} sourceCode - User's C source code
 * @param {string} cfgText - User's CFG grammar
 * @returns {object} The computed engine data
 */
export function processAll(sourceCode, cfgText) {
    const tokens = tokenize(sourceCode);
    const tokenTypes = classifyTokens(tokens);

    // Parse tree (for Stage 4)
    const simpleStmt = extractSimpleStatement(tokens, tokenTypes);
    const parseTree = buildParseTree(simpleStmt);
    const parseStmt = simpleStmt ? simpleStmt.tokens.join(' ') : null;

    const engineData = {
        sourceCode,
        cfgText,
        tokens,
        tokenTypes,
        // Parse tree data (Stage 4)
        parseTree,        // Structured tree or null if too complex
        parseStmt,        // The simple statement string used for the tree
    };

    saveEngineData(engineData);
    return engineData;
}

/**
 * Get the stored engine data (for later stages)
 * @returns {object|null}
 */
export function getStoredEngine() {
    return getEngineData();
}

/**
 * Check if the engine has been initialized
 * @returns {boolean}
 */
export { isEngineReady } from '../utils/storage.js';
