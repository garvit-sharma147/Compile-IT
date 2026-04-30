// js/engine/global_engine.js — Central computation engine
// Phase 1: Only tokenization + classification
// Future phases will add AST, FIRST/FOLLOW, LL(1)

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

// ===== COMPLETE RECURSIVE DESCENT PARSE TREE GENERATOR =====

// Token type labels for terminal nodes
const TOKEN_LABELS = {
    'Keyword': 'KEYWORD', 'Identifier': 'ID', 'Operator': 'OP',
    'Number': 'NUM', 'Delimiter': 'DELIM', 'String': 'STR',
    'Function': 'FUNC', 'Header': 'HDR'
};

const TYPE_KEYWORDS = new Set(['int', 'float', 'char', 'double', 'void']);
const RELATIONAL_OPS = new Set(['<', '>', '<=', '>=', '==', '!=']);
const ADDITIVE_OPS = new Set(['+', '-']);
const MULT_OPS = new Set(['*', '/', '%']);
const ASSIGN_OPS = new Set(['=']);
const LOGICAL_OPS = new Set(['&&', '||']);
const UNARY_OPS = new Set(['!', '-', '++', '--']);

/**
 * Create a non-terminal tree node
 */
function nt(label, children) {
    return { label, terminal: false, value: null, children: children || [] };
}

/**
 * Create a terminal (leaf) tree node
 */
function term(label, value) {
    return { label, terminal: true, value, children: [] };
}

/**
 * Recursive Descent Parser
 * Parses the full token stream into a complete hierarchical parse tree.
 */
class Parser {
    constructor(tokens, types) {
        this.tokens = tokens;
        this.types = types;
        this.pos = 0;
        this.explanations = [];
    }

    // ── Helpers ──────────────────────────────────────────

    peek() { return this.pos < this.tokens.length ? this.tokens[this.pos] : null; }
    peekType() { return this.pos < this.types.length ? this.types[this.pos] : null; }
    atEnd() { return this.pos >= this.tokens.length; }

    /** Consume the current token and return a terminal node */
    consume(expectedValue) {
        if (this.pos >= this.tokens.length) return null;
        if (expectedValue !== undefined && this.tokens[this.pos] !== expectedValue) return null;
        const tok = this.tokens[this.pos];
        const typ = this.types[this.pos];
        const label = TOKEN_LABELS[typ] || typ;
        this.pos++;
        return term(label, tok);
    }

    /** Consume if the current token matches; otherwise return null without advancing */
    tryConsume(value) {
        if (this.peek() === value) return this.consume();
        return null;
    }

    /** Check if current token matches */
    check(value) { return this.peek() === value; }
    checkType(type) { return this.peekType() === type; }

    // ── PROGRAM ─────────────────────────────────────────

    parseProgram() {
        const stmtList = this.parseStmtList();
        const prog = nt('PROGRAM', [stmtList]);
        return prog;
    }

    // ── STMT_LIST ───────────────────────────────────────

    parseStmtList() {
        const node = nt('STMT_LIST');
        while (!this.atEnd() && !this.check('}')) {
            const stmt = this.parseStmt();
            if (stmt) {
                node.children.push(stmt);
            } else {
                // Skip unrecognized token to avoid infinite loop
                const bad = this.consume();
                if (bad) node.children.push(nt('UNKNOWN', [bad]));
            }
        }
        return node;
    }

    // ── STMT ────────────────────────────────────────────

    parseStmt() {
        const tok = this.peek();
        if (tok === null) return null;

        // Preprocessor directive (#include, #define) — captured as one token
        if (this.peekType() === 'Directive') {
            return this.parseDirective();
        }

        // Declaration OR Function Definition: type keyword
        if (TYPE_KEYWORDS.has(tok)) {
            // Look-ahead: type [*] identifier ( → function definition
            // type [*] identifier (= | ; | [ | ,) → declaration
            let offset = 1;                                     // skip type
            if (this.tokens[this.pos + offset] === '*') offset++; // skip optional *
            const namePos = this.pos + offset;                  // identifier position
            const afterName = this.tokens[namePos + 1];         // token after name
            if (afterName === '(') {
                return this.parseFuncDef();
            }
            return this.parseDeclStmt();
        }

        // While loop
        if (tok === 'while') return this.parseWhileStmt();

        // For loop
        if (tok === 'for') return this.parseForStmt();

        // If statement
        if (tok === 'if') return this.parseIfStmt();

        // Do-while loop
        if (tok === 'do') return this.parseDoWhileStmt();

        // Return statement
        if (tok === 'return') return this.parseReturnStmt();

        // Block
        if (tok === '{') return this.parseBlock();

        // Printf / scanf / function calls, and general expressions
        return this.parseExprStmt();
    }

