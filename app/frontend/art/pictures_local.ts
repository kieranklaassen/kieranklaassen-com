import {
  bare,
  boat,
  bow,
  box,
  brush,
  butterfly,
  button,
  cloud,
  coin,
  crescent,
  day,
  drop,
  dusk,
  fill,
  found,
  gem,
  GOLD,
  half,
  heart,
  key,
  leaf,
  line,
  miniature,
  MOSS,
  mother,
  NAVY,
  nib,
  night,
  note,
  ORANGE,
  oval,
  perched,
  PLUM,
  puffs,
  quad,
  ray,
  RED,
  RUST,
  SAGE,
  scissors,
  SEA,
  sea,
  songbird,
  spool,
  sprout,
  stone,
  STRAW,
  tree,
  waves,
  wing,
  type Picture,
  type Pigment,
} from './pictures_shared'

export const LOCAL_PICTURES: Record<string, () => Picture> = {
  // A key, and the tokens that fall from it.
  'automatically-add-tokens-to-active-record-models': () => ({
    ground: day(0.25),
    shapes: [
      ...key(34, 38, 15, NAVY, SEA),
      ...coin(30, 78, 10, GOLD), ...coin(57, 86, 7, ORANGE), ...coin(82, 74, 11, RUST), ...coin(108, 88, 6.5, GOLD), ...coin(131, 77, 10, ORANGE),
      fill(oval(146, 16, 4.5), RED), ...coin(122, 18, 5, STRAW),
    ],
    details: [[...key(9, 18, 6.5, NAVY, SEA)], [...coin(14, 14, 9, GOLD), ...coin(28, 27, 7, RUST)], [...coin(20, 20, 13, ORANGE)], [...coin(10, 28, 6, RUST), ...coin(22, 18, 6, GOLD), ...coin(33, 9, 5, ORANGE)]],
  }),
  // A house laid of blocks, its window a heart.
  'building-software-we-love': () => ({
    ground: day(0.8),
    shapes: [
      fill(oval(126, 24, 13), GOLD, ORANGE),
      fill(quad(40, 46, 79, 12, 79, 46), RED, RUST), fill(quad(81, 12, 120, 46, 81, 46), PLUM, RED),
      fill(box(48, 48, 22, 20), ORANGE), fill(box(72, 48, 17, 20), RUST), fill(box(91, 48, 21, 20), GOLD),
      fill(box(48, 70, 15, 22), SEA), fill(box(65, 70, 15, 22), NAVY), fill(box(82, 70, 30, 22), MOSS),
      fill(heart(80, 35, 6.5), STRAW, GOLD),
      fill(quad(6, 94, 154, 92, 154, 98, 6, 99), SAGE),
      ...sprout(24, 92, 26), ...sprout(136, 92, 34, [0.36, 0.1]), fill(box(102, 13, 7, 14), NAVY),
    ],
    details: [[fill(heart(20, 18, 11), RED, ORANGE)], [fill(quad(6, 20, 20, 6, 34, 20), RED), fill(box(9, 22, 10, 12), ORANGE), fill(box(21, 22, 10, 12), SEA)], [...sprout(20, 36, 28)], [fill(box(6, 8, 13, 11), GOLD), fill(box(21, 8, 13, 11), RUST), fill(box(6, 21, 8, 12), SEA), fill(box(16, 21, 18, 12), MOSS)]],
  }),
  // A net, and what flies in front of it.
  'capturing-flow': () => ({
    ground: day(0.35),
    shapes: [
      fill('M0 88C24 74 44 82 66 76S120 62 160 72L160 100L0 100Z', MOSS, SAGE, 0.9),
      fill('M0 96C30 86 60 92 92 88S140 82 160 86L160 100L0 100Z', SEA, MOSS),
      brush(line(50, 97, 64, 72, 76, 44), 3, PLUM),
      fill('M78 13C56 12 40 20 26 34C40 42 62 42 78 43Z', [0.8, 0.1], SAGE, 0.8),
      brush(oval(79, 28, 9, 16), 2.6, RED),
      ...[0, 1, 2].map((i) => brush(line(74, 18 + i * 9, 54, 20 + i * 8, 32 + i * 2, 32 + i * 2), 0.8, SEA)), ...[0, 1].map((i) => brush(line(64 - i * 14, 15 + i * 5, 61 - i * 14, 28 + i * 2, 63 - i * 14, 42 - i), 0.8, SEA)),
      ...butterfly(122, 26, 15, ORANGE, RED), ...butterfly(146, 52, 8, GOLD, RUST), ...butterfly(102, 12, 6, SEA, NAVY),
      fill(oval(16, 16, 9), GOLD, STRAW),
    ],
    details: [[...butterfly(20, 20, 13, ORANGE, RED)], [...[7, 12, 17].map((r, i) => brush(bow(6, 20, r, -0.8, 0.8), 2, [SEA, MOSS, GOLD][i]))], [...butterfly(12, 26, 8, GOLD, RUST), ...butterfly(28, 12, 6, SEA, NAVY)], [fill(leaf(4, 34, 40, 12, -0.8), MOSS, GOLD), brush(line(4, 34, 30, 8), 0.9, NAVY)]],
  }),
  // The sun comes up, and every ray is another thing to do.
  enthusiasm: () => ({
    ground: dusk,
    shapes: [
      ...Array.from({ length: 13 }, (_, i) => {
        const a = Math.PI + 0.14 + (i / 12) * (Math.PI - 0.28)
        return fill(ray(80, 76, 34, 50 + 22 * Math.abs(Math.sin(i * 2.3)), a, 2.2 + 1.6 * Math.abs(Math.sin(i * 1.7))), [RED, GOLD, RUST, ORANGE, PLUM, SEA][i % 6])
      }),
      fill(half(80, 76, 29), ORANGE, GOLD), fill(half(80, 76, 17), RED, ORANGE),
      fill('M0 78L160 77L160 86L0 87Z', SEA, MOSS), fill('M0 89L160 87L160 100L0 100Z', NAVY, SEA),
      ...puffs(5, 14, 6, 6, 148, 50, [RED, GOLD, SEA, RUST], 0.8, 2.6),
    ],
    details: [[fill(half(20, 26, 10), ORANGE), ...Array.from({ length: 7 }, (_, i) => fill(ray(20, 26, 12.5, 18, Math.PI + 0.2 + i * 0.45, 1.3), [RED, GOLD, RUST][i % 3]))], [...Array.from({ length: 9 }, (_, i) => fill(ray(20, 20, 5, 14, i * 0.7, 2), [RED, GOLD, ORANGE][i % 3]))], [...puffs(9, 9, 6, 6, 28, 28, [RED, GOLD, SEA, RUST], 1.5, 4.5)], [...Array.from({ length: 5 }, (_, i) => fill(leaf(20, 34, 26, 5, -2.5 + i * 0.5), [RED, ORANGE, GOLD, ORANGE, RUST][i]))]],
  }),
  // Rain through a sieve: it goes in as noise and comes out as waves.
  'filtering-noise-with-supercollider': () => ({
    ground: (u, v) => [0.95 - 0.25 * v, 0.2 + 0.25 * Math.sin(u * 5)],
    shapes: [
      ...puffs(21, 74, 8, 3, 144, 34, [NAVY, SEA, MOSS, PLUM, RUST, GOLD], 0.6, 2.8),
      ...Array.from({ length: 12 }, (_, i) => fill(box(10 + i * 11.8, 44 + Math.sin(i) * 0.8, 8.8, 5), i % 4 === 1 ? RED : NAVY)),
      ...[20, 43, 67, 91, 115, 138].map((x, i) => fill(drop(x, 58 + (i % 2) * 5, 2.6), SEA)),
      fill(waves(0, 72, 160, 10, 4, 12), SAGE, MOSS, 0.8), fill(waves(0, 80, 160, 12, 4, 10), SEA, MOSS, 0.9), fill(waves(0, 89, 160, 11, 4, 8), NAVY, SEA),
    ],
    details: [[...puffs(3, 22, 4, 4, 32, 32, [NAVY, SEA, RUST, GOLD], 0.7, 2.8)], [fill(drop(20, 23, 9), SEA, NAVY)], [fill(waves(2, 14, 36, 7, 3, 8), SEA), fill(waves(2, 24, 36, 8, 3, 7), NAVY)], [fill(drop(10, 14, 4), SEA), fill(drop(22, 25, 5), NAVY), fill(drop(32, 12, 3.5), MOSS)]],
  }),
  // The day in boxes, and the bird that leaves by the one left open.
  'finding-freedom-in-structure': () => ({
    ground: day(0.5),
    shapes: [
      ...Array.from({ length: 15 }, (_, i) => {
        const c = i % 5
        const r = Math.floor(i / 5)
        return i === 4 || i === 9 ? [] : [fill(box(10 + c * 21, 12 + r * 27, 17, 22), ([NAVY, SEA, MOSS, SAGE, SEA] as Pigment[])[(i * 7) % 5], undefined, 0.9)]
      }).flat(),
      brush(box(95, 13, 15, 21), 1.6, NAVY), brush(box(95, 40, 15, 21), 1.6, NAVY),
      fill(quad(112, 40, 122, 44, 122, 68, 112, 62), SEA, SAGE),
      fill(wing(130, 30, 22, -0.35), RED, ORANGE), fill(wing(150, 58, 7, -0.2), GOLD, RUST),
    ],
    details: [[fill(wing(20, 24, 15, -0.3), RED, ORANGE)], [brush(box(7, 7, 11, 11), 1.8, NAVY), fill(box(22, 7, 11, 11), SEA), fill(box(7, 22, 11, 11), MOSS), brush(box(22, 22, 11, 11), 1.8, NAVY)], [fill(wing(12, 28, 8, -0.3), GOLD, RUST), fill(wing(28, 14, 7, -0.5), RED, RUST)], [fill(leaf(6, 32, 34, 7, -0.75), RED, ORANGE), brush(line(4, 34, 30, 9), 0.9, PLUM)]],
  }),
  // A nib in the ground. What is written takes root.
  'grounding-ideas-in-writing': () => ({
    ground: (u, v) => (v < 0.56 ? [0.98, 0.7 - 0.3 * u] : [0.82 - 0.2 * v, 0.9 - 0.2 * u]),
    shapes: [
      cloud(32, 24, 9, [0.72, 0.05]), cloud(128, 18, 7, [0.78, 0.05]),
      fill('M0 57C30 54 60 58 80 56S130 54 160 57L160 64L0 64Z', RUST, PLUM, 0.9),
      ...nib(80, 60, 22),
      ...[[-1, 34, 10], [-1, 22, 24], [1, 36, 12], [1, 20, 26], [-1, 8, 34], [1, 7, 30]].map(([way, w, h]) => brush(line(80, 60, 80 + way * w * 0.3, 60 + h * 0.6, 80 + way * w, 64 + h * 0.8, 80 + way * (w + 10), 62 + h), 1.6, PLUM, RUST)),
      ...sprout(48, 57, 22), ...sprout(112, 57, 28, [0.4, 0.15]), ...sprout(140, 57, 16), ...sprout(22, 57, 15, [0.38, 0.1]),
      ...puffs(8, 9, 10, 70, 140, 26, [GOLD, PLUM, RUST], 1, 2.6),
    ],
    details: [[...nib(20, 36, 14.5)], [...sprout(20, 36, 28)], [cloud(22, 18, 8, [0.6, 0.05]), fill(drop(13, 29, 2), SEA), fill(drop(21, 33, 2), SEA), fill(drop(29, 28, 2), SEA)], [...[[-1, 12, 22], [1, 13, 24], [-1, 4, 30], [1, 3, 22]].map(([way, w, h]) => brush(line(20, 4, 20 + way * w * 0.4, 4 + h * 0.6, 20 + way * w, 4 + h), 1.7, PLUM, RUST))]],
  }),
  // A tree by the water. Its reflection is made of squares.
  'how-ai-reflects-my-brain': () => ({
    ground: sea(0.52),
    shapes: [
      ...tree(80, 52, 40, PLUM),
      fill(stone(80, 20, 17, 14, 1.2), ORANGE, GOLD, 0.9), fill(stone(60, 26, 14, 11, 2), RUST, ORANGE, 0.9), fill(stone(101, 24, 15, 12, 1.6), RED, ORANGE, 0.9), fill(stone(91, 12, 11, 9, 2.4), GOLD, STRAW, 0.9), fill(stone(68, 13, 10, 8, 1), RED, RUST, 0.9),
      fill('M0 51L160 50L160 53.500L0 54.500Z', NAVY, SEA),
      ...Array.from({ length: 5 }, (_, i) => fill(box(78 + (i % 2) * 1.2, 56 + i * 5, 4.6, 4.2), NAVY)),
      ...Array.from({ length: 44 }, (_, i) => {
        const a = i * 2.399
        const r = 3.5 * Math.sqrt(i)
        return fill(box(Math.round((80 + r * 1.2 * Math.cos(a)) / 6) * 6 - 2.6, Math.round((82 + r * 0.62 * Math.sin(a)) / 5.4) * 5.4 - 2.4, 5.1, 4.6), [SEA, NAVY, MOSS, SAGE, SEA, RUST][i % 6], undefined, 0.62)
      }),
    ],
    details: [[...tree(20, 37, 24, PLUM), fill(stone(20, 13, 12, 9, 1.4), ORANGE, GOLD)], [...Array.from({ length: 12 }, (_, i) => fill(box(6 + (i % 4) * 7.2, 9 + Math.floor(i / 4) * 7.6, 6, 6.4), [SEA, NAVY, MOSS, SAGE][(i * 5) % 4]))], [fill(leaf(8, 32, 32, 9, -0.75), RED, GOLD)], [fill(stone(14, 22, 9, 8, 1.2), ORANGE), fill(box(24, 10, 6, 6), SEA), fill(box(24, 18, 6, 6), NAVY), fill(box(24, 26, 6, 6), MOSS)]],
  }),
  // What was cut.
  'i-wrote-a-gem-it-runs-instance-methods-in-a-job': () => ({
    ground: (u, v) => [0.97 - 0.1 * v, 0.2 + 0.3 * Math.sin(u * 4 + 1)],
    shapes: [
      ...gem(80, 48, 44),
      ...gem(22, 74, 11), ...gem(140, 26, 9),
      ...[[124, 70, 8], [38, 22, 9], [146, 84, 5], [16, 40, 5]].map(([x, y, s]) => fill(`M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`, GOLD, ORANGE)),
      brush(line(20, 96, 80, 93, 146, 95), 1.4, SEA),
    ],
    details: [[...gem(20, 19, 17)], [fill('M20 4Q20 20 36 20Q20 20 20 36Q20 20 4 20Q20 20 20 4Z', GOLD, ORANGE)], [...gem(12, 25, 9), ...gem(29, 13, 7)], [fill(quad(4, 18, 18, 6, 16, 22), RED), fill(quad(20, 6, 36, 16, 19, 22), RUST), fill(quad(17, 25, 34, 20, 22, 36), PLUM), fill(quad(5, 21, 14, 25, 18, 35), ORANGE)]],
  }),
  // It is very large, and it is only a bird too.
  'silencing-your-inner-critic': () => ({
    ground: night,
    shapes: [
      bare(fill(oval(56, 44, 39), STRAW, GOLD, 0.95)),
      ...mother(56, 52, 43),
      brush(line(0, 72, 60, 76, 110, 74, 160, 70), 1.6, PLUM),
      ...songbird(124, 65, 12, GOLD),
      ...note(106, 40, 2.6, RED), ...note(119, 27, 2.2, ORANGE), ...note(136, 36, 2.9, RUST), ...note(148, 17, 2.1, GOLD),
      fill(oval(81.500, 26, 1.6), STRAW, STRAW, 0.4),
    ],
    details: [[...songbird(20, 18, 15, GOLD)], [...note(12, 30, 3.2, RED), ...note(26, 24, 2.8, ORANGE)], [fill(perched(20, 22, 18), NAVY)], [fill(leaf(6, 34, 38, 6, -0.85), NAVY, SEA), brush(line(4, 36, 30, 7), 0.8, PLUM)]],
  }),
  // A net, and in every window another miniature.
  'systems-structure-and-creative-freedom': () => ({
    ground: day(0.7),
    shapes: Array.from({ length: 15 }, (_, i) => {
      const inks: Pigment[] = [RED, SEA, ORANGE, NAVY, GOLD, MOSS, PLUM, RUST]
      return miniature((i * 4 + 3) % 9, 17 + (i % 5) * 31.5 + (i === 7 ? 5 : 0), 18 + Math.floor(i / 5) * 32 + (i === 7 ? -6 : 0), i === 7 ? 44 : 27, inks[(i * 3) % 8], inks[(i * 3 + 4) % 8])
    }).flat(),
    details: [0, 5, 1, 6].map((kind, i) => miniature(kind, 20, 20, 36, [RED, SEA, NAVY, ORANGE][i], [GOLD, ORANGE, RUST, SEA][i])),
  }),
  // Five boats and one wind.
  'the-importance-of-team-alignment-in-teams': () => ({
    ground: sea(0.5),
    shapes: [
      fill(oval(134, 20, 11), ORANGE, GOLD),
      ...boat(24, 60, 13, GOLD, STRAW, PLUM), ...boat(52, 54, 11, ORANGE, GOLD, RED), ...boat(82, 62, 15, RED, RUST, NAVY), ...boat(112, 54, 11, RUST, ORANGE, PLUM), ...boat(140, 61, 13, SEA, SAGE, RED),
      fill(waves(0, 70, 160, 10, 6, 6), MOSS, SAGE, 0.8), fill(waves(0, 79, 160, 10, 5, 7), SEA, MOSS, 0.9), fill(waves(0, 89, 160, 11, 6, 6), NAVY, SEA),
      fill(wing(40, 18, 8, -0.1), NAVY), fill(wing(60, 10, 6, -0.2), NAVY), fill(wing(26, 9, 5, 0), NAVY),
    ],
    details: [[...boat(18, 27, 12, RED, RUST, NAVY)], [fill(waves(2, 14, 36, 6, 3, 6), SEA), fill(waves(2, 23, 36, 8, 4, 6), NAVY)], [...boat(10, 30, 7, GOLD, STRAW, PLUM), ...boat(27, 22, 7, ORANGE, GOLD, RED)], [fill(wing(12, 12, 8, 0), NAVY), fill(wing(27, 24, 7, -0.3), SEA)]],
  }),
  // Stone upon stone, and one leaf more than yesterday.
  'the-joy-of-micro-improvement': () => ({
    ground: day(0.4),
    shapes: [
      fill(oval(132, 22, 10), GOLD, STRAW),
      fill('M0 84C40 76 110 86 160 79L160 100L0 100Z', SAGE, MOSS, 0.9),
      fill(stone(80, 82, 30, 9.500, 1.1), NAVY, SEA), fill(stone(77, 66, 22, 7.5, 1.7), RUST, ORANGE), fill(stone(82, 53, 16, 6.2, 2.1), SEA, MOSS), fill(stone(79, 42.5, 11, 4.8, 1.3), GOLD, ORANGE), fill(stone(81, 34.5, 7, 3.6, 2.6), PLUM, RED),
      ...sprout(80, 31, 21),
      ...[14, 27, 38, 47].map((x, i) => sprout(x, 86 - i, 22 - i * 4.6, [0.4 + i * 0.04, 0.12])).flat(),
      fill(stone(118, 88, 9, 4, 1.9), MOSS), fill(stone(138, 90, 6, 3, 1.2), RUST),
    ],
    details: [[fill(stone(20, 33, 14, 4.6, 1.1), NAVY), fill(stone(19, 25, 10, 3.8, 1.7), RUST), fill(stone(21, 18.5, 7, 3, 2.1), SEA), ...sprout(20, 15, 12)], [...sprout(20, 36, 30)], [...[8, 18, 30].map((x, i) => sprout(x, 34, 10 + i * 8)).flat()], [fill(stone(13, 24, 9, 6, 1.2), RUST), fill(stone(29, 19, 7, 5, 1.8), SEA)]],
  }),
  // Cut to measure.
  'tool-tailor': () => ({
    ground: day(0.55),
    shapes: [
      fill(quad(6, 62, 60, 56, 96, 66, 154, 58, 154, 98, 6, 98), [0.8, 0.95], [0.7, 0.9], 0.6),
      ...scissors(34, 34, 18),
      brush(line(128, 34, 150, 44, 138, 60, 108, 62, 92, 76, 112, 88, 146, 82), 1.3, RED),
      ...spool(128, 24, 13, RED),
      brush(line(140, 88, 152, 72), 1.7, NAVY),
      ...button(22, 80, 9, SEA), ...button(46, 76, 7, GOLD), ...button(66, 84, 8.5, RUST),
      ...Array.from({ length: 9 }, (_, i) => fill(box(8 + i * 10, 64 + Math.sin(i * 0.9) * 1.5, 5.6, 1.3), NAVY)),
    ],
    details: [[...scissors(14, 20, 8.5)], [...button(20, 20, 14, SEA)], [...spool(20, 20, 13, RED)], [...button(13, 14, 8, GOLD), ...button(28, 25, 7, RUST)]],
  }),
  // Breath: two lungs of leaves, and what they open.
  'unlocking-ideas': () => ({
    ground: dusk,
    shapes: [
      fill(oval(80, 25, 10), GOLD, ORANGE),
      ...[15, 20, 25].map((r, i) => brush(bow(80, 25, r, Math.PI * 1.06, Math.PI * 1.94), 1.5, [ORANGE, GOLD, RUST][i])),
      brush(line(80, 40, 79, 60, 81, 98), 2.2, PLUM),
      ...[1, -1].flatMap((way) =>
        [[48, -0.8, 30, 7], [55, -0.42, 44, 9.5], [63, -0.1, 52, 10], [72, 0.16, 50, 10], [80, 0.36, 40, 8.5], [88, 0.55, 26, 6.500]].map(([y, angle, long, wide], i) =>
          fill(leaf(80 + way * 2, y, long, wide, way > 0 ? angle : Math.PI - angle), ([SAGE, MOSS, SEA, MOSS, [0.16, 0.2], SEA] as Pigment[])[(i + (way > 0 ? 0 : 1)) % 6], undefined, 0.95),
        ),
      ),
      ...key(12, 22, 5.5, RED, RUST), ...puffs(17, 9, 118, 8, 34, 26, [GOLD, RED, ORANGE], 1, 2.4),
    ],
    details: [[...[-2.3, -1.95, -1.57, -1.2, -0.85].map((a, i) => fill(leaf(20, 37, 30, 5.5, a), [SAGE, MOSS, SEA, MOSS, [0.16, 0.2] as Pigment][i]))], [...[6, 11, 16].map((r, i) => brush(oval(20, 20, r), 1.7, [RED, ORANGE, GOLD][i]))], [...key(10, 18, 6, RED, RUST)], [fill(leaf(5, 34, 40, 11, -0.82), SEA, SAGE), brush(line(5, 34, 31, 7), 0.9, NAVY)]],
  }),
  // The sea by night, and three notes for the three tracks.
  'whispers-of-silece-ep': () => ({
    ground: (u, v) => (v < 0.6 ? [0.4 + 0.75 * v + 0.06 * Math.sin(u * 6), 0.02 + 1.5 * v * v] : [0.7 - 0.2 * v, 0.08]),
    shapes: [
      bare(fill(crescent(112, 27, 19, -0.5), GOLD, ORANGE)),
      fill(waves(0, 64, 160, 10, 3, 5), SEA, MOSS, 0.75), fill(waves(0, 73, 160, 12, 4, 6), NAVY, SEA, 0.85), fill(waves(0, 85, 160, 15, 3, 6), [0.02, 0.2], SEA),
      ...[0, 1, 2, 3, 4].map((i) => fill(leaf(97 - i * 2.5, 68 + i * 6.4, 20 + i * 5, 1.5, 0.02), STRAW, GOLD, 0.8)),
      ...note(30, 52, 4.4, PLUM), ...note(51, 44, 4.4, RED), ...note(72, 50, 4.4, RUST),
      ...puffs(33, 15, 4, 3, 152, 32, [STRAW, GOLD], 0.5, 1.2),
    ],
    details: [[fill(crescent(19, 20, 14, -0.5), GOLD, STRAW)], [...note(10, 30, 3.4, ORANGE), ...note(20, 25, 3.4, RED), ...note(31, 28, 3.4, RUST)], [fill(waves(2, 15, 36, 7, 2, 7), SEA), fill(waves(2, 25, 36, 8, 2, 7), NAVY)], [...note(19, 29, 5, RED)]],
  }),
}

export const localPictureOf = (slug: string): Picture => LOCAL_PICTURES[slug]?.() ?? found(slug)
