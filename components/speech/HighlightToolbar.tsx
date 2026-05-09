'use client'

import { createPortal } from 'react-dom'

interface HighlightToolbarProps {
  rect: DOMRect
  mode: 'available' | 'claimed'
  onAnnotate: () => void
  onClaimedClick: () => void
}

export default function HighlightToolbar({
  rect,
  mode,
  onAnnotate,
  onClaimedClick,
}: HighlightToolbarProps) {
  const top = rect.top - 44
  const left = rect.left + rect.width / 2

  const content = (
    <div
      style={{
        position: 'fixed',
        top,
        left,
        transform: 'translateX(-50%)',
        zIndex: 100,
      }}
      className="bg-ink-black text-canvas-white font-display tracking-[-0.047em] text-xs px-3 py-1.5 whitespace-nowrap"
      // Prevent the toolbar click from collapsing the selection
      onMouseDown={(e) => e.preventDefault()}
    >
      {mode === 'available' ? (
        <button
          onClick={onAnnotate}
          className="text-canvas-white font-display tracking-[-0.047em] text-xs bg-transparent border-none cursor-pointer p-0"
        >
          Annotate
        </button>
      ) : (
        <button
          onClick={onClaimedClick}
          className="text-pale-ash font-display tracking-[-0.047em] text-xs bg-transparent border-none cursor-pointer p-0"
        >
          Already annotated — click to add a comment
        </button>
      )}
    </div>
  )

  // Use document.body as portal target
  if (typeof document === 'undefined') return null
  return createPortal(content, document.body)
}
