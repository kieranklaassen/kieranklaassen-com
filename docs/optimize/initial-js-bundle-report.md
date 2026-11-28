# Initial client JavaScript bundle size

Workload: production Vite client and SSR bundles (`npm run build`), measured from `public/vite/.vite/manifest.json` static import graphs (hydration-blocking initial JS) and full initial-visit JS transferred in headless Chromium (gzip level 9, fresh cache) across `/`, `/creativity,/breathwork/2025/04/11/unlocking-ideas/`, `/posts`, `/about`, and `/?look=blocks`. Baseline commit: `b3d7944`.

## Where the cost was

On baseline, `entrypoints/inertia.tsx` and every page imported a single `shell-*.js` chunk (413,770 B raw / 136,443 B gzip; 201,735 B app source + 897,387 B vendor source):

- `app/frontend/looks/looks.ts` synchronously imported all four article composers (`watercolor/article.ts`, 14.2 kB), all 32 slug drawings (`art/pictures.ts`, 33.0 kB; `art/shapes.ts`, 5.2 kB; `watercolor/picture.ts`, 9.3 kB), and all six page composers (`watercolor/compose.ts`, 34.8 kB, which also pulled in `picture.ts` solely for `score`). None of the article stack or off-route composers run on `/`, and `PaintedSheet` only invokes its composer inside a client `useEffect` after `Painter.ready()` and `document.fonts.ready`.
- `app/frontend/pens/pens_tray.tsx` eagerly bundled the entire drawing engine (`pens_tray.tsx`, `anchor.ts`, `ink.ts`, `kept.ts`, `pen_pictures.tsx`, `pens.ts` — 31.0 kB source) and generated 420 pencil-grain SVG speck paths at module evaluation time, even though the SSR and default closed visit renders only an empty `.wc-ink` container and a single `Pens` button.
- `app/frontend/looks/score.tsx` statically imported `Instrument` from `looks/player.ts` (3,032 B minified raw / 1,504 B gzip) on `/` and `/posts`, even though it is only constructed inside `async press()` when Play is clicked.
- On default article visits (`/posts/show`, `art: 'wide'`), `article.ts` bundled the other three article layouts (`book`, `around`, `river`) and `art/pictures.ts` bundled 13 `every-*` drawings for external publications that never render on `/posts/show`.

## Changes

1. **Split and lazy-load watercolor composers** (`app/frontend/looks/rooms.ts`, `app/frontend/watercolor/compose_*.ts`, `long_page.ts`, `estuary.ts`, `small_squares.ts`, `score.ts`, `mosaic.ts`, `lay.ts`, `sheet.tsx`, `by_look.tsx`, `shell.tsx`, `sound.tsx`):
   - `LookShell` and `ByLook` resolve lightweight room metadata (`roomLayoutOf`) without statically importing composer modules.
   - `PaintedSheet` passes `loadCompose(room)` into `laySheet`, which awaits the dynamic composer chunk in parallel with `Painter.ready()` and `document.fonts.ready` (`Promise.all([painter.ready(), faced, loaded])`) so shader compilation starts immediately with no extra waterfall.
   - `looks.ts` and `compose.ts` preserve all existing public exports.
2. **Lazy-load interactive Pens workspace** (`app/frontend/pens/pens_tray.tsx`, `pens_workspace.tsx`, `looks/fold.ts`):
   - `Pens` renders the exact closed SSR and initial-hydrated button markup synchronously, and dynamically imports `pens_workspace.tsx` only when clicked or when saved strokes/colours exist in `localStorage`.
3. **Lazy-load Score audio player** (`app/frontend/looks/score.tsx`):
   - `Score` dynamically imports `./player` inside `async press()` on Play click with a re-entrancy guard.
4. **Split default `wide` article layout and local post pictures** (`app/frontend/art/pictures_shared.ts`, `pictures_local.ts`, `pictures_every.ts`, `watercolor/picture_core.ts`, `article_shared.ts`, `article_wide.ts`, `article_layouts.ts`):
   - Default `wide` article visits load only `article_wide.ts` and `pictures_local.ts` (16 local posts), leaving `book`/`around`/`river` and the 13 external `every-*` drawings out of article visits while preserving `art/pictures.ts` (`pictureOf`) and `watercolor/article.ts` exports.
