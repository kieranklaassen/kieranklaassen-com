import type { GithubRepositorySummary } from '../types/page'

export function RepositoryList({ repositories }: { repositories: GithubRepositorySummary[] }) {
  if (repositories.length === 0) {
    return <p className="glass-panel p-5 text-sm text-gray-600">More code is on GitHub.</p>
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {repositories.map((repository) => (
        <a
          key={repository.name}
          href={repository.url}
          target="_blank"
          rel="noopener noreferrer"
          className="glass-panel block min-h-48 p-5 transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black"
          aria-label={`${repository.name} on GitHub`}
        >
          <h3 className="text-lg font-semibold underline decoration-1 underline-offset-4">
            {repository.name}
          </h3>
          {repository.description && (
            <p className="mt-3 text-sm leading-relaxed text-gray-700">{repository.description}</p>
          )}
          <div className="mt-4 flex items-center justify-between gap-4 text-xs font-medium tracking-wide text-gray-500 uppercase">
            {repository.language ? <span>{repository.language}</span> : <span />}
            <span aria-label={`${repository.stars} ${repository.stars === 1 ? 'star' : 'stars'}`}>
              ★ {repository.stars}
            </span>
          </div>
        </a>
      ))}
    </div>
  )
}
