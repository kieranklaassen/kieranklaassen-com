import {
  boat,
  box,
  brush,
  cloud,
  day,
  dusk,
  fill,
  GOLD,
  half,
  leaf,
  line,
  miniature,
  MOSS,
  NAVY,
  note,
  ORANGE,
  oval,
  perched,
  PLUM,
  puffs,
  quad,
  RED,
  RUST,
  SAGE,
  SEA,
  sea,
  songbird,
  sprout,
  stone,
  STRAW,
  waves,
  wing,
  type Picture,
  type Pigment,
} from './pictures_shared'

export const EVERY_PICTURES: Record<string, () => Picture> = {
  // Looked at until it shines.
  'every-how-i-polish-software-that-agents-built': () => ({
    ground: day(0.3),
    shapes: [
      fill(oval(80, 56, 35, 31), SEA, NAVY), fill(leaf(58, 48, 30, 6, -0.75), STRAW, STRAW, 0.5),
      ...[[122, 24, 13], [36, 28, 9], [134, 66, 7], [28, 70, 6]].map(([x, y, s]) => fill(`M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`, ORANGE, RED)),
      fill('M96 84C112 66 128 74 146 86C134 98 106 98 96 84Z', RED, RUST, 0.85), fill('M14 92C50 86 110 90 148 94L148 98L14 98Z', MOSS, SAGE),
    ],
    details: [miniature(7, 20, 20, 36, SEA, STRAW)],
  }),
  // Eight steps where there were four.
  'every-compound-engineering-gets-an-upgrade': () => ({
    ground: day(0.6),
    shapes: [...Array.from({ length: 8 }, (_, i) => fill(box(10 + i * 15.6, 84 - i * 8.6, 13.4, 12 + i * 8.6), [NAVY, SEA, MOSS, SEA, GOLD, ORANGE, RUST, RED][i] as Pigment)), ...sprout(128, 22, 20), fill(oval(28, 26, 11), GOLD, ORANGE)],
    details: [[...sprout(20, 36, 28)]],
  }),
  // A folder, and who lives in it.
  'every-the-folder-is-the-agent': () => ({
    ground: day(0.75),
    shapes: [fill(perched(84, 34, 27), SEA, NAVY), fill(quad(26, 40, 58, 40, 66, 48, 134, 48, 134, 52, 26, 52), RUST, RED), fill(quad(20, 54, 140, 54, 132, 94, 28, 94), ORANGE, GOLD), fill(oval(96.5, 15, 1.7), STRAW), ...puffs(4, 7, 118, 6, 34, 26, [RED, SEA, GOLD], 1, 2.6)],
    details: [[fill(perched(20, 22, 18), SEA)]],
  }),
  // Thirteen eyes.
  'every-i-stopped-reading-code-my-code-reviews-got-better': () => ({
    ground: day(0.25),
    shapes: Array.from({ length: 13 }, (_, i) => {
      const x = i < 4 ? 26 + i * 36 : i < 9 ? 14 + (i - 4) * 33 : 26 + (i - 9) * 36
      const y = i < 4 ? 20 : i < 9 ? 50 : 80
      const ink = [SEA, NAVY, MOSS, RUST, SEA, MOSS, RED, NAVY, SEA, ORANGE, NAVY, MOSS, SEA][i] as Pigment
      return [fill(`M${x - 14} ${y}Q${x} ${y - 13} ${x + 14} ${y}Q${x} ${y + 13} ${x - 14} ${y}Z`, [0.84, ink[1]], SAGE, 0.8), fill(oval(x + (i % 3) * 2 - 2, y, 6), ink), fill(oval(x + (i % 3) * 2 - 2, y, 2.4), NAVY)]
    }).flat(),
    details: [miniature(0, 20, 20, 36, SEA, NAVY)],
  }),
  // It grows on what grew.
  'every-compound-engineering': () => ({
    ground: day(0.5),
    shapes: [fill('M0 84C40 80 110 86 160 81L160 100L0 100Z', RUST, PLUM, 0.9), ...sprout(22, 84, 18), ...sprout(54, 84, 32, [0.42, 0.12]), ...sprout(92, 84, 50, [0.38, 0.1]), ...sprout(128, 84, 60, [0.3, 0.08]), fill(oval(34, 24, 12), GOLD, ORANGE)],
    details: [[...sprout(20, 36, 28)]],
  }),
  // An opus: five lines and what stands on them.
  'every-vibe-check-opus-4-5': () => ({
    ground: day(0.8),
    shapes: [...Array.from({ length: 5 }, (_, i) => brush(line(8, 34 + i * 10, 70, 31 + i * 10.4, 152, 35 + i * 10), 1.2, NAVY)), ...note(30, 74, 6, RED), ...note(56, 64, 6, SEA), ...note(82, 54, 6, ORANGE), ...note(108, 59, 6, PLUM), ...note(134, 44, 6, RUST)],
    details: [[...note(18, 30, 5, RED)]],
  }),
  // The large one shows the small one how.
  'every-teach-your-ai-to-think-like-a-senior-engineer': () => ({
    ground: dusk,
    shapes: [brush(line(4, 78, 60, 81, 110, 78, 156, 80), 2.4, PLUM), fill(perched(56, 58, 33), NAVY, SEA), fill(oval(71.5, 34, 2), STRAW), ...songbird(116, 70, 15, ORANGE), ...songbird(142, 72, 10, GOLD), fill(leaf(14, 80, 22, 6, 0.7), MOSS), fill(leaf(88, 80, 20, 6, 0.9), SEA)],
    details: [[...songbird(20, 18, 15, GOLD)]],
  }),
  // The way, before anybody goes it.
  'every-stop-coding-and-start-planning': () => ({
    ground: day(0.45),
    shapes: [fill(quad(6, 20, 52, 10, 52, 86, 6, 94), [0.86, 0.9], GOLD, 0.8), fill(quad(54, 10, 106, 20, 106, 94, 54, 86), [0.8, 0.2], SAGE, 0.8), fill(quad(108, 20, 154, 10, 154, 86, 108, 94), [0.86, 0.8], STRAW, 0.8), ...[[18, 80], [27, 72], [37, 67], [48, 66], [59, 68], [69, 65], [77, 57], [84, 48], [94, 42], [105, 42], [116, 44], [125, 40]].map(([x, y]) => fill(oval(x, y, 2), NAVY)), fill(`M136 46C124 32 128 18 136 18S148 32 136 46Z`, RED, RUST), fill(oval(136, 27, 3.4), STRAW), fill(oval(30, 36, 9), SEA, SAGE), fill(quad(78, 84, 88, 66, 98, 84), MOSS)],
    details: [miniature(6, 20, 20, 36, RED, GOLD)],
  }),
  // Three lines: five, seven, five.
  'every-vibe-check-claude-haiku-4-5': () => ({
    ground: day(0.6),
    shapes: [5, 7, 5].flatMap((count, row) => Array.from({ length: count }, (_, i) => fill(stone(80 + (i - (count - 1) / 2) * 20, 22 + row * 28, 7.6, 7, i + row + 1), [RED, SEA, GOLD, NAVY, ORANGE, MOSS, PLUM][(i * 3 + row * 2) % 7] as Pigment))),
    details: [miniature(7, 20, 20, 36, RED, GOLD)],
  }),
  // A ladybird on the leaf, gone before you looked.
  'every-my-ai-had-already-fixed-the-code-before-i-saw-it': () => ({
    ground: day(0.15),
    shapes: [fill(leaf(8, 92, 168, 38, -0.5), MOSS, SEA), brush(line(8, 92, 70, 60, 148, 18), 1.6, NAVY), fill(half(92, 40, 18, -0.5), RED, RUST), fill(oval(107, 32, 6), NAVY), ...[[84, 36], [93, 28], [97, 37], [104, 25]].map(([x, y]) => fill(oval(x, y, 2.4), NAVY))],
    details: [miniature(2, 20, 20, 36, MOSS, GOLD)],
  }),
  // One hull, five sails.
  'every-how-i-use-claude-code-to-ship-like-a-team-of-five': () => ({
    ground: sea(0.6),
    shapes: [...[RED, ORANGE, GOLD, RUST, SEA].map((ink, i) => fill(quad(26 + i * 22, 58, 26 + i * 22, 58 - 28 - 9 * Math.sin(i * 0.8), 45 + i * 22, 58), ink as Pigment)), fill('M14 62L146 62Q138 82 112 82L44 82Q22 82 14 62Z', NAVY, PLUM), fill(waves(0, 78, 160, 10, 6, 6), MOSS, SAGE, 0.8), fill(waves(0, 88, 160, 12, 5, 7), SEA, NAVY), fill(wing(138, 18, 9, -0.2), NAVY)],
    details: [[...boat(18, 27, 12, RED, RUST, NAVY)]],
  }),
  // A letter that flies.
  'every-cora-is-out-of-beta': () => ({
    ground: day(0.35),
    shapes: [fill(quad(46, 40, 112, 34, 118, 78, 52, 84), [0.88, 1], STRAW, 0.9), fill(quad(46, 40, 112, 34, 82, 62), RED, RUST), fill(leaf(50, 48, 50, 13, -2.5), SEA, SAGE), fill(leaf(50, 56, 44, 12, -2.9), NAVY, SEA), fill(leaf(112, 42, 50, 13, -0.7), SEA, SAGE), fill(leaf(113, 50, 44, 12, -0.25), NAVY, SEA), cloud(34, 92, 8, SAGE), cloud(132, 88, 7, SAGE)],
    details: [miniature(4, 20, 20, 36, RED, GOLD)],
  }),
  // Ten leaves of one seed.
  'every-how-i-10x-my-engineering-with-ai': () => ({
    ground: day(0.65),
    shapes: [brush(line(80, 96, 78, 60, 82, 18), 2.4, PLUM), ...Array.from({ length: 10 }, (_, i) => fill(leaf(80, 86 - Math.floor(i / 2) * 14, 56 - Math.floor(i / 2) * 7, 9, i % 2 ? Math.PI + 0.45 : -0.45), [SEA, MOSS, RUST, GOLD, SEA, ORANGE, MOSS, RED, SAGE, GOLD][i] as Pigment)), fill(stone(80, 95, 12, 4, 1.2), PLUM)],
    details: [miniature(2, 20, 20, 36, MOSS, GOLD)],
  }),
}
