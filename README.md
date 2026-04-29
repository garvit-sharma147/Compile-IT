# 🏰 Compile-IT

> **An interactive web game to learn compiler design concepts through hands-on challenges.**

Compile-IT transforms abstract compiler design theory into an engaging, stage-based adventure. Players progress through 8 stages — each teaching a core concept from tokenization to LL(1) parsing — by solving interactive puzzles with real-time visual feedback.

---

## 🎮 Live Demo

Open `index.html` in any modern browser to start playing. No build step or server required.

---

## 📸 Screenshots

<details>
<summary><strong>Click to view screenshots</strong></summary>

### World Map
Navigate between stages on an interactive dungeon-themed map with branching paths.

### Stage 1 — Start Challenge
Configure your C source code and Context-Free Grammar to power all subsequent stages.

### Stage 4 — Parse Tree Tower
Watch a full recursive descent parse tree visualized with interactive, hierarchical nodes.

### Stage 7 — FIRST & FOLLOW Bridge
Compute FIRST and FOLLOW sets in a dynamic table with per-cell validation feedback.

### Stage 8 — LL(1) Tower
Observe automatic LL(1) predictive parsing with parse tree, step-by-step stack trace, and parsing table.

</details>

---

## 🗺️ Game Stages

| # | Stage | Branch | Concept | Interaction |
|---|-------|--------|---------|-------------|
| 1 | **Start Challenge** | — | Input Configuration | Enter C code + CFG grammar |
| 2 | **Token Forge** | Compiler | Lexical Analysis | Drag-and-drop token classification |
| 3 | **Syntax Castle** | Compiler | AST Construction | Build abstract syntax trees |
| 4 | **Parse Tree Tower** | Compiler | Parse Trees | Visualize recursive descent parsing |
| 5 | **Optimization Lab** | Compiler | Code Optimization | Rewrite code with optimizations |
| 6 | **Grammar Temple** | CFG | String Validation | Test strings against a CFG |
| 7 | **FIRST & FOLLOW Bridge** | CFG | FIRST/FOLLOW Sets | Compute and verify set entries |
| 8 | **LL(1) Tower** | CFG | Predictive Parsing | Observe LL(1) parsing demonstration |

---

## 🏗️ Architecture

```
compile-IT/
├── index.html                  # Entry point — main menu
├── map.html                    # World map — stage navigation
├── css/
│   ├── base.css                # Design tokens & CSS variables
│   ├── layout.css              # Grid layouts & panel structure
│   ├── components.css          # Buttons, inputs, console, HUD
│   ├── animations.css          # Transitions & micro-animations
│   └── map.css                 # World map styles
├── js/
│   ├── core/
│   │   ├── app.js              # Main menu renderer
│   │   └── router.js           # Simple SPA router
│   ├── engine/
│   │   └── global_engine.js    # Central computation engine
│   ├── levels/
│   │   ├── stage1_main.js      # Start Challenge
│   │   ├── stage2_main.js      # Token Forge
│   │   ├── stage3_main.js      # Syntax Castle
│   │   ├── stage4_main.js      # Parse Tree Tower
│   │   ├── stage5_main.js      # Optimization Lab
│   │   ├── stage6_main.js      # Grammar Temple
│   │   ├── stage7_main.js      # FIRST & FOLLOW Bridge
│   │   └── stage8_main.js      # LL(1) Tower
│   ├── map/
│   │   ├── levels.js           # Stage definitions & map config
│   │   └── map.js              # Map renderer & navigation
│   ├── ui/
│   │   └── animations.js       # UI animation utilities
│   └── utils/
│       ├── score.js            # Score management
│       └── storage.js          # localStorage persistence
└── pages/
    └── levels/
        ├── stage1.html ... stage8.html
```

---

## 🔧 Technical Highlights

### Compiler Engine (`global_engine.js`)
- **Tokenizer** — regex-based C language lexer
- **Token Classifier** — categorizes into Keywords, Operators, Identifiers, etc.
- **Recursive Descent Parser** — full CST builder supporting declarations, loops, conditionals, expressions
- **Tree Explainer** — auto-generates human-readable explanations of parse tree nodes
- **Optimization Challenges** — constant folding, algebraic simplification, dead code removal

### CFG Analysis Pipeline
- **Grammar Parser** — parses `→` / `->` notation with ε-production support
- **String Validator** (Stage 6) — recursive leftmost derivation with depth limiting and memoization
- **FIRST/FOLLOW Computation** (Stage 7) — standard fixed-point algorithms
- **LL(1) Table Builder** (Stage 8) — parsing table construction with conflict detection
- **Grammar Pre-Validation** — detects left recursion, FIRST/FIRST conflicts, FIRST/FOLLOW conflicts, ambiguity; graceful fallback to demo grammar

### Game Systems
- **Score tracking** — persistent across stages via `localStorage`
- **Level progression** — stage unlock system with branching paths
- **Attempt system** — 3 attempts on interactive stages with progressive hints
- **Visual feedback** — per-element green/red glow, shake animations, derivation chains

---

## 🚀 Getting Started

### Prerequisites
- Any modern web browser (Chrome, Firefox, Edge, Safari)
- No server, build tools, or dependencies required

### Run Locally
```bash
# Clone the repository
git clone https://github.com/garvit-sharma147/Compile-IT.git
cd Compile-IT

# Open in browser
# Option 1: Direct file
open index.html

# Option 2: Local server (for ES module support)
python -m http.server 8080
# Then visit http://localhost:8080
```

---

## 🎨 Design System

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-color` | `#2c3e50` | Page background |
| `--panel-bg` | `#fdf5e6` | Panel backgrounds |
| `--btn-color` | `#7a5f3d` | Primary buttons |
| `--score-color` | `gold` | Score display |
| `--border-color` | `#c2b280` | Panel borders |
| Font | Poppins | All UI text |
| Code Font | Courier New | Code displays |

---

## 🛠️ Tech Stack

- **HTML5** — Semantic structure
- **CSS3** — Custom properties, grid/flexbox layouts, gradients, animations
- **Vanilla JavaScript (ES Modules)** — No frameworks or build tools
- **SVG** — Parse tree connector lines
- **localStorage** — Game state persistence

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**Garvit Sharma**
- GitHub: [@garvit-sharma147](https://github.com/garvit-sharma147)

---

<p align="center">
  <strong>⚔️ Enter the compiler dungeon. Master the machine. ⚔️</strong>
</p>
