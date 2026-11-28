import { EVERY_PICTURES } from './pictures_every'
import { LOCAL_PICTURES } from './pictures_local'
import { found, type Picture, type Pigment, type Shape } from './pictures_shared'

export type { Picture, Pigment, Shape }

export const pictureOf = (slug: string): Picture => (LOCAL_PICTURES[slug] ?? EVERY_PICTURES[slug])?.() ?? found(slug)
