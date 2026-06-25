import type { PropsWithChildren } from 'react'
import { SiteHeader } from './site_header'
import { SquareBackground } from './square_background'

export function SiteShell({ children }: PropsWithChildren) {
  return (
    <div className="site-shell">
      <SquareBackground />
      <SiteHeader />
      <main className="min-h-screen">{children}</main>
    </div>
  )
}
