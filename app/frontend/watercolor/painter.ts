import { FRAGMENT, VERTEX } from './shader'

export type RGB = [number, number, number]

export const Kind = { Square: 0, Pencil: 2, Letter: 3, Puddle: 4, Bank: 5, Run: 6 } as const
export type Kind = (typeof Kind)[keyof typeof Kind]

export interface Wash {
  kind: Kind
  x: number
  y: number
  w: number
  h: number
  /** The light one full wash lets through, and what it separates into. */
  ink: RGB
  ink2: RGB
  density: number
  seed: [number, number, number, number]
  /** Letter: its place in the mask. Puddle: how square it is, how dark its rims are. */
  extra?: [number, number, number, number]
  /** Letter: how many page pixels the mask's field reaches. */
  field?: number
  /** Where the wet front starts, 0 to 1. */
  from?: [number, number]
  /** Laid this long after the page opens, and over this long, in milliseconds. */
  delay?: number
  lasts?: number
  grow: number
  /** A drop of water: x, y, radius, strength. */
  drop?: [number, number, number, number]
  /** Which letter of its line it is. */
  index?: number
  /** Takes no drops. */
  still?: boolean
  /** What on the page this wash stands for. */
  stands?: Element
  /** What on the page it leads to when it is pressed. */
  leads?: Element
  /** Lies dry until this element is pointed at or focused. */
  flood?: Element
}

/** A creek from the top of the page to its foot: its middle and half its width, every `step` pixels. */
export interface Course {
  step: number
  points: Float32Array
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const FLOATS = 28
const ATTRIBUTES = ['aRect', 'aInk', 'aInk2', 'aSeed', 'aState', 'aDrop', 'aExtra']

export function reachOf(wash: Wash) {
  return wash.kind === Kind.Bank ? 150 : wash.kind === Kind.Puddle ? 60 : 34
}

/** One WebGL context that paints any part of any page, and is asked only when something changed. */
export class Painter {
  readonly canvas: HTMLCanvasElement
  private gl: WebGL2RenderingContext
  private uniforms: Record<string, WebGLUniformLocation | null> = {}
  private program: WebGLProgram | undefined
  private shaders: WebGLShader[] = []
  private linked = false
  private buffer: WebGLBuffer | null = null
  private data = new Float32Array(FLOATS * 256)

  private static shared: Painter | undefined

  /** The one painter of this window. Going from page to page keeps it. */
  static get(): Painter | undefined {
    return (Painter.shared ??= Painter.make())
  }

