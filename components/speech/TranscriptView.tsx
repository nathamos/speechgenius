'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { getSelectionOffsets } from '@/lib/annotations/range-utils'
import HighlightToolbar from '@/components/speech/HighlightToolbar'
import AnnotationForm from '@/components/speech/AnnotationForm'
import type { Tables } from '@/lib/supabase/types'
import type { User } from '@supabase/supabase-js'
import type { AnnotationWithVotes } from '@/app/weddings/[weddingSlug]/speeches/[speechSlug]/page'

interface ToolbarState {
  start: number
  end: number
  selectedText: string
  rect: DOMRect
  mode: 'available' | 'claimed'
  claimedAnnotationId?: string
}

interface TranscriptViewProps {
  stanzas: Tables<'speech_stanzas'>[]
  annotations: AnnotationWithVotes[]
  transcriptString: string
  user: User | null
  speechId: string
  onAnnotationClick: (annotationId: string) => void
  activeAnnotationId: string | null
}

// ---------------------------------------------------------------------------
// AnnotatedSpan — a clickable highlighted range
// ---------------------------------------------------------------------------
function AnnotatedSpan({
  text,
  annotationId,
  isActive,
  onClick,
}: {
  text: string
  annotationId: string
  isActive: boolean
  onClick: (id: string) => void
}) {
  return (
    <span
      data-annotation-id={annotationId}
      onClick={() => onClick(annotationId)}
      className={[
        'border-b border-ink-black cursor-pointer transition-colors duration-100',
        isActive ? 'bg-black/[0.14]' : 'bg-black/[0.06] hover:bg-black/[0.14]',
      ].join(' ')}
    >
      {text}
    </span>
  )
}

// ---------------------------------------------------------------------------
// StanzaBlock — splits one stanza into plain + annotated segments
// ---------------------------------------------------------------------------
interface StanzaBlockProps {
  stanza: Tables<'speech_stanzas'>
  // Local offsets for this stanza (pre-computed by TranscriptView)
  localAnnotations: Array<{
    annotationId: string
    localStart: number
    localEnd: number
  }>
  activeAnnotationId: string | null
  onAnnotationClick: (id: string) => void
}

function StanzaBlock({
  stanza,
  localAnnotations,
  activeAnnotationId,
  onAnnotationClick,
}: StanzaBlockProps) {
  const body = stanza.body

  // Build sorted, non-overlapping segments
  const sorted = [...localAnnotations].sort((a, b) => a.localStart - b.localStart)

  type Segment =
    | { type: 'plain'; text: string }
    | { type: 'annotated'; text: string; annotationId: string }

  const segments: Segment[] = []
  let cursor = 0

  for (const ann of sorted) {
    const { localStart, localEnd, annotationId } = ann
    if (localStart > cursor) {
      segments.push({ type: 'plain', text: body.slice(cursor, localStart) })
    }
    if (localEnd > localStart) {
      segments.push({
        type: 'annotated',
        text: body.slice(localStart, localEnd),
        annotationId,
      })
    }
    cursor = Math.max(cursor, localEnd)
  }

  if (cursor < body.length) {
    segments.push({ type: 'plain', text: body.slice(cursor) })
  }

  // Render each segment; within plain segments, render \n as block spans
  function renderText(text: string, keyPrefix: string) {
    const lines = text.split('\n')
    return lines.map((line, i) => (
      <span key={`${keyPrefix}-${i}`} className={i < lines.length - 1 ? 'block' : undefined}>
        {line}
      </span>
    ))
  }

  return (
    <p
      className="font-body text-ink-black mb-8"
      style={{ fontSize: '18px', lineHeight: '1.75' }}
    >
      {segments.map((seg, i) => {
        if (seg.type === 'plain') {
          return (
            <span key={i}>
              {renderText(seg.text, `plain-${i}`)}
            </span>
          )
        }
        return (
          <AnnotatedSpan
            key={`ann-${seg.annotationId}-${i}`}
            text={seg.text}
            annotationId={seg.annotationId}
            isActive={activeAnnotationId === seg.annotationId}
            onClick={onAnnotationClick}
          />
        )
      })}
    </p>
  )
}

// ---------------------------------------------------------------------------
// Main TranscriptView
// ---------------------------------------------------------------------------

/**
 * Maps global char offsets to per-stanza local offsets for rendering.
 * Returns a list of { stanzaId, localStart, localEnd, annotationId }.
 */
