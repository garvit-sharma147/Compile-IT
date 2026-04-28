# Contributing to Compile-IT

Thank you for your interest in contributing to Compile-IT! Here's how you can help:

## 🐛 Reporting Bugs

1. Check [existing issues](https://github.com/garvit-sharma147/Compile-IT/issues) first
2. Create a new issue with:
   - Clear title describing the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser and OS information

## 💡 Suggesting Features

Open an issue with the `enhancement` label and describe:
- The feature you'd like
- Why it would be useful
- How it fits into the existing game flow

## 🔧 Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Follow the existing code style (vanilla JS, ES modules, no frameworks)
4. Keep CSS scoped to individual pages via `<style>` blocks
5. Test in at least Chrome and Firefox
6. Submit a PR with a clear description

## 📐 Code Style

- **HTML**: Semantic elements, proper indentation (4 spaces)
- **CSS**: Use design tokens from `css/base.css` (e.g., `--bg-color`, `--panel-bg`)
- **JS**: ES modules, `const`/`let` only, descriptive function names, JSDoc comments for public functions
- **File naming**: `stage{N}_main.js` for level logic, `stage{N}.html` for level pages

## 🎮 Adding a New Stage

1. Create `pages/levels/stageN.html` using the 4-panel layout pattern
2. Create `js/levels/stageN_main.js` with the standard imports
3. The stage should already be defined in `js/map/levels.js`
4. Ensure the previous stage calls `unlockLevel(N)` on completion
