import type { PropsWithChildren } from 'react'
import { SiteHeader } from './site_header'
import { SquareBackground } from './square_background'

export function SiteShell({ children }: PropsWithChildren) {
  return (
    <div className="site-shell">
      <svg aria-hidden="true" className="square-noise-filter" width="0" height="0">
        <filter id="square-noise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.83"
            numOctaves="8"
            stitchTiles="stitch"
            result="noise"
          />
          <feColorMatrix in="noise" type="saturate" values="0" result="desaturatedNoise" />
          <feComponentTransfer in="desaturatedNoise" result="theNoise">
            <feFuncA type="table" tableValues="0 0 0.6 0" />
          </feComponentTransfer>
          <feBlend in="SourceGraphic" in2="theNoise" mode="soft-light" />
        </filter>
      </svg>
      <SquareBackground />
      <SiteHeader />
      <main className="min-h-screen">{children}</main>
    </div>
  )
}
