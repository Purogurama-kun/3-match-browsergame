# Canvas Board Migration Plan

## Current Status

The live board has been migrated from 81 `.board__cell` elements to a canvas-backed renderer in `src/renderer.ts`.

Implemented so far:

- `templates/partials/hud-and-game.html` now renders:

```html
<div id="game" class="board">
    <canvas id="game-canvas" class="board__canvas"></canvas>
</div>
```

- `css/board.css` has a `.board__canvas` rule.
- `Renderer` now keeps `cellStates`, canvas metrics, selected/hint/exploding state, and canvas animation records instead of live cell elements.
- Pointer input is handled on the canvas and mapped back to board indices.
- Basic canvas drawing exists for normal candies, color-based shapes, blocked cells, sugar chests, collection items, generators, hard candy, hardening candy, and boosters.
- Basic canvas feedback exists for selection, hints, invalid move shake, spawn/drop, explosions, generator hits, bomb activation, bomb explosion, and bomb combos.
- `ParticleEffect` has coordinate-based methods so DOM particles and shockwaves can still be emitted from canvas cell centers.
- Collector row, particles, flashes, sugar coin notifications, HUD, menus, modals, toolbar, level select, leaderboard, and recording state are still DOM-based.

Verification already done:

- `npm run build` passed.
- A headless Chromium smoke test loaded the app menu and fetched the canvas page without startup errors.

Important repository note:

- Root `index.html` is generated from `templates/index.html.jinja` and the partials. Do not commit manual edits to root `index.html`. Running `npm run build` or `npm run render` will regenerate it from templates.

## Known Gaps

This migration is playable infrastructure, not visual or behavior parity.

Major gaps still known:

- Canvas candies are much simpler than the previous CSS candies. The previous highlights, pseudo-element shine, shadows, depth, hover polish, and shape detail are not fully recreated.
- Several candy/tile visual states need closer review against the old `.board__cell` CSS:
    - shifting candy
    - hard candy stages
    - hardening candy stages
    - blocker generators
    - line bombs in level mode and blocker mode
    - small/medium/large burst bombs
    - sugar chests
    - collection items
    - blocked/void cells
- Highlight rendering is incomplete compared with the DOM version. Selection and hints exist, but visual richness and state layering need work.
- Animations are intentionally basic and currently worse than the old CSS animations. Drop, spawn, invalid move, explosion, generator hit, bomb activation, bomb explosion, and combo animations need tuning.
- Some goal-related visual feedback from before may be missing or weaker. Re-test level goals that depend on color destruction, booster activation, hard candy destruction, and collection item delivery.
- Hover feedback from `.board__cell:hover` was not ported to canvas.
- Canvas rendering may not be pixel-perfect on all responsive sizes. Re-test mobile, landscape, and high-DPI displays.
- Accessibility from individual cell DOM elements is gone. If keyboard or screen-reader board interaction is desired, add a DOM accessibility layer or focused canvas interaction model.
- Old live `.board__cell*` CSS remains in `css/board.css`. Do not delete it until recording/debug views and all references are checked carefully.

Recommended next priority:

1. Re-test every existing game mode and level-goal type against the canvas renderer.
2. Create a visual parity pass for every `CellState` feature before deleting old CSS.
3. Improve animation quality only after all cell types and goal states are visibly correct.

## Goal

Replace the playable match-3 board cells with a canvas renderer. HUD, menus, modals, toolbars, level select, leaderboard, and other surrounding DOM UI should stay as DOM elements.

The current performance problem comes from rendering every live board cell as a `div` with many CSS classes, pseudo-elements, style properties, and CSS animations. The first migration should target only the live playable board.

## Current Entry Points

- `templates/partials/hud-and-game.html`
    - Contains the board container and `#game-canvas`.
    - Keep this as the source template; do not manually edit generated `index.html`.
- `src/renderer.ts`
    - Main live board renderer.
    - Owns canvas drawing, cell-state mapping, pointer listeners, selection, hints, drop animations, explosions, sugar coin notifications, and board particle integration.
- `src/board.ts`
    - Board state and cell state model.
    - Keep this mostly unchanged.
- `src/match3-game.ts`
    - Calls renderer methods such as `renderBoard`, `refreshBoard`, `updateCell`, `animateDrops`, `selectCell`, and `showInvalidMove`.
    - Avoid broad changes here by preserving the renderer public API where practical.
- `src/particle-effect.ts`
    - DOM particle system now supports board-local `{ x, y }` points.
    - Cell-element-based methods still exist for compatibility, but the live board should use coordinate-based emission.
- `css/board.css`
    - Contains most live cell visuals and animations.
    - Keep container, overlays, collector row, modal-independent board effects, and old cell styles until visual parity and reference cleanup are complete.

## Do Not Change In First Pass

- Do not modify generated root `index.html` by hand.
- Do not rewrite match logic, scoring, modes, boosters, or board state.
- Do not migrate the HUD to canvas.
- Do not migrate the recording state unless directly needed.
    - The recording board also uses div cells, but it is a separate debug/playback view, not the live game board.

