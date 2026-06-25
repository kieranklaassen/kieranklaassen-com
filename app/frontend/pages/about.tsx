import { Head } from '@inertiajs/react'
import { SiteShell } from '../components/site_shell'

export default function About() {
  return (
    <SiteShell>
      <Head title="About">
        <meta
          head-key="description"
          name="description"
          content="About Kieran Klaassen, a creator, engineer, composer, and baker."
        />
      </Head>
      <article className="glass-panel prose prose-xl mx-auto mt-8 max-w-[938px] px-8 py-16">
        <h2>About</h2>
        <p>
          I&apos;m Kieran, a founder and engineering leader who loves turning ideas into useful,
          expressive things. My work moves between software, teams, music, writing, and baking,
          always guided by curiosity and care for the craft.
        </p>
        <p>
          This is where I write about what I&apos;m learning across technology, creativity,
          leadership, and personal growth.
        </p>
      </article>
    </SiteShell>
  )
}
