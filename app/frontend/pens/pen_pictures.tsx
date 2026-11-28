import type { Tool } from './pens'

/** Each pen as it stands in the tray, its tip up and in its own ink. */
export function PenPicture({ tool, colour }: { tool: Tool; colour: string }) {
  return (
    <svg viewBox="0 0 30 96" aria-hidden="true">
      {tool === 'pencil' && (
        <>
          <path fill="#e0a842" d="M8 27h14v69H8z" />
          <path fill="#c88d2c" d="M17.5 27H22v69h-4.5z" />
          <path fill="#efd3a6" d="M8 27.5 13.2 11h3.6L22 27.5c-1.8-1.8-3.2-1.8-4.7 0-1.6-1.7-3-1.7-4.6 0-1.5-1.8-2.9-1.8-4.7 0z" />
          <path fill={colour} d="M13.1 11.3 15 4.5l1.9 6.8z" />
        </>
      )}
      {tool === 'liner' && (
        <>
          <path fill="#35303a" d="M9 30h12v66H9z" />
          <path fill={colour} d="M9 36h12v5H9z" />
          <path fill="#8d888f" d="M10 30l2.5-13h5L20 30z" />
          <path fill="none" stroke={colour} strokeWidth="1.6" strokeLinecap="round" d="M15 17V7" />
        </>
      )}
      {tool === 'marker' && (
        <>
          <path fill="#fbf6ea" stroke="#1f1a1d" strokeOpacity=".25" d="M7 31h16v66H7z" />
          <path fill={colour} d="M7 42h16v54H7z" />
          <path fill="#4b4246" d="M9.5 19h11L23 31H7z" />
          <path fill={colour} d="M11.5 19v-7.5c0-4.5 7-4.5 7 0V19z" />
        </>
      )}
      {tool === 'brush' && (
        <>
          <path fill="#7c3b34" d="M11 38h8l1.5 58h-11z" />
          <path fill="#c9b27c" d="M10.5 25h9l-.5 14h-8z" />
          <path fill={colour} d="M10.5 25.5C8.5 17 13 11 16 3.5c1 7.5 6 14 3.5 22z" />
        </>
      )}
      {tool === 'highlighter' && (
        <>
          <path fill={colour} stroke="#1f1a1d" strokeOpacity=".25" d="M5 34h20v63H5z" />
          <path fill="#35303a" d="M8.5 20h13L25 34H5z" />
          <path fill={colour} stroke="#1f1a1d" strokeOpacity=".3" d="M10 20v-6.5L20 8v12z" />
        </>
      )}
      {tool === 'eraser' && (
        <>
          <path fill="#e9a6a0" d="M6 32V17c0-5.5 18-5.5 18 0v15z" />
          <path fill="#2c5f96" d="M5 32h20v64H5z" />
          <path fill="#fbf6ea" d="M5 46h20v8H5z" />
        </>
      )}
    </svg>
  )
}
