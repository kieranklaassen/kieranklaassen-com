import { Head } from '@inertiajs/react'
import { PostList } from '../../components/post_list'
import { Section, Thoughts } from '../../looks/entries'
import { ByLook } from '../../looks/by_look'
import { Score } from '../../looks/score'
import type { PostSummary } from '../../types/page'

/** The score of everything, and under it everything by its year. */
function Years({ posts }: { posts: PostSummary[] }) {
  const years = [...new Set(posts.map((post) => post.date.slice(0, 4)))]
  return (
    <>
      <Score posts={posts} />
      {years.map((year) => (
        <Section key={year} title={year}>
          <Thoughts posts={posts.filter((post) => post.date.startsWith(year))} room="score" />
        </Section>
      ))}
    </>
  )
}

function PaintedPosts({ posts, room }: { posts: PostSummary[]; room: string }) {
  return (
    <div className="wc-home" data-paint="stream">
      {room === 'score' ? <Years posts={posts} /> : (
        <Section title="Thoughts">
          <Thoughts posts={posts} room={room} />
        </Section>
      )}
      <div className="wc-band" data-paint="band" data-key="band-foot" aria-hidden="true" />
    </div>
  )
}

export default function PostsIndex({ posts }: { posts: PostSummary[] }) {
  return (
    <>
      <Head title="Thoughts">
        <meta
          head-key="description"
          name="description"
          content="All essays by Kieran Klaassen."
        />
      </Head>
      <ByLook painted={({ body }) => <PaintedPosts posts={posts} room={body} />}>
        <section className="mx-auto w-full max-w-[1206px] px-6 pb-24 lg:px-0">
          <h2 className="mt-8 mb-5 text-2xl font-bold">Thoughts</h2>
          <PostList posts={posts} />
        </section>
      </ByLook>
    </>
  )
}