    // ── DECL_STMT ───────────────────────────────────────

    parseDeclStmt() {
        const node = nt('DECL_STMT');
        const typeNode = this.consume(); // type keyword (int, float, etc.)
        node.children.push(typeNode);

        // Pointer declaration: int *ptr
        // * is only treated as pointer marker here (after type), never in expressions
        if (this.check('*')) {
            node.children.push(this.consume()); // '*' as PTR_OP
        }

        const idNode = this.consume(); // identifier
        if (idNode) node.children.push(idNode);

        // Check for array declaration: id[expr]
        if (this.check('[')) {
            node.children.push(this.consume()); // '['
            if (!this.check(']')) {
                node.children.push(this.parseExpr());
            }
            if (this.check(']')) node.children.push(this.consume()); // ']'
        }

        // Optional initializer
        if (this.check('=')) {
            node.children.push(this.consume()); // '='
            node.children.push(this.parseExpr());
        }

        // Semicolon
        if (this.check(';')) node.children.push(this.consume());

        const isPtr = node.children.some(c => c.value === '*');
        this.explanations.push({
            title: `Declaration: ${typeNode ? typeNode.value : '?'}${isPtr ? ' *' : ''} ${idNode ? idNode.value : '?'}`,
            text: `Declares a ${isPtr ? '<strong>pointer</strong> variable' : 'variable'} <code>${idNode ? idNode.value : '?'}</code> of type <code>${typeNode ? typeNode.value : '?'}${isPtr ? ' *' : ''}</code>.` +
                (node.children.some(c => c.value === '=') ? ' The variable is initialized with a value.' : '')
        });

        return node;
    }

    // ── DIRECTIVE ───────────────────────────────────────

    parseDirective() {
        const node = nt('DIRECTIVE');
        const dir = this.consume(); // entire '#include <stdio.h>' or '#define ...' token
        node.children.push(dir);

        const isInclude = dir.value.startsWith('#include');
        this.explanations.push({
            title: `Preprocessor: ${dir.value.split(' ')[0]}`,
            text: isInclude
                ? `Includes an external header file. The declarations inside it (like <code>printf</code>) become available to the program.`
                : `Defines a compile-time macro. The identifier is replaced with the value everywhere it appears before compilation.`
        });

        return node;
    }

    // ── FUNC_DEF ────────────────────────────────────────

    parseFuncDef() {
        const node = nt('FUNC_DEF');

        // Return type
        const typeNode = this.consume();
        node.children.push(typeNode);

        // Optional pointer return type: int *foo()
        if (this.check('*')) node.children.push(this.consume());

        // Function name
        const nameNode = this.consume();
        if (nameNode) node.children.push(nameNode);

        // Parameter list
        if (this.check('(')) node.children.push(this.consume()); // '('
        const params = this.parseParamList();
        if (params.children.length > 0) node.children.push(params);
        if (this.check(')')) node.children.push(this.consume()); // ')'

        // Function body OR prototype semicolon
        if (this.check('{')) {
            node.children.push(this.parseBlock());
        } else if (this.check(';')) {
            node.label = 'FUNC_PROTO';
            node.children.push(this.consume()); // ';'
        }

        const funcName = nameNode ? nameNode.value : '?';
        this.explanations.push({
            title: `Function: ${funcName}()`,
            text: node.label === 'FUNC_PROTO'
                ? `Forward declaration (prototype) of function <code>${funcName}</code>. Tells the compiler the signature before the body is defined.`
                : `Defines function <code>${funcName}</code> with its return type, parameter list, and body block.`
        });

        return node;
    }

    // ── PARAM_LIST ──────────────────────────────────────