## Suggested Markup

Use the existing `game` container as the layout and overlay root:

```html
<div id="game" class="board">
    <canvas id="game-canvas" class="board__canvas"></canvas>
</div>
```

The container should retain `touch-action: none`, sizing, collector row positioning, particles/notification overlays if they remain DOM-based, and any mode-based visibility behavior.

## Renderer Strategy

Keep the `Renderer` public methods stable where possible:

- `renderBoard(board, onCellClick, onCellSwipe)`
- `refreshBoard(board)`
- `updateCell(index, state)`
- `animateDrops(moves, spawnedIndices)`
- `showInvalidMove(index)`
- `clearInvalidMove(index)`
- `selectCell(index)`
- `clearSelection()`
- `showHint(indices)`
- `clearHint()`
- `markCellExploding(index)`
- `clearCellExplosion(index)`
- `emitCellParticles(index, color, options)`
- `animateBombActivation(index, boosterType)`
- `animateBombExplosion(index, boosterType)`
- `animateBombCombo(indices, strength)`
- `playSpawnAnimation()`
- `animateGeneratorHit(index)`
- `showSugarCoinReward(index, amount)`

Internally, replace `cells: HTMLDivElement[]` with canvas-oriented state:

- `cellStates: CellState[]`
- `selectedIndex: number | null`
- `hintIndices: Set<number>`
- `explodingIndices: Set<number>`
- active animations keyed by index or effect id
- cached board metrics:
    - canvas CSS size
    - device pixel ratio
    - cell size
    - gap
    - padding
    - board origin

## Canvas Sizing

Calculate board geometry from the existing CSS/layout instead of hardcoding pixel sizes.

Recommended approach:

1. Let `.board` define the CSS size using current `--cell-size`, padding, and gap.
2. On render and resize:
    - read the board container client size
    - set canvas CSS width/height to match
    - set backing store width/height to `cssSize * devicePixelRatio`
    - scale the 2D context by device pixel ratio
3. Recompute cell rectangles using `GRID_SIZE`, padding, gap, and available size.

Use `ResizeObserver` on the board container so orientation changes and responsive breakpoints redraw correctly.

## Input Handling

Replace per-cell DOM listeners with one set of listeners on the canvas or board container.

Required behavior:

- click/tap maps pointer coordinates to a board index
- swipe maps start index plus direction to the existing `onCellSwipe(index, direction)` callback
- blocked cells can still be passed to current game logic; current logic already rejects illegal targets
- keep the current swipe threshold behavior, currently `18`

Implementation helper:

```ts
private getIndexAtPoint(clientX: number, clientY: number): number | null
```

This should:

- convert viewport coordinates to board-local coordinates
- account for padding and gaps
- return `null` when outside a cell
- return `row * GRID_SIZE + col` when inside a valid cell

## Drawing Responsibilities

Move current `.board__cell` visual states into drawing helpers.

Suggested helper split:

- `drawBoard()`
- `drawCell(index, state, animationState)`
- `drawBaseCandy(rect, color, shape)`
- `drawVoidCell(rect)`
- `drawSugarChest(rect, stage)`
- `drawCollectionItem(rect)`
- `drawGenerator(rect, state)`
- `drawHardCandyOverlay(rect, stage)`
- `drawHardeningOverlay(rect, stage)`
- `drawBooster(rect, booster, orientation)`
- `drawSelection(rect)`
- `drawHint(rect, time)`
- `drawExplosion(rect, progress)`
- `drawInvalidMove(rect, progress)`

Keep the drawing code simple. Prefer a few clear canvas primitives over a pixel-perfect copy of every CSS pseudo-element.

Current implementation note:

- The renderer already has drawing helpers for the main states, but they are first-pass approximations.
- Do not treat the current visuals as final. Use the old `.board__cell*` CSS as the visual reference for a parity pass.
- Before changing match logic, confirm whether a missing behavior is actually a rendering gap.

## Assets

Preload images used inside board cells:

- `/assets/images/sugar-chest-01.webp`
- `/assets/images/sugar-chest-02.webp`
- `/assets/images/sugar-chest-03.webp`
- any other sugar chest stages currently produced by board logic
- `/assets/images/collectable-rainbow_star.png`
- `/assets/images/sugar_coin.webp` if sugar coin notifications move to canvas
- collector/arrow images only if the collector row moves to canvas

Until images are loaded, draw a simple fallback shape rather than blocking gameplay.

## Animations

Replace CSS cell animations with a single canvas animation system.

Use `requestAnimationFrame` only while:

- active animations exist
- hint pulse is visible
- redraw has been requested

Suggested animation records:

