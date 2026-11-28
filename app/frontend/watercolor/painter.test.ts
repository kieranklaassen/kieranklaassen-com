// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Kind, reachOf, type RGB, type Rect, type Wash } from './painter'

const COMPLETION = 0x91b1
const VERTEX_SHADER = 0x8b31
const FRAGMENT_SHADER = 0x8b30
const COMPILE_STATUS = 0x8b81
const LINK_STATUS = 0x8b82
const ARRAY_BUFFER = 0x8892
const STATIC_DRAW = 0x88e4
const STREAM_DRAW = 0x88e0
const FLOAT = 0x1406
const TEXTURE_2D = 0x0de1
const TEXTURE0 = 0x84c0
const TEXTURE1 = 0x84c1
const R8 = 0x8229
const RED = 0x1903
const RG32F = 0x8230
const RG = 0x8227
const UNSIGNED_BYTE = 0x1401
const UNPACK_ALIGNMENT = 0x0cf5
const TEXTURE_MIN_FILTER = 0x2801
const TEXTURE_MAG_FILTER = 0x2800
const TEXTURE_WRAP_S = 0x2802
const TEXTURE_WRAP_T = 0x2803
const LINEAR = 0x2601
const NEAREST = 0x2600
const CLAMP_TO_EDGE = 0x812f
const BLEND = 0x0be2
const SCISSOR_TEST = 0x0c11
const COLOR_BUFFER_BIT = 0x4000
const DST_COLOR = 0x0306
const ZERO = 0
const TRIANGLE_STRIP = 0x0005

const CONSTANTS: Record<string, number> = {
  VERTEX_SHADER,
  FRAGMENT_SHADER,
  COMPILE_STATUS,
  LINK_STATUS,
  ARRAY_BUFFER,
  STATIC_DRAW,
  STREAM_DRAW,
  FLOAT,
  TEXTURE_2D,
  TEXTURE0,
  TEXTURE1,
  R8,
  RED,
  RG32F,
  RG,
  UNSIGNED_BYTE,
  UNPACK_ALIGNMENT,
  TEXTURE_MIN_FILTER,
  TEXTURE_MAG_FILTER,
  TEXTURE_WRAP_S,
  TEXTURE_WRAP_T,
  LINEAR,
  NEAREST,
  CLAMP_TO_EDGE,
  BLEND,
  SCISSOR_TEST,
  COLOR_BUFFER_BIT,
  DST_COLOR,
  ZERO,
  TRIANGLE_STRIP,
}

interface MockGLOptions {
  parallel?: boolean
  links?: boolean
  compiles?: boolean | [boolean, boolean]
  shaderInfoLog?: string | null
  programInfoLog?: string | null
  attribLocations?: Record<string, number>
  throwOnCreateProgram?: boolean
}

