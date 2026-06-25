# Local development and review

- Run `bin/dev` to start Rails and Vite together.
- Keep Vite Ruby's development `skipProxy` disabled. Rails must proxy Vite and
  development SSR through the same origin, including when using a review tunnel.
- Run `npm run build` when verifying production browser and SSR bundles; it is
  not required for each local edit.
- Posts live in `content/posts/`. Preserve their frontmatter dates, category
  spelling, and filenames unless a URL migration is intentional.

# Deploying

- Production uses Kamal 2.12. Load `.kamal/deploy.env` before running
  `bin/kamal config`, `bin/kamal setup`, or `bin/kamal deploy`.
- `.kamal/deploy.env` and `.kamal/secrets` are local ignored files. Examples are
  tracked; production values and credentials never are.
- Verify `/up` and raw server-rendered article prose after each deployment. See
  `DEPLOYING.md` for the exact smoke and rollback workflow.

# Architecture

- Rails owns routes and props; React pages do not fetch a parallel JSON API.
- Inertia SSR is global. Browser-only work belongs in effects so server markup
  and the first hydrated render remain identical.
- The Markdown files are trusted repository content and may contain embeds.
  Do not reuse this raw-HTML rendering path for user-submitted content.
