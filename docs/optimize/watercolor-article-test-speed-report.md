# Watercolor article test speed

Workload: `npx vitest run app/frontend/watercolor/article.test.ts` (selection, 6 tests) and `npm run test:frontend` (holdout, 302 tests across the full frontend suite). The harness scripts live outside the repository and the timings are one machine's.

## Where the cost was

In CI (run 46124261285, PR #93) and under local machine load, `app/frontend/watercolor/article.test.ts` breached Vitest's 5,000 ms per-test timeout (`around` reached 5,605 ms in CI; `book` reached 5,775 ms locally).

A V8 CPU profile of the baseline file (4,436.9 ms total, 3,299.3 ms inside the 6 tests) attributed 90.1% of test CPU time to test-harness overhead rather than the production watercolor code:

| Stage | Baseline CPU | Share of test CPU | Final CPU |
| --- | --- | --- | --- |
| `expect(a).toEqual(b)` / `expectSameComposition` | 2,531.4 ms | 76.7% | 10.5 ms |
| `stubCanvasAndRanges` (`getImageData` + `rasterize`) | 279.5 ms | 8.5% | 11.9 ms |
| `expectValidWashes` | 161.7 ms | 4.9% | < 1.0 ms |
| `mask.ts` (`distances`/`transform`, `Cutter.cut`, `Cutter.sheet`) | 195.2 ms | 5.9% | 199.6 ms |
| `letters.ts` (`lettersOf`) | 56.7 ms | 1.7% | 52.4 ms |
| `picture.ts` | 15.9 ms | 0.5% | 10.9 ms |

- Vitest's `expect(a).toEqual(b)` deep-compared each `Composition`'s multi-megabyte `mask.field` `Uint8Array` via `iterableEquality`, `Object.keys`, and per-element recursive `eq`, spending 2,531.4 ms in `@vitest/expect` and GC.
- `stubCanvasAndRanges` read `canvas.width` inside the inner pixel loops of `rasterize` and `getImageData`. In jsdom, `canvas.width` runs a WebIDL type check and `parseInteger` on every pixel read.
- `expectValidWashes` ran roughly 26 Chai `expect()` calls per wash across hundreds of washes per test.

## Change

All changes stay inside `app/frontend/watercolor/article.test.ts`; no production modules changed.

- Added `expectSameComposition` and `expectSameBytes` to compare `Composition` objects. Non-mask fields (`washes`, `paper`, `course`) and non-field `mask` metadata (`width`, `height`) still use `expect(...).toEqual(...)`; `mask.field` checks `Uint8Array` type, exact length, and every byte via a 32-bit word fast path that reports the exact byte index on any mismatch.
- Updated `stubCanvasAndRanges` to read `canvas.width` and `canvas.height` once per call instead of per pixel, store a 1-byte alpha `Uint8Array` instead of a 4-byte RGBA buffer, and fill rasterized rows with `TypedArray.fill`.
- Updated `expectValidWashes` to check every wash and RGB channel invariant in plain JavaScript first and invoke the existing `expect(...)` assertions with the wash index when any invariant fails.

## Result

Interleaved pairs between baseline `f774f33f` and final `94df00e9`, median (range), keep threshold 15% relative reduction on required objectives:

| Workload | Metric | Before | After | Change | Wins |
| --- | --- | --- | --- | --- | --- |
| `article.test.ts` (selection, 5 pairs) | `test_ms` (sum of 6 tests) | 3,749.38 ms (3,546.38 to 8,102.84) | 310.95 ms (291.86 to 1,794.87) | -91.7% | 5/5 |
| `article.test.ts` (selection, 5 pairs) | `max_test_ms` (slowest test) | 1,294.35 ms (1,234.49 to 4,152.06) | 81.92 ms (74.39 to 454.01) | -93.7% | 5/5 |
| `article.test.ts` (selection, 5 pairs) | `wall_ms` (end-to-end) | 4,662.73 ms (4,606.03 to 10,503.44) | 1,273.19 ms (1,163.88 to 3,708.33) | -72.7% | 5/5 |
| `npm run test:frontend` (holdout, 3 pairs) | `article.test.ts` `test_ms` | 4,072.97 ms (4,021.86 to 4,095.31) | 962.76 ms (582.18 to 1,168.21) | -76.4% | 3/3 |
| `npm run test:frontend` (holdout, 3 pairs) | `article.test.ts` `max_test_ms` | 1,258.11 ms (1,212.16 to 1,288.06) | 231.86 ms (172.27 to 349.57) | -81.6% | 3/3 |
| `npm run test:frontend` (holdout, 3 pairs) | Full suite `wall_ms` (302 tests) | 5,536.92 ms (5,408.00 to 5,665.36) | 3,007.83 ms (2,600.37 to 3,182.59) | -45.7% | 3/3 |

All 6 tests in `article.test.ts` and all 302 tests in `npm run test:frontend` pass with zero regressions (`npm run check` passes).

## Remaining opportunity

The final V8 profile shows 317.3 ms of CPU inside `article.test.ts`, mostly in production `mask.ts` (`distances`/`transform` 139.9 ms, `Cutter.cut` 54.8 ms, `Cutter.sheet` 4.9 ms) and `letters.ts` (52.4 ms). Both declared targets (`test_ms <= 500 ms` and `max_test_ms <= 250 ms`) are met without editing production code, so further changes to `mask.ts` are not warranted.

## Experiments

1. Replace deep `toEqual` on `mask.field` with `expectSameComposition` / `expectSameBytes`: kept (`test_ms` 3,982.39 -> 780.81 ms, -80.4%, 5/5 selection wins; holdout 3/3 wins, where baseline timed out on pair 1 at 6,474 ms and candidate passed at 1,305 ms).
2. Optimize `stubCanvasAndRanges` alone: inconclusive on 5 selection pairs (4/5 wins on `test_ms`, 3/3 holdout wins at -40.2% `test_ms`, masked by one host load spike on pair 5).
3. Combine `stubCanvasAndRanges` optimization and `expectValidWashes` plain-JS fast path: kept (`test_ms` 723.37 -> 307.04 ms vs experiment 1, -57.6%, 5/5 selection wins; holdout 3/3 wins on `test_ms` and `max_test_ms`; both targets met).
