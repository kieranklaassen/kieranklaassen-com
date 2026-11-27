// node design/bundle.mjs <folder>: the paint and the sound of the site as one script, with the engine in it.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { rolldown } from 'rolldown'

const to = resolve(process.argv[2])
const engine = resolve('vendor/engine')
const inline = {
  name: 'inline',
  resolveId: (id) => (id === 'virtual:worklet' ? id : undefined),
  load: (id) => (id === 'virtual:worklet' ? `export default ${JSON.stringify(readFileSync(join(engine, 'wasm-device.js'), 'utf8'))}` : undefined),
  transform(code, id) {
    if (!id.endsWith('vendor/engine/engine.js')) return
    return {
      code:
        code
          .replace(/new URL\("\.\/([\w-]+\.wasm)", import\.meta\.url\)/g, (_, file) => `__bytes("${readFileSync(join(engine, file)).toString('base64')}")`)
          .replace(/new URL\("\.\/wasm-device\.js", import\.meta\.url\)\.href/, 'globalThis.__worklet')
          .replace(/new URL\("\.\/load-sampler\.js", import\.meta\.url\)\.href/, '""') + '\nfunction __bytes(text) { return Uint8Array.from(atob(text), (c) => c.charCodeAt(0)) }\n',
      map: null,
    }
  },
}
const bundle = await rolldown({ input: resolve('design/watercolor.ts'), plugins: [inline] })
await bundle.write({ file: join(to, 'watercolor.js'), format: 'iife', name: 'Watercolor', codeSplitting: false, minify: true })
