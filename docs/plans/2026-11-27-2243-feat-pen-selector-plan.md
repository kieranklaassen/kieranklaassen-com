---
title: Pen Selector - Plan
type: feat
date: 2026-11-27
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Pen Selector - Plan

## Goal Capsule

- **Objective:** A reader can pick up a pen and write on any painted page of the site, marking its words as they would on paper, and finds the marks there on coming back.
- **Means:** An SVG ink layer inside the painted shell, with a pen tray beside the Sound control (KTD1).
- **Authority:** Requirements below, then Key Technical Decisions, then units.
- **Execution profile:** One PR.
- **Stop conditions:** The server-rendered ink layer cannot be kept empty and identical to the first hydrated render, or it breaks links or scrolling while no pen is held.
- **Tail ownership:** The caller ships the PR; merging and deploying stay with the user.

## Product Contract

### Summary

Add a pen tray to every painted page. It holds a pencil, fineliner, marker, brush pen, highlighter and eraser, with ink colours. A held pen draws on the page with mouse, touch or stylus. Marks made along text stay with that text, and all marks are kept in the reader's own browser.

### Problem Frame

The pages look like painted paper but cannot be written on. Clicking throws paint, which is decorative and is gone on reload; nothing lets a reader underline, circle or highlight.

### Requirements

- R1. A tray on every painted page offers pencil, fineliner, marker, brush pen, highlighter and eraser, and shows which is held.
- R2. Each drawing pen has its own character on the page: grain for the pencil, a thin even line for the fineliner, a wide even line for the marker, a line whose width follows pressure or speed for the brush pen, and a wide translucent stripe that leaves words legible for the highlighter.
- R3. Each drawing pen has a small set of colours, and remembers the one last chosen.
- R4. A held pen draws with mouse, touch and stylus; with touch, two fingers still scroll and zoom.
- R5. A stroke that runs along one line of text stays on the same words when the page is laid out at another width.
- R6. Any other stroke stays with the block it was drawn on.
- R7. The eraser removes a whole stroke that it touches; undo takes back the last stroke, erasure or clearing; clear removes every mark kept for the page, drawn or not.
- R8. Marks are kept per page in the reader's browser and return on the next visit; without browser storage, drawing still works for the visit.
- R9. With no pen held, links, selection, scrolling and thrown paint behave as before. Pressing the held pen again, Escape, or a Put down button that stays in view while a pen is held, puts it down. Folding the tray leaves the pen held, and the Pens button then shows and names it.
- R10. While a pen is held, drawing throws no paint and drops no water on the washes.
- R11. Every tray control is a named button reachable by keyboard, at least 44 px tall.

### Acceptance Examples

- AE1. Covers R5. **Given** a word highlighted at 1280 px, **when** the page is opened at 390 px, **then** the highlight covers the same word.
- AE2. Covers R8. **Given** a mark on one article, **when** another article is opened, **then** it is unmarked, and the first still has its mark on return.

### Scope Boundaries

- Marks are not shared between readers, and nothing is sent to the server.
- The old blocks look keeps no tray, as it has no Sound control either.
- Considered and not built: marking by keyboard selection. Drawing is a pointer action; evidence of readers who need it would change this.
- Considered and not built: a limit on kept marks. A full store is already tolerated by R8.

## Planning Contract

### Key Technical Decisions

- KTD1. Ink is SVG in one absolutely placed layer inside `.wc`, multiplied onto the page. It scrolls with the page at no cost, stays sharp, and is simple to erase by geometry. A canvas would need the sheet's tiling again.
- KTD2. A stroke is stored as raw points plus an anchor: block index and the start of its text, the block's size when drawn, and optionally a character range with that range's box. A stroke with a range maps its points from the stored box to the current one. A stroke with only a block moves its centre in proportion to the block and is scaled evenly by the smaller of 1 and the width ratio, so a circle stays a circle. Each stroke carries an id and the store a version.
- KTD3. A text range splits into one box per line. When a range wraps, the stroke is cut along its length in proportion to the boxes' widths.
- KTD4. Stored data is validated when read; anything malformed is dropped. A stroke whose block is no longer found is kept but not drawn.
- KTD5. The layer takes pointer events only while a pen is held, with `touch-action: pinch-zoom`. That gives native zoom only, so when a second touch lands the stroke is discarded and the layer scrolls the window by the movement of the touches' midpoint, until they lift or the browser takes over.
- KTD6. The layer renders empty on the server and on first hydration; stored marks load in an effect, as the SSR rule in `AGENTS.md` requires.
- KTD7. A save reads the stored strokes afresh and applies only its own additions and removals by id, so that two tabs on one page lose nothing.

