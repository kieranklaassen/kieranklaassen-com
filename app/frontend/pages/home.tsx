import { Head, Link } from '@inertiajs/react'
import { PostList } from '../components/post_list'
import { RepositoryList } from '../components/repository_list'
import { Repositories, Section, Thoughts } from '../looks/entries'
import { ByLook } from '../looks/by_look'
import { Score } from '../looks/score'
import type { GithubRepositorySummary, PostSummary } from '../types/page'

const MORE_LINK_CLASS_NAME =
  'rounded-sm text-sm font-semibold underline decoration-1 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black'

interface HomeProps {
  posts: PostSummary[]
  repositories: GithubRepositorySummary[]
  score?: PostSummary[]
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

function PaintedHome({ posts, repositories, score, room }: HomeProps & { room: string }) {
  const lists = (
    <>
      <Section title="Thoughts" more={<Link href="/posts">More</Link>}>
        <Thoughts posts={posts} room={room} />
      </Section>
      <Section
        title="Code"
        more={
          <a href="https://github.com/kieranklaassen?tab=repositories" target="_blank" rel="noopener noreferrer">
            More
          </a>
        }
      >
        <Repositories repositories={repositories} room={room} />
      </Section>
    </>
  )
  if (room === 'long')
    return (
      <>
        <div className="wc-first" data-look="score">
          {score && <Score posts={score} />}
        </div>
        <div className="wc-river" data-look="estuary" data-paint="stream">
          <div className="wc-home">{lists}</div>
        </div>
      </>
    )
  return (
    <div className="wc-home" data-paint="stream">
      {score && (
        <div className={room === 'name' ? 'wc-first' : undefined} data-look="score">
          <Score posts={score} />
        </div>
      )}
      {lists}
      <div className="wc-band" data-paint="band" data-key="band-foot" aria-hidden="true" />
    </div>
  )
}

export default function Home({ posts, repositories, score }: HomeProps) {
  return (
    <>
      <Head title="Kieran Klaassen">
        <meta
          head-key="description"
          name="description"
          content="Essays from Kieran Klaassen about work, life, creativity, and technology."
        />
      </Head>
      <ByLook painted={({ body }) => <PaintedHome posts={posts} repositories={repositories} score={score} room={body} />}>
        <HomeContent posts={posts} repositories={repositories} />
      </ByLook>
    </>
  )
}
