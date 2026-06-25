import { Head } from '@inertiajs/react'
import { PostList } from '../../components/post_list'
import { SiteShell } from '../../components/site_shell'
import type { PostSummary } from '../../types/page'

export default function PostsIndex({ posts }: { posts: PostSummary[] }) {
  return (
    <SiteShell>
      <Head title="Thoughts">
        <meta
          head-key="description"
          name="description"
          content="All essays by Kieran Klaassen."
        />
      </Head>
      <section className="mx-auto w-full max-w-[1206px] px-6 pb-24 lg:px-0">
        <h2 className="mt-8 mb-5 text-2xl font-bold">Thoughts</h2>
        <PostList posts={posts} />
      </section>
    </SiteShell>
  )
}
