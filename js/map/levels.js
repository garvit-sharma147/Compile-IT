// js/map/levels.js — 8 level definitions with URL field (data-driven routing)
export const levels = [
    // Stage 1: Start Challenge (root node, center)
    {
        id: 1,
        name: "Start Challenge",
        x: 200,
        y: 750,
        next: [2, 6],
        url: "pages/levels/stage1.html",
        branch: null
    },

    // ===== LEFT BRANCH: C Code Analyzer =====
    {
        id: 2,
        name: "Lexical Forest",
        x: 100,
        y: 620,
        next: [3],
        url: "pages/levels/stage2.html",
        branch: "C"
    },
    {
        id: 3,
        name: "Token Valley",
        x: 60,
        y: 490,
        next: [4],
        url: "pages/levels/stage3.html",
        branch: "C"
    },
    {
        id: 4,
        name: "Parse Tree Tower",
        x: 100,
        y: 360,
        next: [5],
        url: "pages/levels/stage4.html",
        branch: "C"
    },
    {
        id: 5,
        name: "Code Optimization",
        x: 60,
        y: 230,
        next: [],
        url: "pages/levels/stage5.html",
        branch: "C"
    },

    // ===== RIGHT BRANCH: CFG Analyzer =====
    {
        id: 6,
        name: "Grammar Temple",
        x: 300,
        y: 620,
        next: [7],
        url: "pages/levels/stage6.html",
        branch: "CFG"
    },
    {
        id: 7,
        name: "FIRST & FOLLOW",
        x: 340,
        y: 490,
        next: [8],
        url: "pages/levels/stage7.html",
        branch: "CFG"
    },
    {
        id: 8,
        name: "LL(1) Tower",
        x: 300,
        y: 360,
        next: [],
        url: "pages/levels/stage8.html",
        branch: "CFG"
    }
];
