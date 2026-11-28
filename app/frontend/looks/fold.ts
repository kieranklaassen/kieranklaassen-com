import { useEffect, useState } from 'react'

type Unfolds = 'pens' | 'sound'

const UNFOLDED = 'wc:unfolded'
const NARROW = '(max-width: 640px)'

/** Whether something in a corner of the window is unfolded. A narrow window has room for one such thing at a time. */
export function useUnfold(mine: Unfolds): [open: boolean, toggle: () => void] {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const told = (event: Event) => {
      if ((event as CustomEvent<Unfolds>).detail !== mine && window.matchMedia(NARROW).matches) setOpen(false)
    }
    window.addEventListener(UNFOLDED, told)
    return () => window.removeEventListener(UNFOLDED, told)
  }, [mine])

  const toggle = () => {
    if (!open) window.dispatchEvent(new CustomEvent<Unfolds>(UNFOLDED, { detail: mine }))
    setOpen(!open)
  }

  return [open, toggle]
}
