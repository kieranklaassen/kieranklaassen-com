// @vitest-environment jsdom
import type { ComponentType, ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface SetupArgs {
  el: HTMLElement | null
  App: ComponentType<Record<string, unknown>>
  props: Record<string, unknown>
}

interface InertiaAppConfig {
  pages?: string
  layout: () => unknown
  setup: (args: SetupArgs) => ReactElement | void
}

const mocks = vi.hoisted(() => ({
  createInertiaApp: vi.fn<(config: InertiaAppConfig) => Promise<void>>(),
  createRoot: vi.fn(),
  hydrateRoot: vi.fn(),
  render: vi.fn(),
}))

vi.mock('@inertiajs/react', () => ({
  createInertiaApp: mocks.createInertiaApp,
}))

vi.mock('react-dom/client', () => ({
  createRoot: mocks.createRoot,
  hydrateRoot: mocks.hydrateRoot,
}))

vi.mock('../../looks/shell', () => ({
  LookShell: function MockLookShell() {
    return null
  },
}))

function createDeferredPromise() {
  let reject!: (reason?: unknown) => void
  const promise = new Promise<void>((_, rej) => {
    reject = rej
  })
  let caught: Promise<unknown> | undefined
  const originalCatch = promise.catch.bind(promise)
  promise.catch = ((onRejected?: (reason: unknown) => unknown) => {
    caught = originalCatch(onRejected)
    return caught
  }) as typeof promise.catch
  return {
    promise,
    reject,
    getCaught: () => caught,
  }
}

beforeEach(() => {
  vi.resetModules()
  document.body.innerHTML = ''
  mocks.createInertiaApp.mockReset()
  mocks.createRoot.mockReset()
  mocks.hydrateRoot.mockReset()
  mocks.render.mockReset()
  mocks.createRoot.mockReturnValue({ render: mocks.render })
  mocks.createInertiaApp.mockResolvedValue(undefined)
})

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('inertia entrypoint', () => {
  it('wires createInertiaApp with LookShell as the layout', async () => {
    const { LookShell } = await import('../../looks/shell')
    await import('../../entrypoints/inertia')

    expect(mocks.createInertiaApp).toHaveBeenCalledTimes(1)
    const config = mocks.createInertiaApp.mock.calls[0][0]
    expect(config.layout()).toBe(LookShell)
  })

  it('returns the rendered tree without mounting when el is null (SSR)', async () => {
    await import('../../entrypoints/inertia')
    const config = mocks.createInertiaApp.mock.calls[0][0]
    const App = (props: Record<string, unknown>) => <div data-props={String(props.title)} />
    const props = { title: 'Hello' }

    const result = config.setup({ el: null, App, props })

    expect(result).toBeDefined()
    expect(result?.type).toBe(App)
    expect(result?.props).toEqual(props)
    expect(mocks.hydrateRoot).not.toHaveBeenCalled()
    expect(mocks.createRoot).not.toHaveBeenCalled()
  })

  it('hydrates when el.dataset.serverRendered is "true"', async () => {
    await import('../../entrypoints/inertia')
    const config = mocks.createInertiaApp.mock.calls[0][0]
    const App = (props: Record<string, unknown>) => <main>{String(props.page)}</main>
    const el = document.createElement('div')
    el.dataset.serverRendered = 'true'
    const props = { page: 'home' }

    const result = config.setup({ el, App, props })

    expect(result).toBeUndefined()
    expect(mocks.hydrateRoot).toHaveBeenCalledTimes(1)
    const [hydratedEl, tree] = mocks.hydrateRoot.mock.calls[0] as [HTMLElement, ReactElement]
    expect(hydratedEl).toBe(el)
    expect(tree.type).toBe(App)
    expect(tree.props).toEqual(props)
    expect(mocks.createRoot).not.toHaveBeenCalled()
  })

  it.each<string | undefined>([undefined, 'false'])(
    'creates a fresh root and renders when el.dataset.serverRendered is %s',
    async (serverRendered) => {
      await import('../../entrypoints/inertia')
      const config = mocks.createInertiaApp.mock.calls[0][0]
      const App = (props: Record<string, unknown>) => <main>{String(props.page)}</main>
      const el = document.createElement('div')
      if (serverRendered !== undefined) el.dataset.serverRendered = serverRendered
      const props = { page: 'about' }

      const result = config.setup({ el, App, props })

      expect(result).toBeUndefined()
      expect(mocks.createRoot).toHaveBeenCalledTimes(1)
      expect(mocks.createRoot).toHaveBeenCalledWith(el)
      expect(mocks.render).toHaveBeenCalledTimes(1)
      const [tree] = mocks.render.mock.calls[0] as [ReactElement]
      expect(tree.type).toBe(App)
      expect(tree.props).toEqual(props)
      expect(mocks.hydrateRoot).not.toHaveBeenCalled()
    },
  )

  it('rethrows createInertiaApp rejection when #app exists in the document', async () => {
    const appEl = document.createElement('div')
    appEl.id = 'app'
    document.body.append(appEl)

    const deferred = createDeferredPromise()
    mocks.createInertiaApp.mockReturnValue(deferred.promise)

    await import('../../entrypoints/inertia')

    const boom = new Error('inertia boot failed')
    const caught = deferred.getCaught()
    expect(caught).toBeDefined()
    const assertion = expect(caught).rejects.toBe(boom)
    deferred.reject(boom)
    await assertion
  })

  it('swallows createInertiaApp rejection when #app is absent from the document', async () => {
    const deferred = createDeferredPromise()
    mocks.createInertiaApp.mockReturnValue(deferred.promise)

    await import('../../entrypoints/inertia')

    const caught = deferred.getCaught()
    expect(caught).toBeDefined()
    const assertion = expect(caught).resolves.toBeUndefined()
    deferred.reject(new Error('non-inertia page'))
    await assertion
  })
})
