# Initial client JavaScript bundle size

Workload: production Vite client and SSR bundles (`npm run build`), measured from `public/vite/.vite/manifest.json` static and on-demand dynamic import graphs (gzip level 9) across `/`, `/posts/show` (default `wide` article), `/posts`, `/about`, and `/?look=blocks`. Baseline commit: `b3d7944`.

## Where the cost was

On baseline, `entrypoints/inertia.tsx` and every page imported a single `shell-*.js` chunk (413,770 B raw / 136,443 B gzip):

- `app/frontend/looks/looks.ts` synchronously imported all four article composers (`watercolor/article.ts`, 14.2 kB), all 32 slug drawings (`art/pictures.ts`, 33.0 kB; `art/shapes.ts`, 5.2 kB; `watercolor/picture.ts`, 9.3 kB), and all six page composers (`watercolor/compose.ts`, 34.8 kB, which also pulled in `picture.ts` solely for `score`). None of the article stack or off-route composers run on `/`, and `PaintedSheet` only invokes its composer inside a client `useEffect` after `Painter.ready()` and `document.fonts.ready`.
- On default article visits (`/posts/show`, `art: 'wide'`), `article.ts` bundled the other three article layouts (`book`, `around`, `river`) and `art/pictures.ts` bundled 13 `every-*` drawings for external publications that never render on `/posts/show`.

## Changes

1. **Split and lazy-load watercolor composers** (`app/frontend/looks/rooms.ts`, `app/frontend/watercolor/compose_*.ts`, `long_page.ts`, `estuary.ts`, `small_squares.ts`, `score.ts`, `mosaic.ts`, `lay.ts`, `sheet.tsx`, `by_look.tsx`, `shell.tsx`, `sound.tsx`, `app/frontend/sound/place.ts`):
   - `LookShell` and `ByLook` resolve lightweight room metadata (`roomLayoutOf`) without statically importing composer modules.
   - `PaintedSheet` passes `loadCompose(room)` into `laySheet`, which awaits the dynamic composer chunk in parallel with `Painter.ready()` and `document.fonts.ready` (`Promise.all([painter.ready(), faced, loaded])`) so shader compilation starts immediately with no extra waterfall.
   - `looks.ts` and `compose.ts` preserve all existing public exports.
2. **Split default `wide` article layout and local post pictures** (`app/frontend/art/pictures_shared.ts`, `pictures_local.ts`, `pictures_every.ts`, `watercolor/picture_core.ts`, `article_shared.ts`, `article_wide.ts`, `article_layouts.ts`):
   - Default `wide` article visits load only `article_wide.ts` and `pictures_local.ts` (16 local posts), leaving `book`/`around`/`river` and the 13 external `every-*` drawings out of article visits while preserving `art/pictures.ts` (`pictureOf`) and `watercolor/article.ts` exports.
3. **Dropped / reverted experiments**:
   - Stateful lazy-loading for the interactive `Pens` tray and `Score` audio player was dropped from this cut to keep the optimization strictly stateless and free of UI/audio lifecycle races.
   - Splitting `SquareBackground`'s `useEffect` canvas loop saved only 537 B gzip (-0.45%, below the 1% threshold) and was reverted.

## Result

Deterministic production client bundle sizes measured from `public/vite/.vite/manifest.json` (baseline `b3d7944` vs final, gzip level 9; every route clears the 1% relative threshold):

| Route / metric | Before (raw) | After (raw) | Delta (raw) | Before (gzip) | After (gzip) | Delta (gzip) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Entry only (`entrypoints/inertia.tsx`) | 418,202 B | 371,686 B | -46,516 B (-11.1%) | 138,519 B | 119,899 B | -18,620 B (-13.4%) |
| Home `/` initial (pre-hydration) | 432,538 B | 386,022 B | -46,516 B (-10.8%) | 144,301 B | 125,674 B | -18,627 B (-12.9%) |
| Home `/` total visit (incl. `long_page`) | 432,538 B | 397,713 B | -34,825 B (-8.1%) | 144,301 B | 132,024 B | -12,277 B (-8.5%) |
| Article `/posts/show` initial (pre-hydration) | 422,191 B | 375,675 B | -46,516 B (-11.0%) | 140,016 B | 121,398 B | -18,618 B (-13.3%) |
| Article `/posts/show` total visit (incl. `article_wide`) | 422,191 B | 405,202 B | -16,989 B (-4.0%) | 140,016 B | 135,457 B | -4,559 B (-3.3%) |
| Thoughts `/posts` total visit (incl. `score`) | 430,131 B | 417,698 B | -12,433 B (-2.9%) | 143,616 B | 141,015 B | -2,601 B (-1.8%) |
| About `/about` total visit (incl. `mosaic`) | 419,181 B | 380,405 B | -38,776 B (-9.3%) | 139,112 B | 124,771 B | -14,341 B (-10.3%) |
| Blocks `/?look=blocks` total visit | 432,538 B | 386,022 B | -46,516 B (-10.8%) | 144,301 B | 125,674 B | -18,627 B (-12.9%) |

## Verification

- **Checks and build**:
  - `npm run check`: passed (`tsc -p tsconfig.app.json && tsc -p tsconfig.node.json`)
  - `npm run test:frontend`: 44 files, 528 tests passed (0 failed)
  - `npm run build`: client and SSR production bundles built cleanly (`shell-*.js` reduced from 413,770 B / 136,443 B gzip to 367,254 B / 117,822 B gzip)

## Remaining cost

Of the 117.8 kB gzip remaining in `shell-*.js`, ~92 kB is third-party runtime (`react-dom`, `@inertiajs/core`, `@inertiajs/react`, `es-toolkit`, `laravel-precognition`, `scheduler`), ~12 kB is active watercolor runtime (`lay.ts`, `painter.ts`, `shader.ts`, kept eager so WebGL shader compilation begins immediately on mount), ~6 kB is the interactive `Pens` drawing tray (kept eager to avoid stateful lazy-load complexity), and ~7.8 kB is shell/sound/blocks code.