function mockGL(options: MockGLOptions = {}) {
  const {
    parallel = true,
    links = true,
    compiles = true,
    shaderInfoLog = 'shader failed',
    programInfoLog = 'no',
    attribLocations,
    throwOnCreateProgram = false,
  } = options

  const state: { done: boolean | null; lost: boolean; waits: number } = { done: false, lost: false, waits: 0 }
  const uniforms: Record<string, { uniform: string }> = {}
  const buffers: { id: number }[] = []
  const uploaded: Float32Array[] = []
  let shaderCompileIndex = 0

  const fns = {
    getExtension: vi.fn((name: string) =>
      name === 'KHR_parallel_shader_compile' && parallel ? { COMPLETION_STATUS_KHR: COMPLETION } : null,
    ),
    isContextLost: vi.fn(() => state.lost),
    createProgram: vi.fn(() => {
      if (throwOnCreateProgram) throw new Error('program boom')
      return { program: true }
    }),
    createShader: vi.fn((type: number) => ({ type })),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getShaderParameter: vi.fn((_shader: unknown, what: number) => {
      if (what === COMPILE_STATUS) {
        state.waits++
        if (Array.isArray(compiles)) {
          const idx = shaderCompileIndex++ % compiles.length
          return compiles[idx]
        }
        return compiles
      }
      return true
    }),
    getShaderInfoLog: vi.fn(() => shaderInfoLog),
    getProgramParameter: vi.fn((_: unknown, what: number) => {
      if (what === COMPLETION) return state.done
      state.waits++
      return what === LINK_STATUS ? links : true
    }),
    getProgramInfoLog: vi.fn(() => programInfoLog),
    useProgram: vi.fn(),
    createVertexArray: vi.fn(() => ({ vao: true })),
    bindVertexArray: vi.fn(),
    createBuffer: vi.fn(() => {
      const buffer = { id: buffers.length + 1 }
      buffers.push(buffer)
      return buffer
    }),
    bindBuffer: vi.fn(),
    bufferData: vi.fn((_target: number, data: ArrayBufferView, _usage: number) => {
      if (data instanceof Float32Array) uploaded.push(new Float32Array(data))
    }),
    getAttribLocation: vi.fn((_program: unknown, name: string) => {
      if (attribLocations && name in attribLocations) return attribLocations[name]
      return name === 'aCorner' ? 0 : 1
    }),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    vertexAttribDivisor: vi.fn(),
    getUniformLocation: vi.fn((_program: unknown, name: string) => {
      uniforms[name] ??= { uniform: name }
      return uniforms[name]
    }),
    createTexture: vi.fn(() => ({ texture: true })),
    bindTexture: vi.fn(),
    texImage2D: vi.fn(),
    texParameteri: vi.fn(),
    pixelStorei: vi.fn(),
    activeTexture: vi.fn(),
    uniform1i: vi.fn(),
    uniform1f: vi.fn(),
    uniform3f: vi.fn(),
    uniform4f: vi.fn(),
    enable: vi.fn(),
    viewport: vi.fn(),
    scissor: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    blendFunc: vi.fn(),
    drawArraysInstanced: vi.fn(),
  }

  const gl = { ...CONSTANTS, ...fns } as unknown as WebGL2RenderingContext
  const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(gl as never)
  return { state, gl, fns, uniforms, buffers, uploaded, getContextSpy }
}

/** A WebGL context whose compiler is done when `done` is set, and that counts what would wait for it. */
function compiler({ parallel = true, links = true } = {}) {
  return mockGL({ parallel, links }).state
}

async function loadPainterModule() {
  vi.resetModules()
  return import('./painter')
}

async function painter() {
  const { Painter } = await loadPainterModule()
  return Painter.get()!
}

function makeWash(overrides: Partial<Wash> = {}): Wash {
  return {
    kind: Kind.Square,
    x: 10,
    y: 20,
    w: 30,
    h: 40,
    ink: [0.1, 0.2, 0.3],
    ink2: [0.4, 0.5, 0.6],
    density: 0.75,
    seed: [1, 2, 3, 4],
    grow: 1,
    ...overrides,
  }
}

afterEach(() => void vi.restoreAllMocks())

describe('reachOf', () => {
  it('returns the wash reach for each kind', () => {
    expect(reachOf(makeWash({ kind: Kind.Bank }))).toBe(150)
    expect(reachOf(makeWash({ kind: Kind.Puddle }))).toBe(60)
    expect(reachOf(makeWash({ kind: Kind.Square }))).toBe(34)
    expect(reachOf(makeWash({ kind: Kind.Pencil }))).toBe(34)
    expect(reachOf(makeWash({ kind: Kind.Letter }))).toBe(34)
    expect(reachOf(makeWash({ kind: Kind.Run }))).toBe(34)
  })
})

