# kieranklaassen.com

Kieran Klaassen's personal site, built with Rails 8.1, Inertia 3, React 19,
Vite, and server-side rendering. Posts remain Markdown files in the repository;
the production container is deployed with Kamal.

## Requirements

- Ruby 3.4.2
- Node.js 22 or newer
- npm

## Set up and run

```bash
bin/setup --skip-server
bin/dev
```

Open <http://localhost:3000>. `bin/dev` starts Rails and Vite together. Keep
Vite Ruby's development proxy enabled so local and tunneled requests load
assets and SSR from one origin.

## Add a post

Add a Markdown file to `content/posts/` with this frontmatter:

```yaml
---
title: A useful title
date: "2026-06-25"
categories: creativity, technology
description: A concise summary for lists and search previews.
---
```

The filename becomes the slug. The category spelling and date are part of the
public URL, so changing them changes the canonical path. Repository content is
trusted and may include raw HTML for embeds.

## Verify

```bash
bin/rails test
npm run check
npm run test:frontend
npm run build
bin/rubocop
bin/brakeman --no-pager
```

The strict SSR integration tests require a built bundle and a running renderer.
Start the renderer in one terminal:

```bash
node public/vite-ssr/ssr.js
```

Then run the strict tests in another terminal:

```bash
INERTIA_SSR_URL=http://127.0.0.1:13714 SSR_STRICT=1 \
  bin/rails test test/integration/inertia_ssr_test.rb
```

See [DEPLOYING.md](DEPLOYING.md) for the Kamal workflow.
