import { Head } from '@inertiajs/react'
import { PostList } from '../components/post_list'
import { SiteShell } from '../components/site_shell'
import type { PostSummary } from '../types/page'

export default function Home({ posts }: { posts: PostSummary[] }) {
  return (
    <SiteShell>
      <Head title="Kieran Klaassen">
        <meta
          head-key="description"
          name="description"
          content="Essays from Kieran Klaassen about work, life, creativity, and technology."
        />
      </Head>
      <section className="mx-auto w-full max-w-[1206px] px-6 pb-24 lg:px-0">
        <h2 className="mt-8 mb-5 text-2xl font-bold">Thoughts</h2>
        <PostList posts={posts} />
      </section>
    </SiteShell>
  )
}