describe('Painter.get', () => {
  it('creates one shared painter with low-power webgl2 options and caches it', async () => {
    const { getContextSpy } = mockGL({ parallel: false })
    const { Painter } = await loadPainterModule()

    const first = Painter.get()
    const second = Painter.get()

    expect(first).toBeDefined()
    expect(second).toBe(first)
    expect(getContextSpy).toHaveBeenCalledTimes(1)
    expect(getContextSpy).toHaveBeenCalledWith('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: 'low-power',
    })
  })

  it('returns undefined when webgl2 context is unavailable', async () => {
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const { Painter } = await loadPainterModule()

    expect(Painter.get()).toBeUndefined()
    expect(getContextSpy).toHaveBeenCalledTimes(1)
  })

  it('returns undefined when constructor compilation throws', async () => {
    mockGL({ throwOnCreateProgram: true })
    const { Painter } = await loadPainterModule()

    expect(Painter.get()).toBeUndefined()
  })
})

describe('Painter.ready', () => {
  it('asks nothing of the compiler before it is done', async () => {
    const state = compiler()
    const ready = (await painter()).ready()
    await new Promise((done) => setTimeout(done, 40))
    expect(state.waits).toBe(0)
    state.done = true
    expect(await ready).toBe(true)
    expect(state.waits).toBe(3)
  })

  it('waits for the compiler where a browser cannot say when it is done', async () => {
    compiler({ parallel: false })
    expect(await (await painter()).ready()).toBe(true)
  })

  it('says so when it cannot paint due to link failure', async () => {
    compiler({ links: false }).done = true
    expect(await (await painter()).ready()).toBe(false)
  })

  it('returns false when shader compilation fails', async () => {
    const { state, fns } = mockGL({ compiles: [true, false], shaderInfoLog: 'frag syntax error' })
    state.done = true
    const p = await painter()

    expect(await p.ready()).toBe(false)
    expect(fns.getShaderInfoLog).toHaveBeenCalledTimes(1)
    expect(fns.useProgram).not.toHaveBeenCalled()
  })

  it('finishes setup once when ready is asked more than once', async () => {
    const state = compiler()
    const p = await painter()
    const first = p.ready()
    const second = p.ready()
    state.done = true
    expect(await Promise.all([first, second])).toEqual([true, true])
    expect(await p.ready()).toBe(true)
    expect(state.waits).toBe(3)
  })

  it('stops waiting when the context is lost before linking finishes', async () => {
    const state = compiler()
    const ready = (await painter()).ready()
    state.lost = true
    expect(await ready).toBe(true)
    expect(state.waits).toBe(0)
  })

  it('stops waiting when the completion query returns null', async () => {
    const state = compiler({ links: false })
    state.done = null
    expect(await (await painter()).ready()).toBe(false)
  })
})

