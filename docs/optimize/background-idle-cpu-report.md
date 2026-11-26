# Square background idle CPU

Workload: home page and the longest article, production bundle, headless Chromium, 5 s window starting 18 s after load, CPU summed over the renderer, GPU and browser processes.

## Where the cost was

| Cost | Measured |
| --- | --- |
| Background, settled, one open page | about 125 to 324 CPU ms per second across 390x844 to 2560x1440, at 60 redraws per second |
| Production server, home / article | 1.70 / 1.49 ms per request (medians of 300), of which SSR 0.60 / 0.44 ms |
| Repositories per request | thoughts 6.7 us, GitHub 0.1 us (memoized in production) |
| Client JavaScript | 320 kB entry (101 kB gzip), mostly React and Inertia |

In the first 2,837 stepped frames of one run only 375 differed. Every redraw also re-runs the full-page noise filter.

## Change

The loop stops once easing no longer changes any square and restarts on hover, resize and canvas context restore. A square easing to exactly 0 only decays, and takes about 14,600 frames to underflow, so it counts as settled at 1e-18 (of 255).

## Result

Interleaved pairs, 5 per side, CPU ms per second, median (range):

| Case | Before | After |
| --- | --- | --- |
| Home 1440x900 (selection) | 191.3 (169.9 to 223.7) | 0.5 (-15.8 to 0.6) |
| Article 1920x1080 (holdout) | 202.1 (188.1 to 210.8) | 0.5 (0.3 to 1.1) |
| Article 1280x800, unseen seed (extra confirmation) | 172.1 (148.6 to 194.6) | 3.1 (0.4 to 3.4) |

The negative sample is a process-accounting artifact (a renderer exiting inside the window); it is kept in the samples. Single runs at 390x844, 1920x1080 and 2560x1440 fell from 136, 280 and 252 to below 1.

Keep threshold: 20% relative improvement on both selection and holdout. Load average on the 10-core machine was 8 to 19 around these pairs (it peaked higher earlier in the run). The cost of the opening animation, up to about 15 s at 60 Hz, is unchanged.

## Equivalence

- Canvas pixels compared at every one of 2,837 manually stepped frames (hover, hover after settling, resize, resize back): 0 differ on home 800x600, home 1440x900, article 1000x700 and home with reduced motion, across three random seeds. Screenshots with the noise filter match.
- 23.5 million easing steps compared after freezing a square at 1e-18: 0 differ bitwise.
- After a forced GPU process crash the settled background is repainted identically.
- Harness gates: background painted, and hover still animates after settling. Both reject the obvious shortcuts (nothing drawn, loop stopped for good).

## Experiments

1. Stop at the bitwise fixed point only: not kept. The holdout showed it never stops on the tall article page (target-0 squares).
2. The same with the 1e-18 cutoff: kept. The holdout had been seen once by then, hence the extra unseen seed and size.

Not covered: Safari and Firefox, battery power, displays above 60 Hz. No regressions were found. A first version of the harness measured stale assets; the validity probes caught it and the baseline was retaken.