    parseParamList() {
        const node = nt('PARAM_LIST');
        if (this.check(')') || this.check(';') || this.atEnd()) return node;

        // Handle void as empty param list: foo(void)
        if (this.check('void') && (this.tokens[this.pos + 1] === ')')) {
            node.children.push(this.consume()); // 'void'
            return node;
        }

        node.children.push(this.parseParam());
        while (this.check(',')) {
            node.children.push(this.consume()); // ','
            node.children.push(this.parseParam());
        }
        return node;
    }

    parseParam() {
        const node = nt('PARAM');
        // Type keyword
        if (TYPE_KEYWORDS.has(this.peek())) node.children.push(this.consume());
        // Optional pointer
        if (this.check('*')) node.children.push(this.consume());
        // Parameter name (optional — e.g. prototypes can omit it)
        if (this.peekType() === 'Identifier') node.children.push(this.consume());
        return node;
    }

    // ── WHILE_STMT ──────────────────────────────────────

    parseWhileStmt() {
        const node = nt('WHILE_STMT');
        node.children.push(this.consume()); // 'while'

        if (this.check('(')) node.children.push(this.consume()); // '('

        // Condition
        const cond = nt('CONDITION');
        cond.children.push(this.parseExpr());
        node.children.push(cond);

        if (this.check(')')) node.children.push(this.consume()); // ')'

        // Body (block or single statement)
        if (this.check('{')) {
            node.children.push(this.parseBlock());
        } else {
            const bodyStmt = this.parseStmt();
            if (bodyStmt) node.children.push(bodyStmt);
        }

        this.explanations.push({
            title: 'While Loop',
            text: 'Repeats the enclosed block as long as the condition evaluates to true. The condition is checked before each iteration.'
        });

        return node;
    }

    // ── FOR_STMT ────────────────────────────────────────

    parseForStmt() {
        const node = nt('FOR_STMT');
        node.children.push(this.consume()); // 'for'

        if (this.check('(')) node.children.push(this.consume()); // '('

        // Initializer
        const init = nt('FOR_INIT');
        if (!this.check(';')) {
            if (TYPE_KEYWORDS.has(this.peek())) {
                // Declaration-style init: for(int i = 0; ...)
                init.children.push(this.consume()); // type
                init.children.push(this.consume()); // id
                if (this.check('=')) {
                    init.children.push(this.consume());
                    init.children.push(this.parseExpr());
                }
            } else {
                init.children.push(this.parseExpr());
            }
        }
        node.children.push(init);
        if (this.check(';')) node.children.push(this.consume());

        // Condition
        const cond = nt('CONDITION');
        if (!this.check(';')) {
            cond.children.push(this.parseExpr());
        }
        node.children.push(cond);
        if (this.check(';')) node.children.push(this.consume());

        // Update
        const update = nt('FOR_UPDATE');
        if (!this.check(')')) {
            update.children.push(this.parseExpr());
        }
        node.children.push(update);

        if (this.check(')')) node.children.push(this.consume()); // ')'

        // Body
        if (this.check('{')) {
            node.children.push(this.parseBlock());
        } else {
            const bodyStmt = this.parseStmt();
            if (bodyStmt) node.children.push(bodyStmt);
        }

        this.explanations.push({
            title: 'For Loop',
            text: 'A counted loop with initialization, condition check, and update expression. Executes the body while the condition is true.'
        });

        return node;
    }

    // ── IF_STMT ─────────────────────────────────────────

    parseIfStmt() {
        const node = nt('IF_STMT');
        node.children.push(this.consume()); // 'if'

        if (this.check('(')) node.children.push(this.consume());

        const cond = nt('CONDITION');
        cond.children.push(this.parseExpr());
        node.children.push(cond);

        if (this.check(')')) node.children.push(this.consume());

        // Then branch
        if (this.check('{')) {
            node.children.push(this.parseBlock());
        } else {
            const thenStmt = this.parseStmt();
            if (thenStmt) node.children.push(thenStmt);
        }

        // Optional else
        if (this.check('else')) {
            node.children.push(this.consume()); // 'else'
            if (this.check('if')) {
                // else-if chain
                node.children.push(this.parseIfStmt());
            } else if (this.check('{')) {
                node.children.push(this.parseBlock());
            } else {
                const elseStmt = this.parseStmt();
                if (elseStmt) node.children.push(elseStmt);
            }
        }

        this.explanations.push({
            title: 'If Statement',
            text: 'Conditional branch — executes the then-block if the condition is true, otherwise the else-block (if present).'
        });

        return node;
    }

