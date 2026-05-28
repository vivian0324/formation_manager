# Formation Manager

A choreography tool for managing dancer formations and optimizing them when a dancer is absent.

## Features

- Build formations with all dancers using a drag-and-drop stage editor
- Mark one or more dancers as absent — the same absence applies across all formations
- Mark VIP dancers with backup replacements
- Optimize all formations: absent dancers are removed and the formation is repaired with minimum disruption
- Pose assignment per dancer per formation: Standing, Floor, Face Left, Face Right
- Stage direction toggle (audience top or bottom)
- Grid snapping with visible gridlines
- Auto-save to browser localStorage — your work persists between sessions
- Export a shareable HTML report

## How to run

No build step, no server required. Open `index.html` directly in any modern browser:

```bash
open index.html          # macOS
start index.html         # Windows
xdg-open index.html      # Linux
```

Or serve locally:

```bash
npx serve .
# then open http://localhost:3000
```

Or deploy to **GitHub Pages**: push to a repo, go to Settings → Pages → Source: `main` / `root` → Save. The tool will be live at `https://YOUR_USERNAME.github.io/YOUR_REPO/`.

## Workflow

1. **Add dancers** in the sidebar. Bulk-paste a list if needed.
2. **Set stage direction** — audience bottom or top.
3. **Build formations** — start with one formation. Click `✏ Edit stage` to drag dancers into position. Set poses and VIP per formation. Use `+ Add (copy last)` to build the next formation from a copy of the previous one.
4. **Mark absent dancer(s)** in the sidebar — same dancer(s) absent across all formations.
5. **Optimize** — the engine removes absent dancers and repairs each formation.
6. **Review results** and export.

## File structure

```
formation-manager/
├── index.html          # Shell HTML — imports CSS and JS
├── README.md
├── css/
│   └── styles.css      # All styles (CSS variables, layout, stage, editor, cards)
└── js/
    ├── state.js        # Global state object (S), constants, localStorage persistence
    ├── dancers.js      # Add/remove dancers, absent/VIP toggle, sidebar rendering
    ├── formations.js   # Formation CRUD, auto-place, stage preview rendering
    ├── editor.js       # Full-screen drag-and-drop stage editor, pose assignment
    ├── optimizer.js    # Optimization engine (see below)
    └── ui.js           # Navigation, results rendering, export, utilities, init
```

## Optimization logic (`js/optimizer.js`)

The optimizer runs per formation after removing absent dancers.

### `computeSym(positions)`

Measures bilateral symmetry around the stage centre (x = 50).

For each dancer at `(x, y)`, checks whether another dancer exists within **1%** of the mirror point `(100 - x, y)`. Dancers within 1% of `x = 50` count as self-symmetric (on the centre line).

Returns a score from 0 (fully asymmetric) to 1 (perfectly symmetric).

### `closeGap(positions, absentPos)`

The core repair function. Called after removing absent dancers.

**Step 1** — Find orphans: dancers with no bilateral mirror partner (using 1% threshold).

**Step 2** — If no orphans, the formation is already symmetric → return unchanged.

**Step 3** — For the primary orphan (closest to where the absent dancer stood), find the nearest non-orphan dancer.

**Step 4** — Move that nearest non-orphan to the **absent dancer's exact original position**. This restores the bilateral mirror: the orphan gains a new partner at the symmetrically correct spot.

**Step 5** — Everyone else stays exactly where they were.

Example: Kristen was at (40, 40). wqy is at (60, 40) — orphaned. Rachel is nearest to wqy. Rachel moves to (40, 40). wqy and Rachel are now perfectly mirrored. All other dancers frozen.

### `optimizeFormation(f, prev)`

Runs the full optimization pipeline for one formation:

1. Remove absent dancers (`absFilter`)
2. `closeGap` — repair orphaned dancers
3. `fixPoseSymmetry` — snap left/right pose pairs to exact mirror positions (only if clearly mismatched)
4. `placeVips` — move VIP dancer to most prominent position if not already there
5. Count moves vs original positions (`countMoves`)

### `runOptimize()`

Runs `optimizeFormation` across all formations in sequence and renders results.

## State shape

All data lives in the global `S` object (defined in `js/state.js`):

```js
S = {
  dancers:    [],  // [{id, name, color}]
  absentIds:  [],  // dancer ids — same across all formations
  vipIds:     [],  // up to 3 VIP dancer ids
  vipBackups: {},  // {vipId: [backupId, backupId, backupId]}
  dir:        'bot', // 'bot' | 'top' — audience direction
  formations: [],  // [{id, name, vipDancerId, positions: [{x, y, dancerId, pose}]}]
  results:    [],  // [{label, formations: [...optimized formations]}]
}
```

Positions use a percentage coordinate system: `x` and `y` are 0–100, where (0,0) is top-left of the stage and (100,100) is bottom-right.

## Dependencies

- [Google Fonts](https://fonts.google.com) — DM Sans, DM Mono, Playfair Display (loaded via CDN, optional)
- No frameworks, no build tools, no npm

## License

MIT
