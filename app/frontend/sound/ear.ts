// What the paint tells whoever listens. Nobody does until Sound is pressed, and then telling costs nothing.

export type Gesture = 'square' | 'letter' | 'puddle' | 'bank' | 'run' | 'flood' | 'drop' | 'rain' | 'splash'

export interface Heard {
  gesture: Gesture
  /** Where in the window: -1 at its left edge, 1 at its right. */
  pan: number
  /** How large: 0 for a drop off the brush, 1 for a wash as wide as the window. */
  size: number
  /** The pigment: how light, and how warm. */
  light: number
  warmth: number
  /** Over how many seconds it is laid. */
  lasts: number
  /** Which letter of its line it is. */
  index?: number
}

/** What there is of the paint in the window: how light it is, and how warm. */
export interface View {
  light: number
  warmth: number
}

export const ear: {
  /** What is seen. The sheet says, when it is asked. */
  view?: () => View | undefined
  hears?: (heard: Heard) => void
  /** Something else is being played: step back, or come forward again. */
  hush?: (hushed: boolean) => void
  /** The score is being played. */
  playing?: boolean
} = {}