    // ── DO_WHILE_STMT ───────────────────────────────────

    parseDoWhileStmt() {
        const node = nt('DO_WHILE_STMT');
        node.children.push(this.consume()); // 'do'

        if (this.check('{')) {
            node.children.push(this.parseBlock());
        } else {
            const bodyStmt = this.parseStmt();
            if (bodyStmt) node.children.push(bodyStmt);
        }

        if (this.check('while')) node.children.push(this.consume());
        if (this.check('(')) node.children.push(this.consume());

        const cond = nt('CONDITION');
        cond.children.push(this.parseExpr());
        node.children.push(cond);

        if (this.check(')')) node.children.push(this.consume());
        if (this.check(';')) node.children.push(this.consume());

        this.explanations.push({
            title: 'Do-While Loop',
            text: 'Executes the body at least once, then repeats while the condition holds true.'
        });

        return node;
    }

    // ── RETURN_STMT ─────────────────────────────────────

    parseReturnStmt() {
        const node = nt('RETURN_STMT');
        node.children.push(this.consume()); // 'return'

        if (!this.check(';')) {
            node.children.push(this.parseExpr());
        }

        if (this.check(';')) node.children.push(this.consume());

        this.explanations.push({
            title: 'Return Statement',
            text: 'Returns a value (or void) from the current function to its caller.'
        });

        return node;
    }

    // ── BLOCK ───────────────────────────────────────────

    parseBlock() {
        const node = nt('BLOCK');
        if (this.check('{')) node.children.push(this.consume()); // '{'

        const inner = this.parseStmtList();
        node.children.push(inner);

        if (this.check('}')) node.children.push(this.consume()); // '}'
        return node;
    }

    // ── EXPR_STMT ───────────────────────────────────────

    parseExprStmt() {
        const node = nt('EXPR_STMT');
        const expr = this.parseExpr();
        if (expr) node.children.push(expr);
        if (this.check(';')) node.children.push(this.consume());

        // Generate explanation for notable expression statements
        if (expr && expr.label === 'FUNC_CALL') {
            const funcName = expr.children[0] ? expr.children[0].value : '?';
            this.explanations.push({
                title: `Function Call: ${funcName}()`,
                text: `Calls the function <code>${funcName}</code> with the provided arguments.`
            });
        }

        return node;
    }

    // ── EXPRESSION PARSING (operator precedence) ────────

    parseExpr() {
        return this.parseAssignment();
    }

    parseAssignment() {
        const left = this.parseLogical();
        if (this.peek() && ASSIGN_OPS.has(this.peek())) {
            const node = nt('ASSIGN_EXPR');
            node.children.push(left);
            node.children.push(this.consume()); // '='
            node.children.push(this.parseAssignment()); // right-associative
            return node;
        }
        return left;
    }

    parseLogical() {
        let left = this.parseRelational();
        while (this.peek() && LOGICAL_OPS.has(this.peek())) {
            const node = nt('LOGICAL_EXPR');
            node.children.push(left);
            node.children.push(this.consume()); // '&&' or '||'
            node.children.push(this.parseRelational());
            left = node;
        }
        return left;
    }

    parseRelational() {
        let left = this.parseAdditive();
        while (this.peek() && RELATIONAL_OPS.has(this.peek())) {
            const node = nt('REL_EXPR');
            node.children.push(left);
            node.children.push(this.consume()); // relational op
            node.children.push(this.parseAdditive());
            left = node;
        }
        return left;
    }

