import { Head, Link } from '@inertiajs/react'
import { ByLook } from '../../looks/by_look'
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
      <ByLook painted={() => <PaintedPost post={post} />}>
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