describe('Painter.setUp and GPU state setters', () => {
  it('compiles, configures attributes/uniforms/textures, and skips missing attributes', async () => {
    const { fns, uniforms } = mockGL({
      parallel: false,
      attribLocations: {
        aCorner: 0,
        aRect: 1,
        aInk: 2,
        aInk2: -1,
        aSeed: 3,
        aState: 4,
        aDrop: 5,
        aExtra: 6,
      },
    })
    const p = await painter()

    p.setUp()

    expect(fns.createProgram).toHaveBeenCalledTimes(2)
    expect(fns.useProgram).toHaveBeenCalledTimes(1)
    expect(fns.enableVertexAttribArray).toHaveBeenCalledWith(0)
    expect(fns.vertexAttribPointer).toHaveBeenCalledWith(0, 2, FLOAT, false, 0, 0)
    expect(fns.vertexAttribDivisor).toHaveBeenCalledTimes(6)
    expect(fns.vertexAttribPointer).toHaveBeenCalledWith(1, 4, FLOAT, false, 28 * 4, 0)
    expect(fns.vertexAttribPointer).toHaveBeenCalledWith(2, 4, FLOAT, false, 28 * 4, 16)
    expect(fns.vertexAttribPointer).toHaveBeenCalledWith(3, 4, FLOAT, false, 28 * 4, 48)
    expect(fns.vertexAttribDivisor).toHaveBeenCalledWith(6, 1)
    expect(fns.uniform1i).toHaveBeenCalledWith(uniforms.uMask, 0)
    expect(fns.uniform1i).toHaveBeenCalledWith(uniforms.uCourse, 1)
    expect(fns.uniform1f).toHaveBeenCalledWith(uniforms.uStep, 1000)
    expect(fns.enable).toHaveBeenCalledWith(BLEND)
    expect(fns.enable).toHaveBeenCalledWith(SCISSOR_TEST)
  })

  it('throws shader and program info logs (with fallbacks) when setUp fails', async () => {
    mockGL({ parallel: false, compiles: false, shaderInfoLog: 'bad vertex' })
    let p = await painter()
    expect(() => p.setUp()).toThrow('bad vertex')

    mockGL({ parallel: false, compiles: false, shaderInfoLog: null })
    p = await painter()
    expect(() => p.setUp()).toThrow('shader')

    mockGL({ parallel: false, links: false, programInfoLog: 'link mismatch' })
    p = await painter()
    expect(() => p.setUp()).toThrow('link mismatch')

    mockGL({ parallel: false, links: false, programInfoLog: null })
    p = await painter()
    expect(() => p.setUp()).toThrow('program')
  })

  it('uploads mask texture with byte alignment in setMask', async () => {
    const { fns } = mockGL({ parallel: false })
    const p = await painter()
    await p.ready()
    fns.texImage2D.mockClear()

    const field = new Uint8Array([10, 20, 30, 40, 50, 60])
    p.setMask(3, 2, field)

    expect(fns.pixelStorei).toHaveBeenCalledWith(UNPACK_ALIGNMENT, 1)
    expect(fns.texImage2D).toHaveBeenCalledWith(TEXTURE_2D, 0, R8, 3, 2, 0, RED, UNSIGNED_BYTE, field)
  })

  it('sets uPaper uniform in setPaper', async () => {
    const { fns, uniforms } = mockGL({ parallel: false })
    const p = await painter()
    await p.ready()

    const paper: RGB = [0.96, 0.94, 0.9]
    p.setPaper(paper)

    expect(fns.uniform3f).toHaveBeenCalledWith(uniforms.uPaper, 0.96, 0.94, 0.9)
  })

  it('uploads RG32F course texture on TEXTURE1, restores TEXTURE0, and sets uStep in setCourse', async () => {
    const { fns, uniforms } = mockGL({ parallel: false })
    const p = await painter()
    await p.ready()
    fns.activeTexture.mockClear()
    fns.texImage2D.mockClear()
    fns.uniform1f.mockClear()

    const points = new Float32Array([100, 25, 110, 30, 120, 35])
    p.setCourse({ step: 64, points })

    expect(fns.activeTexture.mock.calls).toEqual([[TEXTURE1], [TEXTURE0]])
    expect(fns.texImage2D).toHaveBeenCalledWith(TEXTURE_2D, 0, RG32F, 3, 1, 0, RG, FLOAT, points)
    expect(fns.uniform1f).toHaveBeenCalledWith(uniforms.uStep, 64)
  })
})

