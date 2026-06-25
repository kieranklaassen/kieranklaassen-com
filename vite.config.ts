import inertia from '@inertiajs/vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import RubyPlugin from 'vite-plugin-ruby'

export default defineConfig(({ isSsrBuild }) => ({
  ...(isSsrBuild ? { ssr: { noExternal: true } } : {}),
  plugins: [
    tailwindcss(),
    RubyPlugin(),
    inertia({
      ssr: {
        entry: 'entrypoints/inertia.tsx',
        host: '127.0.0.1',
      },
    }),
    react(),
  ],
}))
