import { useEffect, useRef } from 'react'

interface Square {
  x: number
  y: number
  opacity: number
  targetOpacity: number
  gradientOffset: number
}

const SQUARE_SIZE = 134
// Easing toward 0 only decays, so it takes minutes to stop changing. Opacity this
// small (of 255) is invisible and too small to affect any later easing step.
const SETTLED_OPACITY = 1e-18

function random(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function SquareBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return
    const shell = canvas.parentElement
    if (!shell) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const baseColor = [random(0, 255), random(0, 255), random(0, 255)]
    let squares: Square[] = []
    let animationFrame = 0
    let hoveredSquare: Square | undefined

    const resize = () => {
      const width = shell.clientWidth
      const height = Math.max(shell.scrollHeight, window.innerHeight)
      canvas.width = width
      canvas.height = height
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(1, 0, 0, 1, 0, 0)

      squares = []
      hoveredSquare = undefined
      for (let x = 0; x < width; x += SQUARE_SIZE) {
        for (let y = 0; y < height; y += SQUARE_SIZE) {
          squares.push({
            x,
            y,
            opacity: random(0, 255),
            targetOpacity: random(0, 255),
            gradientOffset: random(-30, 30),
          })
        }
      }
    }

    const requestDraw = () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(draw)
    }

    const draw = () => {
      animationFrame = 0
      let changed = false
      context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)

      for (const square of squares) {
        const previousOpacity = square.opacity
        square.opacity += (square.targetOpacity - square.opacity) * 0.05
        if (square.opacity !== previousOpacity && square.opacity > SETTLED_OPACITY) changed = true

        const gradient = context.createLinearGradient(
          square.x,
          square.y,
          square.x,
          square.y + SQUARE_SIZE,
        )
        const start = square.opacity / 255
        const end = Math.max(0, square.opacity - 40 + square.gradientOffset) / 255
        gradient.addColorStop(0, `rgba(${baseColor.join(',')},${start})`)
        gradient.addColorStop(1, `rgba(${baseColor.join(',')},${end})`)
        context.fillStyle = gradient
        context.fillRect(square.x, square.y, SQUARE_SIZE, SQUARE_SIZE)
      }

      // Once easing no longer moves any square, every further frame would be
      // identical, so stop until a hover or resize changes one.
      if (!reducedMotion && changed) requestDraw()
    }

    const move = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      const square = squares.find(
        (candidate) =>
          x >= candidate.x &&
          x < candidate.x + SQUARE_SIZE &&
          y >= candidate.y &&
          y < candidate.y + SQUARE_SIZE,
      )
      if (square && square !== hoveredSquare) {
        square.targetOpacity = random(0, 255)
        requestDraw()
      }
      hoveredSquare = square
    }

    resize()
    draw()
    const resizeAndDraw = () => {
      resize()
      if (reducedMotion) draw()
      else requestDraw()
    }
    const resizeObserver = new ResizeObserver(resizeAndDraw)
    resizeObserver.observe(shell)
    window.addEventListener('resize', resizeAndDraw)
    if (!reducedMotion) {
      window.addEventListener('pointermove', move, { passive: true })
      // The browser clears the canvas when it restores a lost context.
      canvas.addEventListener('contextrestored', requestDraw)
    }

    return () => {
      window.cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      window.removeEventListener('resize', resizeAndDraw)
      window.removeEventListener('pointermove', move)
      canvas.removeEventListener('contextrestored', requestDraw)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="square-background"
      style={{ filter: 'url(#square-noise)' }}
      aria-hidden="true"
    />
  )
}
