# Watercolor first-visit main-thread blocking

Workload: production browser bundle and server-rendered page snapshots served from a local static server with gzip, headless Chromium on ANGLE Metal (Apple M4). Each sample launches a fresh browser process and perturbs three fragment-shader noise constants by random digits so the shader cache misses, matching a reader's first visit. Window: 6.5 s from navigation. The harness is not in the repository and the numbers are one machine's.

## Where the cost was

- Initial transfer on the home page is about 361 kB compressed (HTML 35.9 kB, entry script 132.1 kB, CSS 13.0 kB, three Latin woff2 fonts 171.4 kB, page chunks 6.5 kB, logo 2.7 kB); the long article transfers about 352 kB. Sound modules and WASM stay unloaded until interaction.
- Once the opening animation finishes, idle work is zero frames over 5 s (1.5 to 13.3 ms renderer CPU across five profiled views).
- On a cold shader cache, `Painter` queried `COMPILE_STATUS` and `LINK_STATUS` synchronously inside its constructor during initial mount. Waiting on `gl.getProgramParameter` stalled the main thread for 107 to 232 ms on the home page and 142 to 188 ms on the long article, producing a single 145 to 283 ms long task on every first visit.

## Change

- `Painter` (`app/frontend/watercolor/painter.ts`) starts shader compilation and `gl.linkProgram()` in its constructor without reading `COMPILE_STATUS` or `LINK_STATUS`.
- `Painter.ready()` polls `KHR_parallel_shader_compile` (`COMPLETION_STATUS_KHR`) every 8 ms until linking finishes or the WebGL context is lost, then runs `finish()` to verify compile and link status and set up buffers, uniforms, and textures. Where `KHR_parallel_shader_compile` is unavailable, `ready()` calls `finish()` directly.
- `laySheet` (`app/frontend/watercolor/lay.ts`) waits for `Promise.all([painter.ready(), faced])` before calling `lay()` and observing resizes, cleans up via `leave()` if linking fails, and ignores early `frame()` and bare-paper `thrown()` clicks while no tiles exist. Context restore still runs `painter.setUp()`.
- Entry bundle size changed from 400,767 to 401,390 bytes uncompressed (+623 bytes).

## Result

Interleaved pairs, 10 per side in alternating `base`/`cand` order, primary metric `tbt_ms` (Total Blocking Time, sum of `max(0, duration - 50)` across `longtask` entries), median (range):

| Case | Metric | Before | After | Wins |
| --- | --- | --- | --- | --- |
| Home `/` 1440x900 @2x (selection) | TBT (ms) | 160 (95 to 233) | 0 (0 to 0) | 10/10 |
| Home `/` 1440x900 @2x (selection) | Longest task (ms) | 210 (145 to 283) | 0 (0 to 0) | 10/10 |
| Home `/` 1440x900 @2x (selection) | `getProgramParameter` wait (ms) | 163 (107 to 232) | 4 (3 to 5) | 10/10 |
| Home `/` 1440x900 @2x (selection) | Main-thread task time (ms) | 419 (331 to 528) | 255 (240 to 268) | 10/10 |
| Home `/` 1440x900 @2x (selection) | First draw (ms) | 374 (236 to 448) | 342 (299 to 411) | 8/10 |
| Home `/` 1440x900 @2x (selection) | FCP (ms) | 96 (56 to 124) | 84 (64 to 132) | 9/10 |
| Article `/creativity,/breathwork/2025/04/11/unlocking-ideas/` 1440x900 @2x (holdout) | TBT (ms) | 173 (149 to 195) | 0 (0 to 0) | 10/10 |
| Article `/creativity,/breathwork/2025/04/11/unlocking-ideas/` 1440x900 @2x (holdout) | Longest task (ms) | 223 (199 to 245) | 0 (0 to 0) | 10/10 |
| Article `/creativity,/breathwork/2025/04/11/unlocking-ideas/` 1440x900 @2x (holdout) | `getProgramParameter` wait (ms) | 163 (142 to 188) | 3 (3 to 5) | 10/10 |
| Article `/creativity,/breathwork/2025/04/11/unlocking-ideas/` 1440x900 @2x (holdout) | Main-thread task time (ms) | 405 (375 to 426) | 230 (203 to 244) | 10/10 |
| Article `/creativity,/breathwork/2025/04/11/unlocking-ideas/` 1440x900 @2x (holdout) | First draw (ms) | 369 (322 to 440) | 357 (270 to 422) | 7/10 |
| Article `/creativity,/breathwork/2025/04/11/unlocking-ideas/` 1440x900 @2x (holdout) | FCP (ms) | 88 (64 to 160) | 84 (60 to 100) | 7/10 |

All 40 confirmation runs passed both gates (`painted == 1`, `fresh_shader == 1`). Keep threshold: 20% relative reduction on both selection and holdout. An earlier 5-pair check on phone viewport (home `/` 390x844 @3x) also dropped TBT from 131 ms (112 to 158) to 0 ms (0 to 0), 5/5 wins, and main-thread task time from 349 ms (322 to 381) to 197 ms (185 to 204), 5/5 wins.

## Equivalence

- Finished tile canvas pixels were hashed (SHA-256) with deterministic virtual `requestAnimationFrame` stepping after the animation queue settled, scrolling through every tile across 16 cases / 182 tiles: five routes (`/`, `/posts`, `/about`, the long breathwork article, and a shorter code article) at 1440x900 @2x, 390x844 @3x, and 1024x768 @1x with reduced motion, plus board mode (`/` 1440x1700 @1x).
  - `base` against `base`: 0 of 182 tiles differ, 0 page errors.
  - `base` against this change: 0 of 182 tiles differ, 0 page errors.
  - `base` against a control changing one fragment-shader rim constant from `2.7` to `2.8`: 130 of 182 tiles differ, confirming the comparison detects pixel changes.
- Real-clock comparison runs earlier in the investigation differed even between two runs of `base` because the fixed wall-clock timeout caught different animation frames; switching the equivalence harness to deterministic rAF stepping removed that noise.
- Browser edge-case checks verified initial paint, Inertia navigation to `/posts`, shader link failure leaving the page plain with harmless clicks, WebGL2 unavailable, `KHR_parallel_shader_compile` unavailable, slow compilation with early clicks and scrolling, and `WEBGL_lose_context` at 0 ms (during compilation) and 1500 ms (after painting) followed by context restore.
- Unit tests in `app/frontend/watercolor/painter.test.ts` cover polling before completion, fallback without `KHR_parallel_shader_compile`, link failure, concurrent/repeated `ready()` calls, and context loss before linking finishes.

Not covered: Firefox and Safari/WebKit (browsers without `KHR_parallel_shader_compile` fall back to synchronous linking), warm-cache visits where linking is already fast, software WebGL renderers, and audio behavior (sound code is untouched).
