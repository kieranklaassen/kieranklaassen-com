import { Link, usePage } from '@inertiajs/react'
import type { PropsWithChildren } from 'react'
import { SiteShell } from '../components/site_shell'
import { PaintedSheet } from '../watercolor/sheet'
import { LOOKS, roomsOf, type Look } from './looks'

export function LookShell({ children }: PropsWithChildren) {
  const { props, url, component } = usePage<{ look: Look; chooseLook: boolean }>()
  const look = props.look
  const chooser = props.chooseLook && <LookChooser look={look} path={url.split('?')[0]} />

  const rooms = roomsOf(look, component)
  if (!rooms)
    return (
      <>
        <SiteShell>{children}</SiteShell>
        {chooser}
      </>
    )

  return (
    <div className="wc">
      <PaintedSheet compose={rooms.compose} page={url} />
      <div className="wc-head" data-look={rooms.head}>
        <LookHeader small={component.startsWith('posts/show')} />
      </div>
      <main className="wc-body" data-look={rooms.body} data-page={component}>
        {children}
      </main>
      {chooser}
    </div>
  )
}

function LookHeader({ small }: { small: boolean }) {
  return (
    <header className="wc-header" data-small={small || undefined}>
      <Link href="/" className="wc-name">
        <h1 data-paint="name" data-key="name">
          Kieran Klaassen
        </h1>
      </Link>
      <div className="wc-intro">
        <p data-paint="intro">
          I&apos;m <strong>Kieran</strong>, a <strong>creator</strong> and <strong>engineer</strong>,{' '}
          <strong>composer</strong> and <strong>baker</strong>. I <strong>craft</strong> with love, creating{' '}
          <strong>code</strong> to <strong>croissants</strong>. <strong>Curiosity</strong> and{' '}
          <strong>discovery</strong> shape my life. I try to <strong>inspire</strong> others and stay{' '}
          <strong>true</strong> to myself.
        </p>
        <nav aria-label="Primary" data-paint="nav">
          <Link href="/posts">Thoughts</Link>
          <Link href="/about">About</Link>
        </nav>
      </div>
      <div className="wc-band" data-paint="band" data-key="band-top" aria-hidden="true" />
    </header>
  )
}

/** For choosing between the directions while they are being looked at. */
function LookChooser({ look, path }: { look: Look; path: string }) {
  return (
    <nav className="wc-chooser" aria-label="Look">
      {LOOKS.map((one) => (
        <a key={one.look} href={`${path}?look=${one.look}`} aria-current={one.look === look || undefined}>
          {one.title}
        </a>
      ))}
    </nav>
  )
}
