import { Link, usePage } from '@inertiajs/react'
import type { PropsWithChildren } from 'react'
import { SiteShell } from '../components/site_shell'
import { Pens } from '../pens/pens_tray'
import { PaintedSheet } from '../watercolor/sheet'
import { Sound } from './sound'
import { ARTS, LOOKS, roomsOf, type Art, type Look } from './looks'

export function LookShell({ children }: PropsWithChildren) {
  const { props, url, component } = usePage<{ look: Look; art: Art; chooseLook: boolean }>()
  const look = props.look
  const rooms = roomsOf(look, component, props.art)
  const path = url.split(/[?#]/)[0]
  const chooser = props.chooseLook && <LookChooser look={look} art={rooms?.art} path={path} />

  if (!rooms)
    return (
      <>
        <SiteShell>{children}</SiteShell>
        {chooser}
      </>
    )

  return (
    <div className="wc" data-art={rooms.art}>
      <PaintedSheet compose={rooms.compose} page={url} />
      <div className="wc-head" data-look={rooms.head}>
        <LookHeader small={component.startsWith('posts/show')} />
      </div>
      <main className="wc-body" data-look={rooms.body} data-page={component}>
        {children}
      </main>
      <Pens key={path} path={path} />
      <Sound rooms={rooms} url={url} />
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
function LookChooser({ look, art, path }: { look: Look; art?: Art; path: string }) {
  const choices = art
    ? ARTS.map((one) => ({ href: `${path}?art=${one.art}`, title: one.title, chosen: one.art === art }))
    : LOOKS.map((one) => ({ href: `${path}?look=${one.look}`, title: one.title, chosen: one.look === look }))
  return (
    <nav className="wc-chooser" aria-label="Look">
      {choices.map(({ href, title, chosen }) => (
        <a key={href} href={href} aria-current={chosen || undefined}>
          {title}
        </a>
      ))}
    </nav>
  )
}
