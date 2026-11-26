import { Head, Link } from '@inertiajs/react'
import { ByLook } from '../../looks/by_look'
import type { CSSProperties } from 'react'
import type { Post } from '../../types/page'

const LONG_DATE_FORMAT = new Intl.DateTimeFormat('en', {
  dateStyle: 'long',
  timeZone: 'UTC',
})

export function AiAssistanceDisclosure({ visible }: { visible: boolean }) {
  if (!visible) return null

  return (
    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-600">
      AI-assisted writing. The original ideas and experiences are mine.
    </p>
  )
}

/** The first letter of an article that begins with words, so that it can be painted. */
export function withInitial(html: string) {
  return html.replace(/^\s*<p>([A-Za-z])/, '<p><span class="wc-initial" data-paint="initial">$1</span>')
}

/** An article with a painting of its own. Where it stands is for the look to say. */
function ArtPost({ post }: { post: Post }) {
  return (
    <div className="wc-stream" data-paint="stream">
      <article className="wc-art" data-paint="sheet" data-key={post.slug}>
        <div className="wc-picture" data-paint="picture" data-key={post.slug} aria-hidden="true" />
        <header>
          <Link href="/posts" className="wc-back" data-paint="quiet">
            ← All thoughts
          </Link>
          <h2 data-paint="title" data-key={post.slug} style={{ '--longest': Math.max(...post.title.split(/[\s-]+/).map((word) => word.length), 9), '--letters': Math.sqrt(post.title.length).toFixed(2) } as CSSProperties}>
            {post.title}
          </h2>
          <div className="wc-when" data-paint="quiet">
            <time dateTime={post.date}>{LONG_DATE_FORMAT.format(new Date(`${post.date}T00:00:00Z`))}</time>
            <AiAssistanceDisclosure visible={post.ai_assisted} />
          </div>
        </header>
        <div className="wc-prose post-prose prose prose-lg max-w-none" dangerouslySetInnerHTML={{ __html: withInitial(post.html) }} />
        <div className="wc-tail" data-paint="tail" aria-hidden="true" />
      </article>
      <div className="wc-foot" data-paint="foot" aria-hidden="true" />
    </div>
  )
}

function PaintedPost({ post }: { post: Post }) {
  return (
    <div className="wc-stream" data-paint="stream">
      <article className="wc-sheet" data-paint="sheet" data-key={post.slug}>
        <Link href="/" className="wc-back">
          ← All thoughts
        </Link>
        <div className="wc-phrase" data-paint="phrase" data-key={post.slug} data-of="article" aria-hidden="true" />
        <header>
          <h2 data-paint="title" data-key={post.slug}>
            {post.title}
          </h2>
          <time dateTime={post.date}>{LONG_DATE_FORMAT.format(new Date(`${post.date}T00:00:00Z`))}</time>
          <AiAssistanceDisclosure visible={post.ai_assisted} />
        </header>
        <div className="wc-prose post-prose prose prose-lg max-w-none" dangerouslySetInnerHTML={{ __html: post.html }} />
      </article>
      <div className="wc-band" data-paint="band" data-key="band-foot" aria-hidden="true" />
    </div>
  )
}

export default function PostShow({ post }: { post: Post }) {
  return (
    <>
      <Head title={post.title}>
        <meta head-key="description" name="description" content={post.description} />
      </Head>
      <ByLook painted={({ art }) => (art ? <ArtPost post={post} /> : <PaintedPost post={post} />)}>
      <article className="glass-panel mx-auto mt-8 max-w-[938px] px-6 py-12 sm:px-10 lg:px-16 lg:py-16">
        <Link href="/" className="text-sm font-semibold underline underline-offset-4">
          ← All thoughts
        </Link>
        <header className="mt-10 border-b border-black/10 pb-8">
          <h2 className="max-w-4xl text-4xl leading-[0.95] font-bold tracking-[-0.04em] sm:text-6xl">
            {post.title}
          </h2>
          <time dateTime={post.date} className="mt-5 block text-sm font-medium tracking-wide text-gray-600 uppercase">
            {LONG_DATE_FORMAT.format(new Date(`${post.date}T00:00:00Z`))}
          </time>
          <AiAssistanceDisclosure visible={post.ai_assisted} />
        </header>
        <div
          className="post-prose prose prose-lg mt-10 max-w-none prose-headings:tracking-tight prose-a:decoration-1 prose-a:underline-offset-4"
          dangerouslySetInnerHTML={{ __html: post.html }}
        />
      </article>
      </ByLook>
    </>
  )
}
