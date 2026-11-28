import type { Tool } from './pens'

/** Each pen as it stands in the tray, its tip up and in its own ink. */
export function PenPicture({ tool, colour }: { tool: Tool; colour: string }) {
  return (
    <svg viewBox="0 0 30 76" aria-hidden="true">
      {tool === 'pencil' && (
        <>
          <path fill="#e0a842" d="M8 27h14v49H8z" />
          <path fill="#c88d2c" d="M17.500 27H22v49h-4.500z" />
          <path fill="#efd3a6" d="M8 27.500 13.200 11h3.600L22 27.500c-1.800-1.800-3.200-1.800-4.700 0-1.600-1.700-3-1.700-4.600 0-1.500-1.800-2.900-1.800-4.700 0z" />
          <path fill={colour} d="M13.100 11.300 15 4.500l1.900 6.800z" />
        </>
      )}
      {tool === 'liner' && (
        <>
          <path fill="#35303a" d="M9 30h12v46H9z" />
          <path fill={colour} d="M9 36h12v5H9z" />
          <path fill="#8d888f" d="M10 30l2.500-13h5L20 30z" />
          <path fill="none" stroke={colour} strokeWidth="1.600" strokeLinecap="round" d="M15 17V7" />
        </>
      )}
      {tool === 'marker' && (
        <>
          <path fill="#fbf6ea" stroke="#1f1a1d" strokeOpacity=".25" d="M7 31h16v46H7z" />
          <path fill={colour} d="M7 42h16v34H7z" />
          <path fill="#4b4246" d="M9.500 19h11L23 31H7z" />
          <path fill={colour} d="M11.500 19v-7.500c0-4.500 7-4.500 7 0V19z" />
        </>
      )}
      {tool === 'brush' && (
        <>
          <path fill="#7c3b34" d="M11 38h8l1.500 38h-11z" />
          <path fill="#c9b27c" d="M10.500 25h9l-.5 14h-8z" />
          <path fill={colour} d="M10.500 25.500C8.500 17 13 11 16 3.500c1 7.500 6 14 3.500 22z" />
        </>
      )}
      {tool === 'highlighter' && (
        <>
          <path fill={colour} stroke="#1f1a1d" strokeOpacity=".25" d="M5 34h20v43H5z" />
          <path fill="#35303a" d="M8.500 20h13L25 34H5z" />
          <path fill={colour} stroke="#1f1a1d" strokeOpacity=".3" d="M10 20v-6.500L20 8v12z" />
        </>
      )}
      {tool === 'eraser' && (
        <>
          <path fill="#e9a6a0" d="M6 32V17c0-5.500 18-5.500 18 0v15z" />
          <path fill="#2c5f96" d="M5 32h20v44H5z" />
          <path fill="#fbf6ea" d="M5 46h20v8H5z" />
        </>
      )}
    </svg>
  )
}
