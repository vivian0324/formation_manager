# Formation Manager

A choreography tool for building dancer formations and optimizing them when a dancer is absent.

## Features

- Drag-and-drop stage editor with grid snapping (2.5% steps)
- Per-formation VIP dancer assignment with 🔒 hard / 🔓 soft constraint toggle
- Mark absent dancers — same absence applies across all formations
- Optimize formations with a configurable 5-condition Moving-Distance check
- Configurable optimization thresholds (A, B, C, D) + move limit in the sidebar
- Pose assignment per dancer: Standing, Floor, Face Left, Face Right
- Stage direction toggle (audience top or bottom)
- ↑ ↓ arrow buttons to reorder formations; ＋↑ to insert a formation before any existing one
- ↩ revert a formation to its previous save (Ctrl+Z / Cmd+Z)
- **Choreography management**: named save slots in localStorage + JSON export/import
- Auto-save to browser localStorage — work persists between sessions
- Export a shareable HTML report

## How to run

No build step or server required:

```bash
open index.html        # macOS
start index.html       # Windows
xdg-open index.html    # Linux
```

Or serve locally to avoid browser file-security restrictions:

```bash
npx serve .
# open http://localhost:3000
```

Deploy to **GitHub Pages**: push → Settings → Pages → Source: `main` / `root` → Save.

## Workflow

1. **Add dancers** in the sidebar. Bulk-paste a list if needed.
2. **Set stage direction** — audience bottom or top.
3. **Build formations** — click ✏ Edit to drag dancers into position. Set poses and VIP per formation. Use 🔒/🔓 to hard/soft-constrain the VIP.
4. **Mark absent dancer(s)** — click a dancer chip in the Roster to toggle absent.
5. **Adjust thresholds** in "Move thresholds" if needed.
6. **Optimize** — the engine repairs each formation.
7. **Review** results and export.
8. **Save choreography** — type a name and click Save to store it as a slot, or use ↓ Export JSON to save to disk.

## Choreography management

The **Choreographies** sidebar section lets you work on multiple shows without losing your work:

- **Save slots** — type a name and click Save. Up to any number of named slots stored in localStorage. Load or delete any slot.
- **↓ Export JSON** — downloads the full state as a `.json` file. The filename matches the choreography name you typed (or first formation name as fallback).
- **↑ Import JSON** — restores a previously exported `.json` file, replacing the current session.

> **Note:** to view an exported JSON file as the Formation Manager UI, you must import it back into the tool — JSON files are raw data, not webpages. Use **Export HTML** (in Actions) for a standalone shareable visual snapshot.

## File structure

```
formation-manager/
├── index.html          # Shell HTML — imports CSS and JS in correct order
├── README.md
├── css/
│   └── styles.css      # All styles
└── js/
    ├── state.js        # Global state (S), constants, localStorage persistence
    ├── dancers.js      # Add/remove dancers, absent toggle, sidebar rendering
    ├── formations.js   # Formation CRUD, auto-place, stage preview rendering
    ├── editor.js       # Full-screen drag-and-drop stage editor
    ├── optimizer.js    # Optimization engine (see below)
    └── ui.js           # Navigation, results, export/import, utilities, init
```

## Optimization logic (`js/optimizer.js`)

### Overview

The optimizer runs per formation after removing the absent dancer. The goal is to restore bilateral symmetry around the stage centre (x = 50) with minimum dancer moves.

### `computeSym(positions)`

For each dancer at `(x, y)`:
- Mirror partner exists within **1%** of `(100 - x, y)` → paired ✓
- Within **1%** of `x = 50` → self-symmetric (centre line) ✓

Returns a score 0–1. Score ≥ **0.99** = symmetric enough → no action.

### `closeGap(positions, absentPos, nextPositions, fid, formVipId, allPositions)`

The core repair function.

#### Step 1 — Symmetry check
If `computeSym ≥ 0.99` → return unchanged.

#### Step 2 — Score every active dancer for the absent spot `(tx, ty)`

```
score = 1.0 × dist(dancer → absent spot)
      + 0.4 × dist(absent spot → dancer's position in next formation)
```

Sort scores low → high. Lowest scorer = **Candidate mover**.

- Hard-constrained VIP → skip (cannot move).
- Multiple dancers tie → pick the one **furthest from the audience**.

#### Step 3 — Moving-Distance check (5 conditions)

The move is **rejected** if **any** condition is met. Checked in order:

| | Condition | Threshold |
|---|-----------|-----------|
| **A** | Candidate moves toward back of stage (vertically) | > `A × avgRowGap` |
| **B** | Candidate moves horizontally | > `B` units (default 10) |
| **C** | Horizontal: absent spot → candidate's next-formation position | > `C` units (default 10) |
| **D** | Vertical: absent spot → candidate's next-formation position | > `D × avgRowGap` |
| **E** | Any row **in front of the candidate's current position** (excl. candidate's own row) that was symmetric becomes asymmetric after the move | — |

`avgRowGap` = (max_y − min_y) / (rows − 1), computed from **all dancers including absent** so the threshold is stable regardless of who is absent.

If a candidate fails → try the **next lowest scorer** iteratively until one passes or all are exhausted.

If the candidate passes → move them to the absent spot.

#### Step 4 — Iterative orphan repair

Re-run symmetry test. If still asymmetric, find orphaned dancers (whose mirror partner just moved away). For each orphan, their bilateral mirror position becomes the new absent spot. Run the same scoring + Moving-Distance check to find a filler. Repeat up to **move limit** dancers total.

#### Step 5 — Method A / Method B

If move limit (default 30% of active dancers) is exceeded:
- **Method A:** apply moves up to the limit.
- **Method B:** restart using the **second-lowest scorer** as the first mover.
- Pick whichever uses fewer moves; if tied, pick better symmetry.

### Hard VIP constraint

When 🔒 is active for a formation:
- The VIP dancer is **excluded from all candidate pools** — never selected as a mover.
- `placeVips()` post-swap is skipped — VIP stays exactly in place.

### Configurable thresholds

Set in the **Move thresholds** sidebar section. Saved to `S.thresholds` and persisted in localStorage.

| Input | Controls | Default |
|-------|----------|---------|
| **A** | Back-of-stage vertical limit | 1.0 × avgRowGap |
| **B** | Horizontal move limit | 10 units |
| **C** | Next-formation horizontal gap | 10 units |
| **D** | Next-formation vertical gap | 2.0 × avgRowGap |
| **Max %** | Max dancers moved per formation | 30% |

Click **↺ Reset to defaults** to restore all values. Clearing any input auto-reverts to its default.

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
  thresholds: {
    A: 1.0,              // back-of-stage multiplier (× avgRowGap)
    B: 10,               // horizontal move limit (units)
    D: 10,               // next-formation horizontal gap (units)
    E: 2.0,              // next-formation vertical multiplier (× avgRowGap)
    moveLimit: 30        // % of active dancers that may move per formation
  }
}
```

Positions use 0–100 percentage coordinates: `(0,0)` = top-left, `(100,100)` = bottom-right.

## Dependencies

- [Google Fonts](https://fonts.google.com) — DM Sans, DM Mono, Playfair Display (CDN, optional)
- No frameworks, no build tools, no npm

## License

MIT