```ts
type CellAnimation =
    | { kind: 'drop'; index: number; fromRowOffset: number; startedAt: number; duration: number }
    | { kind: 'spawn'; index: number; startedAt: number; duration: number; delay: number }
    | { kind: 'invalid'; index: number; startedAt: number; duration: number }
    | { kind: 'explode'; index: number; startedAt: number; duration: number }
    | { kind: 'generatorHit'; index: number; startedAt: number; duration: number }
    | { kind: 'bombActivation'; index: number; startedAt: number; duration: number }
    | { kind: 'bombExplosion'; index: number; startedAt: number; duration: number };
```

First implement:

1. static board redraw
2. selection and hint outlines
3. invalid move shake
4. spawn animation
5. drop animation
6. explosion and bomb animations

Current implementation note:

- These animation kinds exist in `Renderer`, but timing/easing/visual richness still need polish.
- The current drop/spawn system uses final board state plus animation offsets, which matches the intended migration shape.
- Future animation work should avoid reintroducing per-cell DOM elements for the live board.

## Drops

Current flow:

1. `dropCells()` mutates the board.
2. `renderer.refreshBoard(this.board)` applies the final state.
3. `renderer.animateDrops(moves, spawnedIndices)` animates visual cells falling into final slots.

Canvas renderer can keep the same flow:

- Store final `CellState[]` immediately.
- During draw, render cells with active drop animations offset upward by `deltaRows * rowStep`.
- For spawned cells, start above the board by `row + 1` rows and fall into place.

This preserves the current game timing expectations.

## Particles And Effects

Previously, `ParticleEffect` expected a cell `HTMLDivElement`.

Migration options:

1. Short-term: change particle methods to accept board-local coordinates or cell index.
2. Long-term: move particles, shockwaves, flashes, combo sparks, and sugar coin notifications into canvas drawing.

Current status:

- `ParticleEffect` accepts `{ x, y }` center points from `Renderer`.
- Keep particles DOM-based until cell rendering is stable.

## Collector Row

The collector row is currently DOM-based and attached to the board container.

Leave it DOM-based initially:

- It has only 9 slots.
- It is not the main performance problem.
- It avoids mixing collector layout into the first canvas migration.

After the main board is stable, decide whether to draw it on canvas.

## CSS Cleanup

Keep:

- `.board`
- `.board--has-collector`
- `.board--shake`
- `.board__collector-*`
- `.board__particles`
- modal-independent board overlays still used by DOM effects

Add:

```css
.board__canvas {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
}
```

Retire cell-specific classes only after the canvas renderer no longer uses them:

- `.board__cell`
- `.board__cell--selected`
- `.board__cell--hint`
- `.board__cell--spawn`
- `.board__cell--drop`
- `.board__cell--hard*`
- `.board__cell--bomb*`
- shape classes

Do this carefully because the recording state uses its own `recording-state__cell` classes and should not be affected.

Current cleanup status:

- Do not delete old `.board__cell*` styles yet.
- They are no longer used by the live canvas board, but they remain useful as visual reference during parity work.
- Confirm no tests, debug utilities, or generated examples depend on them before removing them.

## Implementation Order

Done:

1. Add canvas markup and CSS while preserving board container behavior.
2. Refactor `Renderer.renderBoard` to use canvas state and store callbacks.
3. Implement board metrics, resize handling, static `CellState` drawing, and full redraw.
4. Implement pointer hit testing and swipe handling.
5. Preserve basic selection and hint behavior on canvas.
6. Implement basic invalid move feedback.
7. Implement basic spawn and drop animations.
8. Implement basic explosion, generator hit, bomb activation, and bomb explosion animations.
9. Adapt particle effects to index/coordinate-based emission.

Still to do:

1. Verify and repair every candy/tile type against real gameplay.
2. Restore visual parity with the old CSS cells where it matters.
3. Improve highlight/selection/hint layering.
4. Improve animation quality.
5. Re-test all goal types and modes.
6. Only then remove unused live board cell DOM code and CSS.

## Verification Checklist

Run the TypeScript build before serving:

```bash
npm run build
```

Then test in the browser using the local dev server:

- level board appears at the correct responsive size
- click selection works
- swipe movement works
- invalid moves visibly respond
- matches clear
- cells drop and spawn smoothly
- hints show and clear
- boosters render correctly
- hard candy and hardening candy render correctly
- generators render and react to hits
- sugar chests render and reward coins
- collection items render and collect
- blocker mode and time mode still work
- performance mode still suppresses expensive effects
- square/shaped cell option still changes visuals
- mobile/touch behavior works
- recording state still opens and displays snapshots

Add these current-regression checks:

- every candy type/state is distinguishable at a glance
- highlights are visible over every candy/tile type
- visual feedback for goal progress still makes sense
- old square/shaped candy option is still meaningful in canvas
- canvas board does not look flat or unfinished compared with the old CSS version
- animations do not make matches or falling cells harder to read

## Notes

- Keep functions small; drawing helpers are easier to maintain than one large `drawCell` method.
- Avoid introducing dependencies.
- Keep strict TypeScript settings.
- Do not chase pixel-perfect CSS parity before the board is playable; stable gameplay and animation correctness come first.