function computeLocalAnnotations(
  stanzas: Tables<'speech_stanzas'>[],
  annotations: AnnotationWithVotes[]
): Map<string, Array<{ annotationId: string; localStart: number; localEnd: number }>> {
  const sorted = [...stanzas].sort((a, b) => a.position - b.position)
  const result = new Map<string, Array<{ annotationId: string; localStart: number; localEnd: number }>>()

  for (const stanza of sorted) {
    result.set(stanza.id, [])
  }

  for (const ann of annotations) {
    let cursor = 0
    for (const stanza of sorted) {
      const stanzaStart = cursor
      const stanzaEnd = cursor + stanza.body.length

      if (ann.char_end <= stanzaStart) break
      if (ann.char_start < stanzaEnd) {
        const localStart = Math.max(0, ann.char_start - stanzaStart)
        const localEnd = Math.min(stanza.body.length, ann.char_end - stanzaStart)
        result.get(stanza.id)!.push({
          annotationId: ann.id,
          localStart,
          localEnd,
        })
      }

      cursor = stanzaEnd + 2 // accounts for \n\n separator
    }
  }

  return result
}

export default function TranscriptView({
  stanzas,
  annotations,
  transcriptString,
  user,
  speechId,
  onAnnotationClick,
  activeAnnotationId,
}: TranscriptViewProps) {
  const transcriptRef = useRef<HTMLDivElement>(null)
  const [toolbarState, setToolbarState] = useState<ToolbarState | null>(null)
  const [annotationFormOpen, setAnnotationFormOpen] = useState(false)
  const [pendingOffsets, setPendingOffsets] = useState<{
    start: number
    end: number
    selectedText: string
  } | null>(null)

  // Close toolbar when annotation form opens
  const openAnnotationForm = useCallback(() => {
    if (!toolbarState) return
    setPendingOffsets({
      start: toolbarState.start,
      end: toolbarState.end,
      selectedText: toolbarState.selectedText,
    })
    setAnnotationFormOpen(true)
    setToolbarState(null)
    // Clear selection
    window.getSelection()?.removeAllRanges()
  }, [toolbarState])

  const handleAnnotationSubmitted = useCallback(
    (newAnnotationId: string) => {
      setAnnotationFormOpen(false)
      setPendingOffsets(null)
      onAnnotationClick(newAnnotationId)
    },
    [onAnnotationClick]
  )

  const handleClaimedClick = useCallback(() => {
    if (toolbarState?.claimedAnnotationId) {
      onAnnotationClick(toolbarState.claimedAnnotationId)
    }
    setToolbarState(null)
    window.getSelection()?.removeAllRanges()
  }, [toolbarState, onAnnotationClick])

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed) {
        setToolbarState(null)
        return
      }

      const range = selection.getRangeAt(0)
      const transcriptEl = transcriptRef.current
      if (!transcriptEl?.contains(range.commonAncestorContainer)) {
        setToolbarState(null)
        return
      }

      const offsets = getSelectionOffsets(selection, transcriptEl, transcriptString)
      if (!offsets) {
        setToolbarState(null)
        return
      }

      // Check for overlap with existing annotations (client-side pre-check)
      const overlappingAnn = annotations.find(
        (a) => a.char_start < offsets.end && a.char_end > offsets.start
      )

      const rect = range.getBoundingClientRect()

      if (overlappingAnn) {
        setToolbarState({
          ...offsets,
          rect,
          mode: 'claimed',
          claimedAnnotationId: overlappingAnn.id,
        })
        return
      }

      // Only show "Annotate" if user is logged in
      if (!user) {
        setToolbarState(null)
        return
      }

      setToolbarState({ ...offsets, rect, mode: 'available' })
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [annotations, transcriptString, user])

  const localAnnotationsMap = computeLocalAnnotations(stanzas, annotations)
  const sortedStanzas = [...stanzas].sort((a, b) => a.position - b.position)

  return (
    <>
      <div ref={transcriptRef} className="flex-1 px-10 py-8 bg-canvas-white min-w-0">
        {sortedStanzas.length === 0 ? (
          <p
            className="font-body text-pale-ash text-center"
            style={{ fontSize: '18px', lineHeight: '1.75' }}
          >
            This speech has no transcript yet.
          </p>
        ) : (
          sortedStanzas.map((stanza) => (
            <StanzaBlock
              key={stanza.id}
              stanza={stanza}
              localAnnotations={localAnnotationsMap.get(stanza.id) ?? []}
              activeAnnotationId={activeAnnotationId}
              onAnnotationClick={onAnnotationClick}
            />
          ))
        )}
      </div>

      {toolbarState && (
        <HighlightToolbar
          rect={toolbarState.rect}
          mode={toolbarState.mode}
          onAnnotate={openAnnotationForm}
          onClaimedClick={handleClaimedClick}
        />
      )}

      {annotationFormOpen && pendingOffsets && user && (
        <AnnotationForm
          offsets={pendingOffsets}
          speechId={speechId}
          user={user}
          onSubmitted={handleAnnotationSubmitted}
          onClose={() => {
            setAnnotationFormOpen(false)
            setPendingOffsets(null)
          }}
        />
      )}
    </>
  )
}
