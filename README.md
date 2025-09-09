# tree2

Decision Tree Animator — Fruits

This is a self-contained, client-side web app that builds and animates a simple decision tree on a small synthetic fruits dataset (Apple / Orange / Lemon).

Files added:
- `index.html` — main page
- `style.css` — styles
- `script.js` — dataset, tree builder and D3 visualization/animation

How to run

Open `index.html` in your browser. For a simple local server (recommended):

```bash
# from repository root
python3 -m http.server 8000
# then open http://localhost:8000 in your browser
```

What it does

- Uses a tiny CART-like splitter to choose axis-aligned numeric thresholds.
- Animates building the tree: partitions, split lines, and point highlighting.
- Provides controls: select features for X/Y, set max depth, build/play/step/reset.

Notes / next steps

- The tree algorithm is intentionally simple for clarity and animation. Could be extended to handle categorical features more richly, add pruning, or show the tree structure in a linked view.