# Square background opening and hover CPU

Follows [background-idle-cpu-report.md](background-idle-cpu-report.md), which stopped the loop after the background settles. This run covers the animation itself.

Workload: production browser bundle, server-rendered page snapshots served from a local static server, headless Chromium 151 with GPU rasterization, 60 Hz. CPU is summed over the browser, renderer, GPU and network processes for 18 s, starting at the first paint (opening) or at a hover on a settled page (hover). The harness is not in the repository and the numbers are one machine's.

## Where the cost was

Easing takes about 900 frames, but a color's alpha is rounded to a whole step of 1/255 before it is drawn. After roughly 120 frames no square reaches a new step, so every later frame repainted the same pixels. Over 3,417 stepped frames with eight hovers and two resizes, main painted 2,877 and 589 differed from the one before (800x600, seed 1).

## Change

A frame repaints only when some square rounds to a new step. An opacity within 0.001 of halfway between two steps always counts as new, because the rounding there depends on float precision. Easing, its stop condition and the paint itself are unchanged, and a restored canvas context forces a repaint.

## Result

Interleaved pairs, 5 per side, CPU ms per 18 s window, median (range):

| Case | Before | After | Change |
| --- | --- | --- | --- |
| Opening, home 1440x900 (selection) | 2240.6 (2127.3 to 2274.3) | 543.0 (527.1 to 599.8) | -76% |
| Opening, article 1920x1080 (holdout) | 2757.0 (2488.3 to 2932.1) | 677.9 (597.7 to 682.6) | -75% |
| Opening, posts 1280x800, unseen seed | 2964.8 (2749.7 to 3247.9) | 623.1 (574.6 to 647.9) | -79% |
| Hover, home 1440x900 | 1948.4 (1768.0 to 2077.4) | 312.4 (301.0 to 317.4) | -84% |

Both sides stepped the same number of frames within 5 of each other. Keep threshold: 20% relative on selection and holdout. Load average on the 10-core machine was 6 to 150 around these samples, so the pairs alternated in order.

Without GPU rasterization this machine rendered about 5 frames per second on both sides (one pair, 18,608 and 18,304 CPU ms). The opening did not finish inside the window, so no gain is claimed for software rendering.

## Equivalence

- Canvas bytes hashed at each of 3,417 stepped frames, main against this change, with hovers, a hover after settling, a resize and a resize back: 0 frames differ in 24 cases. These are six cases (home 800x600, home 1440x900, article 1000x700, about 390x844, home with reduced motion, posts 1280x800) in Chromium 151 with CPU and GPU raster, Firefox 153 and WebKit 26.5, six seeds. The final screenshots match, including the noise filter.
- After a forced GPU process crash on a settled page, the canvas and screenshot are unchanged and one context-restore event repaints every square.
- Main against itself in WebKit: 0 differ in the five cases without posts. A candidate that rounds down instead of to nearest differs from frame 143, so the comparison can fail.

Two things went wrong on the way. The first version of the comparison did not reseed after a resize, and WebKit runs differed from the resize on; main drew a different number of frames in those runs than in other runs of the same seed. After that fix, one WebKit run of the article page, against experiment 2 below, still differed from frame 60 and matched again after the next resize. That run painted about 13,900 more squares than the matching repeats, which fits one extra page resize restarting the squares, but it did not record resizes. Every later run, including four repeats of that case, recorded the same resizes on both sides and differed nowhere.

## Experiments

1. Skip frames that cannot change a pixel: kept.
2. Also repaint only the changed squares: not kept. 559.8 (544.5 to 578.8, 3 samples) against 565.8 for experiment 1 in the same three rounds is no measurable difference.
3. Stop the loop early: not built. A square would stay short of its target, so a later hover would ease from another value than on main.

Not covered: battery power, displays above 60 Hz, real Safari, and an engine that clears a canvas without firing `contextrestored`. Such an engine would keep it blank from the last repaint until the next hover or resize. Before this change it repainted until about 900 frames in.
