import { Head } from '@inertiajs/react'
import { PostList } from '../../components/post_list'
import { Section, Thoughts } from '../../looks/entries'
import type { Look } from '../../looks/looks'
import type { PostSummary } from '../../types/page'

export default function PostsIndex({ posts, look = 'blocks' }: { posts: PostSummary[]; look?: Look }) {
  return (
    <>
      <Head title="Thoughts">
        <meta
          head-key="description"
          name="description"
          content="All essays by Kieran Klaassen."
        />
      </Head>
      {look !== 'blocks' ? (
        <div className="wc-home" data-paint="stream">
          <Section title="Thoughts">
            <Thoughts posts={posts} look={look} />
          </Section>
          <div className="wc-band" data-paint="band" data-key="band-foot" aria-hidden="true" />
        </div>
      ) : (
      <section className="mx-auto w-full max-w-[1206px] px-6 pb-24 lg:px-0">
        <h2 className="mt-8 mb-5 text-2xl font-bold">Thoughts</h2>
        <PostList posts={posts} />
      </section>
      )}
    </>
  )
}
