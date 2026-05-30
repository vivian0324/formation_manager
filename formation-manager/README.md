# Formation Manager

A choreography tool for building dancer formations and optimizing them when a dancer is absent.

## Features

- Drag-and-drop stage editor with grid snapping
- Per-formation VIP dancer assignment with hard/soft constraint toggle (🔒/🔓)
- Mark absent dancers — same absence applies across all formations
- Optimize formations: absent dancer removed, remaining dancers repositioned with minimum disruption
- Configurable optimization thresholds (A, B, D, E) in the sidebar
- Pose assignment per dancer: Standing, Floor, Face Left, Face Right
- Stage direction toggle (audience top or bottom)
- ↑ ↓ arrow buttons to reorder formations; ＋↑ to insert a formation before any existing one
- ↩ revert a formation to its previous save (Ctrl+Z / Cmd+Z)
- Auto-save to browser localStorage — work persists between sessions
- Export a shareable HTML report

## How to run

No build step or server required. Open `index.html` directly in any modern browser:

```bash
open index.html          # macOS
start index.html         # Windows
xdg-open index.html      # Linux
```

Or serve locally:

```bash
npx serve .
# open http://localhost:3000
```

Deploy to **GitHub Pages**: push to a repo → Settings → Pages → Source: `main` / `root` → Save.

## Workflow

1. **Add dancers** in the sidebar. Bulk-paste a list if needed.
2. **Set stage direction** — audience bottom or top.
3. **Build formations** — click `✏ Edit` to drag dancers into position. Set poses and VIP per formation.
4. **Mark absent dancer(s)** — click a dancer chip in the Roster to toggle absent.
5. **Set VIP constraint** — 🔓 soft (VIP may move if needed) or 🔒 hard (VIP never moves).
6. **Adjust thresholds** in the "Move thresholds" sidebar section if needed.
7. **Optimize** — the engine repairs each formation.
8. **Review** results and export.

## File structure

```
formation-manager/
├── index.html          # Shell HTML — imports CSS and JS
├── README.md
├── css/
│   └── styles.css      # All styles
└── js/
    ├── state.js        # Global state (S), constants, localStorage persistence
    ├── dancers.js      # Add/remove dancers, absent toggle, sidebar rendering
    ├── formations.js   # Formation CRUD, auto-place, stage preview rendering
    ├── editor.js       # Full-screen drag-and-drop stage editor
    ├── optimizer.js    # Optimization engine (see below)
    └── ui.js           # Navigation, results, export, utilities, init
```

## Optimization logic (`js/optimizer.js`)

### Overview

The optimizer runs per formation after removing the absent dancer. The goal is to restore bilateral symmetry around the stage centre (x = 50) with the minimum number of dancer moves.

### `computeSym(positions)`

Measures bilateral symmetry. For each dancer at `(x, y)`:
- If another dancer exists within **1%** of the mirror point `(100 - x, y)` → paired ✓
- If the dancer is within **1%** of `x = 50` → self-symmetric (centre line) ✓

Returns a score 0–1. Score ≥ **0.99** = "symmetric enough" → no action.

### `closeGap(positions, absentPos, nextPositions, fid, formVipId)`

The core repair function. Steps:

#### Step 1 — Symmetry check
If `computeSym ≥ 0.99` → return unchanged.

#### Step 2 — Score every active dancer for the absent spot `(tx, ty)`

```
score = 1.0 × dist(dancer → absent spot)
      + 0.4 × dist(absent spot → dancer's position in next formation)
```

Sort scores low → high. The lowest scorer is the **Candidate mover**.

- If the lowest scorer is a **hard-constrained VIP** → skip to second lowest.
- If multiple dancers tie for lowest score → pick the one **furthest from the audience** (further back = preferred).

#### Step 3 — Moving-Distance check on the Candidate

The move is **rejected** (optimization stops) if **any** of these conditions is met:

| | Condition | Default threshold |
|---|-----------|------------------|
| **A** | Candidate moves toward back of stage (vertically) | > `A × avgRowGap` |
| **B** | Candidate moves horizontally | > `B` units (default 10) |
| **C** | After the move, any row **closer to the audience** than the absent spot loses bilateral symmetry | — |
| **D** | Horizontal distance from absent spot to candidate's **next-formation position** | > `D` units (default 10) |
| **E** | Vertical distance from absent spot to candidate's **next-formation position** | > `E × avgRowGap` |

`avgRowGap` = (max_y − min_y) / (number of distinct rows − 1).

Thresholds A, B, D, E are user-configurable in the "Move thresholds" sidebar section.

If all conditions pass → **Candidate moves to the absent spot**.

#### Step 4 — Iterative orphan repair

After the primary fill, re-run the symmetry test. If still asymmetric, find **orphaned** dancers (those whose bilateral mirror partner was the dancer who just moved). For each orphan:

- The orphan's bilateral mirror position becomes the new "absent spot".
- Run the full scoring + Moving-Distance check to find the best filler.
- If a valid filler exists → move them. Otherwise → stop.

Repeat up to **30% of active dancers** have moved (move limit).

#### Step 5 — Method A / Method B

If the move limit is exceeded:
- **Method A:** apply all moves up to the limit.
- **Method B:** restart with the **second-lowest scorer** as the first mover, repeat the cascade.
- Pick whichever method uses fewer moves; if tied, pick better symmetry.

### Hard VIP constraint

When a formation's 🔒 button is active:
- The VIP dancer (`f.vipDancerId`) is **excluded from all candidate pools** — they cannot be selected as the primary mover or any cascade filler.
- `placeVips()` post-processing swap is also skipped — the VIP stays exactly where they were.

### State shape

```js
S = {
  dancers:    [],        // [{id, name, color}]
  absentIds:  [],        // dancer ids — same across all formations
  vipIds:     [],        // global VIP list (for badges)
  vipBackups: {},        // {vipId: [backupId, ...]}
  vipHardIds: Set(),     // formation IDs where VIP is hard-constrained
  dir:        'bot',     // 'bot' | 'top' — audience direction
  formations: [],        // [{id, name, vipDancerId, positions: [{x,y,dancerId,pose}]}]
  results:    [],        // [{label, formations: [...optimized]}]
  thresholds: {          // Moving-Distance check thresholds
    A: 1.0,              // back-of-stage multiplier (× avgRowGap)
    B: 10,               // horizontal move limit (units)
    D: 10,               // next-formation horizontal gap (units)
    E: 2.0               // next-formation vertical multiplier (× avgRowGap)
  }
}
```

Positions use a 0–100 percentage coordinate system: `(0,0)` = top-left, `(100,100)` = bottom-right.

## Dependencies

- [Google Fonts](https://fonts.google.com) — DM Sans, DM Mono, Playfair Display (CDN, optional)
- No frameworks, no build tools, no npm

## License

MIT