describe('Painter.paint', () => {
  function target2d() {
    return { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D & { drawImage: ReturnType<typeof vi.fn> }
  }

  it('resizes canvas only when rounded pixel dimensions change', async () => {
    mockGL({ parallel: false })
    const p = await painter()
    await p.ready()
    const widthSet = vi.spyOn(p.canvas, 'width', 'set')
    const heightSet = vi.spyOn(p.canvas, 'height', 'set')
    const target = target2d()
    const tile: Rect = { x: 0, y: 0, w: 100, h: 50 }

    p.paint(target, tile, tile, [], 2)
    expect(widthSet).toHaveBeenCalledTimes(1)
    expect(heightSet).toHaveBeenCalledTimes(1)
    expect(p.canvas.width).toBe(200)
    expect(p.canvas.height).toBe(100)

    p.paint(target, tile, tile, [], 2)
    expect(widthSet).toHaveBeenCalledTimes(1)
    expect(heightSet).toHaveBeenCalledTimes(1)

    p.paint(target, { x: 0, y: 0, w: 100, h: 60 }, tile, [], 2)
    expect(widthSet).toHaveBeenCalledTimes(2)
    expect(heightSet).toHaveBeenCalledTimes(2)
    expect(p.canvas.height).toBe(120)
  })

  it('returns early without drawing when rect is empty or outside tile', async () => {
    const { fns } = mockGL({ parallel: false })
    const p = await painter()
    await p.ready()
    const target = target2d()
    const tile: Rect = { x: 100, y: 200, w: 50, h: 40 }

    p.paint(target, tile, { x: 110, y: 210, w: 0, h: 10 }, [makeWash()], 1)
    p.paint(target, tile, { x: 110, y: 210, w: 10, h: 0 }, [makeWash()], 1)
    p.paint(target, tile, { x: 150, y: 200, w: 20, h: 20 }, [makeWash()], 1)
    p.paint(target, tile, { x: 100, y: 240, w: 20, h: 20 }, [makeWash()], 1)
    p.paint(target, tile, { x: 0, y: 200, w: 100, h: 20 }, [makeWash()], 1)

    expect(fns.viewport).not.toHaveBeenCalled()
    expect(fns.drawArraysInstanced).not.toHaveBeenCalled()
    expect(target.drawImage).not.toHaveBeenCalled()
  })

  it('sets viewport, flipped scissor, uniforms, clear/blend state, and copies clipped rect to target', async () => {
    const { fns, uniforms, buffers } = mockGL({ parallel: false })
    const p = await painter()
    await p.ready()
    const target = target2d()

    const tile: Rect = { x: 10, y: 20, w: 100, h: 80 }
    const rect: Rect = { x: 25.4, y: 30.2, w: 120, h: 20.5 }
    p.paint(target, tile, rect, [], 2)

    expect(fns.viewport).toHaveBeenCalledWith(0, 0, 200, 160)
    expect(fns.scissor).toHaveBeenCalledWith(30, 160 - 62, 170, 42)
    expect(fns.uniform4f).toHaveBeenCalledWith(uniforms.uTile, 10, 20, 100, 80)
    expect(fns.uniform1f).toHaveBeenCalledWith(uniforms.uPixel, 0.5)
    expect(fns.bindBuffer).toHaveBeenLastCalledWith(ARRAY_BUFFER, buffers[1])
    expect(fns.clearColor).toHaveBeenCalledWith(1, 1, 1, 1)
    expect(fns.clear).toHaveBeenCalledWith(COLOR_BUFFER_BIT)
    expect(fns.blendFunc).toHaveBeenCalledWith(DST_COLOR, ZERO)
    expect(fns.drawArraysInstanced).toHaveBeenCalledWith(TRIANGLE_STRIP, 0, 4, 1)
    expect(target.drawImage).toHaveBeenCalledWith(p.canvas, 30, 20, 170, 42, 30, 20, 170, 42)
  })

  it('culls washes with grow <= 0 and washes outside rect + reachOf', async () => {
    const { fns, uploaded } = mockGL({ parallel: false })
    const p = await painter()
    await p.ready()
    const target = target2d()
    const tile: Rect = { x: 0, y: 0, w: 500, h: 500 }
    const rect: Rect = { x: 200, y: 200, w: 50, h: 50 }

    const washes: Wash[] = [
      makeWash({ x: 210, y: 210, w: 10, h: 10, grow: 0 }),
      makeWash({ x: 210, y: 210, w: 10, h: 10, grow: -0.5 }),
      makeWash({ kind: Kind.Square, x: 156, y: 210, w: 10, h: 10, grow: 1 }),
      makeWash({ kind: Kind.Square, x: 157, y: 210, w: 10, h: 10, grow: 1 }),
      makeWash({ kind: Kind.Puddle, x: 310, y: 210, w: 10, h: 10, grow: 1 }),
      makeWash({ kind: Kind.Puddle, x: 309, y: 210, w: 10, h: 10, grow: 1 }),
      makeWash({ kind: Kind.Bank, x: 210, y: 400, w: 10, h: 10, grow: 1 }),
      makeWash({ kind: Kind.Bank, x: 210, y: 399, w: 10, h: 10, grow: 1 }),
      makeWash({ kind: Kind.Square, x: 210, y: 156, w: 10, h: 10, grow: 1 }),
    ]

    uploaded.length = 0
    p.paint(target, tile, rect, washes, 1)

    expect(fns.drawArraysInstanced).toHaveBeenCalledWith(TRIANGLE_STRIP, 0, 4, 4)
    const packed = uploaded[0]
    expect(packed.length).toBe(4 * 28)
    expect(packed[28]).toBe(157)
    expect(packed[28 * 2]).toBe(309)
    expect(packed[28 * 3 + 1]).toBe(399)
  })

  it('packs paper sentinel data[11] = -1, explicit wash fields, and defaults on omitted fields', async () => {
    const { uploaded } = mockGL({ parallel: false })
    const p = await painter()
    await p.ready()
    const target = target2d()
    const tile: Rect = { x: 0, y: 0, w: 200, h: 200 }

    const full = makeWash({
      kind: Kind.Letter,
      x: 11,
      y: 22,
      w: 33,
      h: 44,
      ink: [0.25, 0.5, 0.75],
      density: 0.8,
      ink2: [0.1, 0.3, 0.9],
      seed: [5, 6, 7, 8],
      grow: 0.65,
      from: [0.2, 0.8],
      field: 12,
      drop: [1, 2, 3, 4],
      extra: [9, 10, 11, 12],
    })

    uploaded.length = 0
    p.paint(target, tile, tile, [full], 1)

    const firstPass = uploaded[0]
    expect(firstPass.length).toBe(2 * 28)
    const expectedPaper = new Float32Array(28)
    expectedPaper[11] = -1
    expect(Array.from(firstPass.slice(0, 28))).toEqual(Array.from(expectedPaper))

    expect(Array.from(firstPass.slice(28, 56))).toEqual([
      11, 22, 33, 44,
      Math.fround(0.25), Math.fround(0.5), Math.fround(0.75), Math.fround(0.8),
      Math.fround(0.1), Math.fround(0.3), Math.fround(0.9), Kind.Letter,
      5, 6, 7, 8,
      Math.fround(0.65), Math.fround(0.2), Math.fround(0.8), 12,
      1, 2, 3, 4,
      9, 10, 11, 12,
    ])

    const minimal = makeWash({
      kind: Kind.Pencil,
      x: 1,
      y: 2,
      w: 3,
      h: 4,
      ink: [0.5, 0.5, 0.5],
      density: 1,
      ink2: [0.25, 0.25, 0.25],
      seed: [0, 0, 0, 0],
      grow: 1,
    })

    uploaded.length = 0
    p.paint(target, tile, tile, [minimal], 1)

    const secondPass = uploaded[0]
    expect(Array.from(secondPass.slice(28 + 16, 56))).toEqual([
      1, 0.5, 0.5, 0,
      0, 0, 0, 0,
      0, 1, 0, 0,
    ])
  })

  it('grows the instance buffer past 256 washes and uploads all instances', async () => {
    const { fns, uploaded } = mockGL({ parallel: false })
    const p = await painter()
    await p.ready()
    const target = target2d()
    const tile: Rect = { x: 0, y: 0, w: 400, h: 400 }

    const washes = Array.from({ length: 260 }, (_, i) => makeWash({ x: i, y: 10, w: 5, h: 5, grow: 1 }))

    uploaded.length = 0
    p.paint(target, tile, tile, washes, 1)

    expect(fns.drawArraysInstanced).toHaveBeenCalledWith(TRIANGLE_STRIP, 0, 4, 261)
    expect(fns.bufferData).toHaveBeenLastCalledWith(ARRAY_BUFFER, expect.any(Float32Array), STREAM_DRAW)
    const packed = uploaded[0]
    expect(packed.length).toBe(261 * 28)
    expect(packed[11]).toBe(-1)
    expect(packed[28]).toBe(0)
    expect(packed[260 * 28]).toBe(259)
  })
})
