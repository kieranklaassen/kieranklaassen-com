/** What unfolds in a corner of the window. On a narrow one there is room for one of them at a time. */
type Unfolds = 'pens' | 'sound'

const UNFOLDED = 'wc:unfolded'
const NARROW = '(max-width: 640px)'

export const tellUnfolded = (what: Unfolds) => window.dispatchEvent(new CustomEvent<Unfolds>(UNFOLDED, { detail: what }))

/** Folds when the other one unfolds and there is no room for both. */
export function onUnfolded(other: Unfolds, fold: () => void) {
  const told = (event: Event) => {
    if ((event as CustomEvent<Unfolds>).detail === other && window.matchMedia(NARROW).matches) fold()
  }
  window.addEventListener(UNFOLDED, told)
  return () => window.removeEventListener(UNFOLDED, told)
}
