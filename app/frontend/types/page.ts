export interface PageProps {
  errors: Record<string, string>
}

export interface PostSummary {
  slug: string
  title: string
  date: string
  categories: string[]
  description: string
  path: string
}

export interface Post extends PostSummary {
  html: string
}