5. **Reverted experiment**: splitting `SquareBackground`'s `useEffect` canvas loop saved only 537 B gzip (-0.45%, below the 1% threshold) and was reverted.

## Result

Deterministic production bundle sizes (baseline `b3d7944` vs final, all six required objectives cleared the 1% relative threshold):

| Route / metric | Before (raw) | After (raw) | Delta (raw) | Before (gzip) | After (gzip) | Delta (gzip) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Entry only (`entrypoints/inertia.tsx`) | 418,202 B | 358,747 B | -59,455 B (-14.2%) | 138,519 B | 115,506 B | -23,013 B (-16.6%) |
| Home `/` initial (pre-hydration) | 432,538 B | 370,476 B | -62,062 B (-14.3%) | 144,301 B | 119,946 B | -24,355 B (-16.9%) |
| Home `/` total visit (incl. `long_page`) | 432,538 B | 382,167 B | -50,371 B (-11.6%) | 144,301 B | 126,319 B | -17,982 B (-12.5%) |
| Article `/posts/show` initial (pre-hydration) | 422,191 B | 362,736 B | -59,455 B (-14.1%) | 140,016 B | 117,007 B | -23,009 B (-16.4%) |
| Article `/posts/show` total visit (incl. `article_wide`) | 422,191 B | 392,263 B | -29,928 B (-7.1%) | 140,016 B | 131,089 B | -8,927 B (-6.4%) |
| Thoughts `/posts` total visit (Chromium) | 430,131 B | 402,152 B | -27,979 B (-6.5%) | 143,616 B | 135,299 B | -8,317 B (-5.8%) |
| About `/about` total visit (Chromium) | 419,181 B | 367,466 B | -51,715 B (-12.3%) | 139,112 B | 120,390 B | -18,722 B (-13.5%) |
| Blocks `/?look=blocks` total visit (Chromium) | 432,538 B | 370,476 B | -62,062 B (-14.3%) | 144,301 B | 119,946 B | -24,355 B (-16.9%) |

## Equivalence and verification

- **SSR markup**: 13/13 SSR route/look payloads (`/`, `/?look=blocks`, `rooms`, `estuary`, `score`, `mosaic`, `page`, article `wide`/`river`/`blocks`, `/posts`, `/about`, `/missing`) match baseline `{ head, body }` byte-for-byte.
- **Browser network transfer & watercolor pixels**: Headless Chromium at 1440x900 @2x with deterministic `seed=42`, frozen `Date.now()`, and `prefers-reduced-motion: reduce` confirmed exact byte-for-byte match between manifest totals and actual HTTP JS transfer, 0 console/page/hydration errors across all 5 routes, interactive `Pens` tray opening on click, and **0 of 14 painted canvas tiles differing** by SHA-256 (`/` 0/4, article 0/3, `/posts` 0/4, `/about` 0/3).
- **Test suites and static checks**:
  - `npm run check`: passed
  - `npm run test:frontend`: 44 files, 492 tests passed (0 failed; +3 net new tests)
  - `SSR_STRICT=1 bin/rails test`: 65 runs, 620 assertions, 0 failures, 0 errors, 0 skips
  - `bin/rubocop`: 41 files inspected, 0 offenses
  - `bin/brakeman --no-pager`: 0 warnings, 0 errors

## Remaining cost

Of the 110.5 kB gzip remaining in `shell-*.js`, ~92 kB is third-party runtime (`react-dom`, `@inertiajs/core`, `@inertiajs/react`, `es-toolkit`, `laravel-precognition`, `scheduler`), ~12 kB is active watercolor runtime (`lay.ts`, `painter.ts`, `shader.ts`, kept eager so WebGL shader compilation begins immediately on mount), and ~6.5 kB is shell/sound/blocks code with no single remaining module above 1% gzip.
