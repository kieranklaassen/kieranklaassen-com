import { Head, Link } from '@inertiajs/react'
import { PostList } from '../components/post_list'
import { RepositoryList } from '../components/repository_list'
import type { GithubRepositorySummary, PostSummary } from '../types/page'

const MORE_LINK_CLASS_NAME =
  'rounded-sm text-sm font-semibold underline decoration-1 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black'

interface HomeProps {
  posts: PostSummary[]
  repositories: GithubRepositorySummary[]
}

export function HomeContent({ posts, repositories }: HomeProps) {
  return (
    <section className="mx-auto w-full max-w-[1206px] px-6 pb-24 lg:px-0">
      <div className="mt-8 mb-5 flex items-baseline justify-between gap-6">
        <h2 className="text-2xl font-bold">Thoughts</h2>
        <Link href="/posts" className={MORE_LINK_CLASS_NAME}>
          More
        </Link>
      </div>
      <PostList posts={posts} />

      <div className="mt-14 mb-5 flex items-baseline justify-between gap-6">
        <h2 className="text-2xl font-bold">Code</h2>
        <a
          href="https://github.com/kieranklaassen?tab=repositories"
          target="_blank"
          rel="noopener noreferrer"
          className={MORE_LINK_CLASS_NAME}
        >
          More
        </a>
      </div>
      <RepositoryList repositories={repositories} />
    </section>
  )
}

export default function Home({ posts, repositories }: HomeProps) {
  return (
    <>
      <Head title="Kieran Klaassen">
        <meta
          head-key="description"
          name="description"
          content="Essays from Kieran Klaassen about work, life, creativity, and technology."
        />
      </Head>
      <HomeContent posts={posts} repositories={repositories} />
    </>
  )
}
