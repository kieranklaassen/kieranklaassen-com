import { Head, Link } from '@inertiajs/react'
import type { Post } from '../../types/page'

const LONG_DATE_FORMAT = new Intl.DateTimeFormat('en', {
  dateStyle: 'long',
  timeZone: 'UTC',
})

export default function PostShow({ post }: { post: Post }) {
  return (
    <>
      <Head title={post.title}>
        <meta head-key="description" name="description" content={post.description} />
      </Head>
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
        </header>
        <div
          className="post-prose prose prose-lg mt-10 max-w-none prose-headings:tracking-tight prose-a:decoration-1 prose-a:underline-offset-4"
          dangerouslySetInnerHTML={{ __html: post.html }}
        />
      </article>
    </>
  )
}
