import { useEffect, useRef, useState, type ComponentType } from 'react'

type Workspace = ComponentType<{ path: string; startOpen?: boolean }>

const PENCIL_DEFAULT = '#4b4246'

let loaded: Workspace | undefined
let loading: Promise<Workspace> | undefined

function loadWorkspace() {
  return (loading ??= import('./pens_workspace').then((module) => (loaded = module.PensWorkspace)))
}

function hasSavedState(path: string) {
  try {
    return Boolean(localStorage.getItem(`wc-ink:${path}`) || localStorage.getItem('wc-pens'))
  } catch {
    return false
  }
}

/** The pens, and what is drawn with them on one page. Loads the drawing workspace only on demand. */
export function Pens({ path }: { path: string }) {
  const [Workspace, setWorkspace] = useState<Workspace | undefined>(() => loaded)
  const [startOpen, setStartOpen] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (Workspace || !hasSavedState(path)) return
    void loadWorkspace().then((component) => {
      if (mounted.current) setWorkspace(() => component)
    })
  }, [Workspace, path])

  if (Workspace) return <Workspace path={path} startOpen={startOpen} />

  const openTray = () => {
    setStartOpen(true)
    void loadWorkspace().then((component) => {
      if (mounted.current) setWorkspace(() => component)
    })
  }

  return (
    <>
      <div className="wc-ink" aria-hidden="true" />
      <div className="wc-pens" role="group" aria-label="Pens">
        <div className="wc-row">
          <button type="button" className="wc-hold" aria-expanded={false} aria-label="Pens" onClick={openTray}>
            <svg viewBox="0 0 30 96" aria-hidden="true">
              <path fill="#e0a842" d="M8 27h14v69H8z" />
              <path fill="#c88d2c" d="M17.5 27H22v69h-4.5z" />
              <path fill="#efd3a6" d="M8 27.5 13.2 11h3.6L22 27.5c-1.8-1.8-3.2-1.8-4.7 0-1.6-1.7-3-1.7-4.6 0-1.5-1.8-2.9-1.8-4.7 0z" />
              <path fill={PENCIL_DEFAULT} d="M13.1 11.3 15 4.5l1.9 6.8z" />
            </svg>
            <span>Pens</span>
          </button>
        </div>
      </div>
    </>
  )
}
