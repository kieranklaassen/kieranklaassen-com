import { useEffect, useRef } from 'react'

interface Square {
  x: number
  y: number
  opacity: number
  targetOpacity: number
  gradientOffset: number
}

const SQUARE_SIZE = 134

function random(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function SquareBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const context = canvas.getContext('2d')
    if (!context) return

    const baseColor = [random(0, 255), random(0, 255), random(0, 255)]
    let squares: Square[] = []
    let animationFrame = 0

    const resize = () => {
      const shell = canvas.parentElement
      if (!shell) return

      const ratio = window.devicePixelRatio || 1
      const width = shell.clientWidth
      const height = Math.max(shell.scrollHeight, window.innerHeight)
      canvas.width = width * ratio
      canvas.height = height * ratio
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(ratio, 0, 0, ratio, 0, 0)

      squares = []
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

    const draw = () => {
      context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)

      for (const square of squares) {
        square.opacity += (square.targetOpacity - square.opacity) * 0.05

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

      animationFrame = window.requestAnimationFrame(draw)
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
      if (square) square.targetOpacity = random(0, 255)
    }

    resize()
    draw()
    window.addEventListener('resize', resize)
    canvas.addEventListener('pointermove', move)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('pointermove', move)
    }
  }, [])

  return <canvas ref={canvasRef} className="square-background" aria-hidden="true" />
}
