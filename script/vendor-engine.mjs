// Takes what this site plays out of a checkout of the Ambient Town engine (kieranklaassen/live-mix):
//
//   node script/vendor-engine.mjs ../live-mix
//
// The engine builds itself when it is installed, which takes minutes, and its device library is one
// file of two megabytes. The site plays six devices, so it keeps those, the engine's tracks, and nothing else.

import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { rolldown } from 'rolldown'

const from = resolve(process.argv[2] ?? '../live-mix')
const to = resolve('vendor/engine')
const DEVICES = {
  thesis: ['thesis.gen', 'createThesis'],
  atmosphere: ['atmosphere.gen', 'createAtmosphere'],
  droplets: ['droplets.gen', 'createDroplets'],
  handpan: ['handpan.gen', 'createHandpan'],
  'felt-piano': ['felt-piano', 'createFeltPiano'],
  'plate-reverb': ['plate-reverb', 'createPlateReverb'],
}

rmSync(to, { recursive: true, force: true })
mkdirSync(to, { recursive: true })

const entry = join(to, 'entry.mjs')
writeFileSync(
  entry,
  [
    ...['InstrumentTrack', 'ReturnTrack'].map((name) => `export { ${name} } from ${JSON.stringify(join(from, `src/core/tracks/${name}.ts`))}`),
    ...Object.values(DEVICES).map(([file, name]) => `export { ${name} } from ${JSON.stringify(join(from, 'src/dsp/devices', `${file}.ts`))}`),
  ].join('\n'),
)

// Where a file lies beside the bundle is the bundler's of the site to say, so the addresses stay as they are written.
const beside = {
  name: 'beside',
  transform: (code) => ({ code: code.replaceAll("'../wasm/", "'./").replaceAll("'../worklets/", "'./").replaceAll("'./worklets/", "'./"), map: null }),
}
const bundle = await rolldown({ input: entry, plugins: [beside], treeshake: { moduleSideEffects: false } })
await bundle.write({ file: join(to, 'engine.js'), format: 'esm', minify: { mangle: true, compress: true, codegen: { removeWhitespace: false } } })
rmSync(entry)

for (const [name, file] of [['wasm-device', 'src/dsp/worklets/wasm-device.processor.ts'], ['load-sampler', 'src/core/load-sampler.worker.ts']]) {
  const worklet = await rolldown({ input: join(from, file) })
  await worklet.write({ file: join(to, `${name}.js`), format: 'iife', minify: true })
}

for (const name of Object.keys(DEVICES)) copyFileSync(join(from, 'src/dsp/wasm', `${name}.wasm`), join(to, `${name}.wasm`))
writeFileSync(
  join(to, 'engine.d.ts'),
  `export interface Device {
  readonly input: AudioNode
  readonly output: AudioNode
  noteOn(id: number, frequency: number, gain?: number): void
  noteOff(id: number): void
  setParam(name: string, value: number): void
  dispose(): void
}
type Make = (context: BaseAudioContext, options?: { params?: Record<string, number>; processorUrl?: string; wasm?: URL | string | BufferSource }) => Promise<Device>
interface Strip {
  setLevel(value: number): void
  readonly sends: { add(to: ReturnTrack, options: { level: number }): void }
}
interface Options {
  name: string
  device: Device
  destination: AudioNode
  context: BaseAudioContext
}
export class InstrumentTrack {
  constructor(options: Options)
  readonly device: Device
  readonly strip: Strip
  noteOn(id: number, frequency: number, gain?: number): void
  noteOff(id: number): void
}
export class ReturnTrack {
  constructor(options: Options)
  readonly strip: Strip
}
${Object.values(DEVICES).map(([, name]) => `export const ${name}: Make`).join('\n')}
`,
)
copyFileSync(join(from, 'LICENSE'), join(to, 'LICENSE'))
const commit = execFileSync('git', ['-C', from, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
writeFileSync(join(to, 'VERSION'), `${commit}\n`)
