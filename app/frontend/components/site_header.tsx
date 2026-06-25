import { Link } from '@inertiajs/react'

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-[1072px] flex-col gap-4 px-6 py-8 lg:min-h-[268px] lg:flex-row lg:items-start lg:px-0">
      <Link href="/" className="shrink-0 no-underline">
        <h1 className="max-w-[536px] text-center text-5xl leading-[0.82] font-bold tracking-[-0.06em] text-black/80 lg:px-6 lg:py-6 lg:text-left lg:text-8xl">
          Kieran Klaassen
        </h1>
      </Link>
      <div className="flex flex-1 flex-col items-center lg:items-start">
        <p className="max-w-[536px] px-4 text-center text-base leading-relaxed lg:mt-[134px] lg:text-left lg:text-lg">
          I&apos;m <strong>Kieran</strong>, a <strong>creator</strong> and <strong>engineer</strong>,{' '}
          <strong>composer</strong> and <strong>baker</strong>. I <strong>craft</strong> with love, creating{' '}
          <strong>code</strong> to <strong>croissants</strong>. My journey is one of{' '}
          <strong>curiosity</strong> and <strong>discovery</strong>, guided by a simple vision: to{' '}
          <strong>inspire</strong> and be <strong>true</strong> to myself.
        </p>
        <nav aria-label="Primary" className="mt-5 flex gap-5 px-4 text-sm font-semibold">
          <Link href="/posts" className="underline decoration-1 underline-offset-4">
            Thoughts
          </Link>
          <Link href="/about" className="underline decoration-1 underline-offset-4">
            About
          </Link>
        </nav>
      </div>
    </header>
  )
}
