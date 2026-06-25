import { createInertiaApp } from '@inertiajs/react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { SiteShell } from '../components/site_shell'

void createInertiaApp({
  pages: '../pages',
  layout: () => SiteShell,
  setup({ el, App, props }) {
    const tree = <App {...props} />

    if (!el) return tree

    if (el.dataset.serverRendered === 'true') {
      hydrateRoot(el, tree)
    } else {
      createRoot(el).render(tree)
    }
  },
}).catch((error) => {
  if (document.getElementById('app')) throw error
})