### Assumptions

- Marks are private to the reader's browser; sharing was not asked for.
- The tray opens from one Pens button at the bottom left; Sound keeps the bottom right.
- Pages start with no pen held.

## Implementation Units

### U1. Pens, ink geometry and storage

- **Goal:** Pure modules that describe pens, shape strokes, hit-test them and keep them.
- **Requirements:** R2, R3, R7, R8.
- **Dependencies:** none
- **Files:** `app/frontend/pens/pens.ts`, `app/frontend/pens/ink.ts`, `app/frontend/pens/ink.test.ts`, `app/frontend/pens/kept.ts`, `app/frontend/pens/kept.test.ts`
- **Approach:** Follow KTD2, KTD4 and KTD7. Even pens are stroked centre lines; pencil and brush vary in width.
- **Patterns to follow:** storage access in `app/frontend/sound/switch.ts`.
- **Test scenarios:**
  - A single tap yields a visible dot.
  - Higher pressure yields a wider brush outline.
  - An eraser path crossing a stroke hits it; one well outside its width does not.
  - Kept strokes are read back for their own path and not for another.
  - Malformed JSON, a wrong version and a throwing store each read as no strokes.
  - A write that throws leaves drawing working without an error.
  - Two stores on one path each add a stroke, and both are read back.
- **Verification:** Tests pass. They catch geometry and storage faults, and miss how ink looks.

### U2. Anchoring

- **Goal:** Tie strokes to blocks and words, and place them again.
- **Requirements:** R5, R6.
- **Dependencies:** U1
- **Files:** `app/frontend/pens/anchor.ts`, `app/frontend/pens/anchor.test.ts`
- **Approach:** Follow KTD2 and KTD3.
- **Test scenarios:**
  - Points of a ranged stroke map from one box to another; a block stroke keeps its proportions.
  - A stroke over a range that wraps to two lines is cut into two, sized by their widths.
  - A flat wide stroke counts as running along a line; a circle does not.
  - A block moved to another index is found by its text; a missing block gives no placement.
- **Verification:** Tests pass with geometry stubbed. Real layout is proven in the browser (AE1).

### U3. Tray and ink layer

- **Goal:** The tray and drawing surface, mounted in the painted shell.
- **Requirements:** R1, R3, R4, R7, R8, R9, R10, R11.
- **Dependencies:** U1, U2
- **Files:** `app/frontend/pens/pens_tray.tsx`, `app/frontend/pens/pens.css`, `app/frontend/pens/pens_tray.test.tsx`, `app/frontend/looks/shell.tsx`, `app/frontend/entrypoints/application.css`, `app/frontend/watercolor/lay.ts`, `app/frontend/watercolor/lay.test.ts`, `app/frontend/sound/switch.ts`, `app/frontend/looks/sound.tsx`, `app/frontend/looks/watercolor.css`
- **Approach:**
  1. Mount beside `Sound` in `LookShell`, keyed by path without its query.
  2. Place strokes again when the shell changes size, when fonts arrive, and on a `wc:laid` event that `lay()` sends from the shell when it finishes, because composing may shift blocks without changing the shell's size.
  3. Make `fall` and `thrown` ignore the layer and tray, and keep tray presses from starting sound.
  4. Below 641 px the open tray sits above the bottom row and wraps; opening it folds Sound's parts and the reverse. The containers of both pass presses through where they hold no button.
- **Patterns to follow:** `app/frontend/looks/sound.tsx`.
- **Test scenarios:**
  - Server markup holds the Pens button and no strokes.
  - Choosing a pen marks it pressed; choosing it again, or Escape, puts it down.
  - Drawing adds one stroke and stores it; undo removes it.
  - Erasing removes a touched stroke; clear empties the page and undo restores it.
  - A cancelled pointer leaves no stroke.
  - With a pen held and the tray folded, the Pens button names the pen, and Put down frees the page.
  - A second touch discards the stroke and scrolls.
  - A click on the ink layer throws no paint, and `wc:laid` follows composing.
- **Verification:** Covers AE1 and AE2 in a real browser at desktop and phone widths.

## Verification Contract

- `npm run check`
- `npm run test:frontend`
- `npm run build`, then `bin/rails test`, with `SSR_STRICT=1` and the SSR server as in `.github/workflows/ci.yml`
- Browser run on the home page and one article, for R2, R4, R9, AE1 and AE2, with Sound unfolded at phone width. Emulation does not prove R4 on iOS; the PR says so if no device was used

## Definition of Done

- Every requirement is met and the Verification Contract passes.
- No server change, new dependency or abandoned code is left in the diff.