  private static make(): Painter | undefined {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: 'low-power',
    })
    if (!gl) return undefined
    try {
      return new Painter(canvas, gl)
    } catch {
      return undefined
    }
  }

  private constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    this.canvas = canvas
    this.gl = gl
    this.compile()
  }

  /** Starts the compiler and asks it nothing: an answer waits until it is done, and the page with it. */
  private compile() {
    const { gl } = this
    const program = gl.createProgram()!
    this.linked = false
    this.program = program
    this.shaders = []
    for (const [type, source] of [
      [gl.VERTEX_SHADER, VERTEX],
      [gl.FRAGMENT_SHADER, FRAGMENT],
    ] as const) {
      const shader = gl.createShader(type)!
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      gl.attachShader(program, shader)
      this.shaders.push(shader)
    }
    gl.linkProgram(program)
  }

  /** Whether it can paint, once the compiler is done. Where a browser cannot say when that is, it is waited for. */
  async ready(): Promise<boolean> {
    const { gl } = this
    const parallel = gl.getExtension('KHR_parallel_shader_compile')
    while (parallel && !this.linked && !gl.isContextLost() && !gl.getProgramParameter(this.program!, parallel.COMPLETION_STATUS_KHR))
      await new Promise((done) => window.setTimeout(done, 8))
    // a lost context is set up again when it is restored
    if (this.linked || gl.isContextLost()) return true
    try {
      this.finish()
      return true
    } catch {
      return false
    }
  }

  setUp() {
    this.compile()
    this.finish()
  }

  private finish() {
    const { gl } = this
    const program = this.program!
    for (const shader of this.shaders)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'shader')
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'program')
    gl.useProgram(program)

    gl.bindVertexArray(gl.createVertexArray())
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW)
    const corner = gl.getAttribLocation(program, 'aCorner')
    gl.enableVertexAttribArray(corner)
    gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0)
    this.buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    ATTRIBUTES.forEach((name, i) => {
      const at = gl.getAttribLocation(program, name)
      if (at < 0) return
      gl.enableVertexAttribArray(at)
      gl.vertexAttribPointer(at, 4, gl.FLOAT, false, FLOATS * 4, i * 16)
      gl.vertexAttribDivisor(at, 1)
    })
    for (const name of ['uTile', 'uPaper', 'uPixel', 'uCourse', 'uStep', 'uMask'])
      this.uniforms[name] = gl.getUniformLocation(program, name)
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 1, 1, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array([0]))
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.uniform1i(this.uniforms.uMask, 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.uniform1i(this.uniforms.uCourse, 1)
    this.setCourse({ step: 1000, points: new Float32Array(4) })
    gl.activeTexture(gl.TEXTURE0)
    gl.enable(gl.BLEND)
    gl.enable(gl.SCISSOR_TEST)
    this.linked = true
  }

  setMask(width: number, height: number, field: Uint8Array) {
    const { gl } = this
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, width, height, 0, gl.RED, gl.UNSIGNED_BYTE, field)
  }

  setPaper(paper: RGB) {
    this.gl.uniform3f(this.uniforms.uPaper, ...paper)
  }

  setCourse({ step, points }: Course) {
    const { gl } = this
    gl.activeTexture(gl.TEXTURE1)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, points.length / 2, 1, 0, gl.RG, gl.FLOAT, points)
    gl.activeTexture(gl.TEXTURE0)
    gl.uniform1f(this.uniforms.uStep, step)
  }

  private put(at: number, wash: Wash) {
    const o = at * FLOATS
    const d = this.data
    d[o] = wash.x
    d[o + 1] = wash.y
    d[o + 2] = wash.w
    d[o + 3] = wash.h
    d.set(wash.ink, o + 4)
    d[o + 7] = wash.density
    d.set(wash.ink2, o + 8)
    d[o + 11] = wash.kind
    d.set(wash.seed, o + 12)
    d[o + 16] = wash.grow
    d[o + 17] = wash.from?.[0] ?? 0.5
    d[o + 18] = wash.from?.[1] ?? 0.5
    d[o + 19] = wash.field ?? 0
    if (wash.drop) d.set(wash.drop, o + 20)
    else d.fill(0, o + 20, o + 24)
    if (wash.extra) d.set(wash.extra, o + 24)
    else d.set([0, 1, 0, 0], o + 24)
  }

  /** Paints `rect` of the page into `target`, whose top left corner is `tile`'s. */
  paint(target: CanvasRenderingContext2D, tile: Rect, rect: Rect, washes: Wash[], ratio: number) {
    const { gl, canvas } = this
    const width = Math.round(tile.w * ratio)
    const height = Math.round(tile.h * ratio)
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
    const x0 = Math.max(0, Math.floor((rect.x - tile.x) * ratio))
    const y0 = Math.max(0, Math.floor((rect.y - tile.y) * ratio))
    const x1 = Math.min(width, Math.ceil((rect.x + rect.w - tile.x) * ratio))
    const y1 = Math.min(height, Math.ceil((rect.y + rect.h - tile.y) * ratio))
    if (x1 <= x0 || y1 <= y0) return

    const here = washes.filter((wash) => {
      const reach = reachOf(wash)
      return (
        wash.grow > 0 &&
        wash.x - reach < rect.x + rect.w &&
        wash.x + wash.w + reach > rect.x &&
        wash.y - reach < rect.y + rect.h &&
        wash.y + wash.h + reach > rect.y
      )
    })
    const needed = (here.length + 1) * FLOATS
    if (this.data.length < needed) this.data = new Float32Array(needed * 2)
    this.data.fill(0, 0, FLOATS)
    this.data[11] = -1 // the paper
    here.forEach((wash, i) => this.put(i + 1, wash))

    gl.viewport(0, 0, width, height)
    gl.scissor(x0, height - y1, x1 - x0, y1 - y0)
    gl.uniform4f(this.uniforms.uTile, tile.x, tile.y, width / ratio, height / ratio)
    gl.uniform1f(this.uniforms.uPixel, 1 / ratio)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferData(gl.ARRAY_BUFFER, this.data.subarray(0, needed), gl.STREAM_DRAW)
    gl.clearColor(1, 1, 1, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.blendFunc(gl.DST_COLOR, gl.ZERO)
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, here.length + 1)
    target.drawImage(canvas, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0)
  }
}
