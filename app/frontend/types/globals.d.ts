import type { PageProps } from './page'

declare module '@inertiajs/core' {
  interface InertiaConfig {
    pageProps: PageProps
  }
}

export {}