    parseAdditive() {
        let left = this.parseMultiplicative();
        while (this.peek() && ADDITIVE_OPS.has(this.peek()) &&
            // Disambiguate: don't eat '+' if it's actually '++'
            !(this.peek() === '+' && this.pos + 1 < this.tokens.length && this.tokens[this.pos] === '++') &&
            !(this.peek() === '-' && this.pos + 1 < this.tokens.length && this.tokens[this.pos] === '--')) {
            const node = nt('ADD_EXPR');
            node.children.push(left);
            node.children.push(this.consume()); // '+' or '-'
            node.children.push(this.parseMultiplicative());
            left = node;
        }
        return left;
    }

    parseMultiplicative() {
        let left = this.parseUnary();
        while (this.peek() && MULT_OPS.has(this.peek())) {
            const node = nt('MUL_EXPR');
            node.children.push(left);
            node.children.push(this.consume()); // '*', '/', '%'
            node.children.push(this.parseUnary());
            left = node;
        }
        return left;
    }

    parseUnary() {
        const tok = this.peek();
        // Prefix operators: !, ++, --, & (address-of)
        if (tok === '!' || tok === '++' || tok === '--' || tok === '&') {
            const node = nt('UNARY_EXPR');
            node.children.push(this.consume()); // the operator
            node.children.push(this.parseUnary());
            return node;
        }
        // Unary minus (only if not a binary minus — handled contextually)
        if (tok === '-' && this.peekType() === 'Operator') {
            const node = nt('UNARY_EXPR');
            node.children.push(this.consume());
            node.children.push(this.parseUnary());
            return node;
        }
        return this.parsePostfix();
    }

    parsePostfix() {
        let node = this.parsePrimary();

        while (true) {
            if (this.peek() === '++' || this.peek() === '--') {
                const post = nt('POSTFIX_EXPR');
                post.children.push(node);
                post.children.push(this.consume()); // '++' or '--'
                node = post;
            } else if (this.check('(')) {
                // Function call: id(args)
                const call = nt('FUNC_CALL');
                call.children.push(node); // function name
                call.children.push(this.consume()); // '('
                const args = this.parseArgList();
                if (args.children.length > 0) call.children.push(args);
                if (this.check(')')) call.children.push(this.consume()); // ')'
                node = call;
            } else if (this.check('[')) {
                // Array subscript: id[expr]
                const sub = nt('SUBSCRIPT');
                sub.children.push(node);
                sub.children.push(this.consume()); // '['
                sub.children.push(this.parseExpr());
                if (this.check(']')) sub.children.push(this.consume()); // ']'
                node = sub;
            } else {
                break;
            }
        }

        return node;
    }

    parseArgList() {
        const node = nt('ARG_LIST');
        if (this.check(')')) return node; // empty args

        node.children.push(this.parseExpr());
        while (this.check(',')) {
            node.children.push(this.consume()); // ','
            node.children.push(this.parseExpr());
        }
        return node;
    }

    parsePrimary() {
        const tok = this.peek();
        const typ = this.peekType();

        if (tok === null) return nt('EMPTY');

        // Parenthesized expression
        if (tok === '(') {
            const node = nt('PAREN_EXPR');
            node.children.push(this.consume()); // '('
            node.children.push(this.parseExpr());
            if (this.check(')')) node.children.push(this.consume()); // ')'
            return node;
        }

        // Number literal
        if (typ === 'Number') {
            return this.consume();
        }

        // String literal
        if (typ === 'String') {
            return this.consume();
        }

        // Identifier or function name
        if (typ === 'Identifier' || typ === 'Function') {
            return this.consume();
        }

        // If we hit a delimiter that's not something we can parse as an expression,
        // return null so the caller can handle it
        if (tok === ';' || tok === ')' || tok === '}' || tok === ']' || tok === ',') {
            return nt('EMPTY');
        }

        // Fallback: consume and wrap
        return this.consume();
    }

    // ── ENTRY POINT ─────────────────────────────────────

    parse() {
        const tree = this.parseProgram();
        return { tree, explanations: this.explanations };
    }
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

    // Parse tree (for Stage 4) — full recursive descent parse
    const parser = new Parser(tokens, tokenTypes);
    const { tree: parseTree, explanations: explanation } = parser.parse();

    const engineData = {
        sourceCode,
        cfgText,
        tokens,
        tokenTypes,
        // Parse tree data (Stage 4)
        parseTree,        // Complete hierarchical parse tree
        explanation,      // Array of { title, text } for each construct
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
