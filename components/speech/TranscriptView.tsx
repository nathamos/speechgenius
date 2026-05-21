'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { getSelectionOffsets } from '@/lib/annotations/range-utils'
import HighlightToolbar from '@/components/speech/HighlightToolbar'
import AnnotationForm from '@/components/speech/AnnotationForm'
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
  annotations: AnnotationWithVotes[]
  transcriptString: string
  user: User | null
  speechId: string
  onAnnotationClick: (annotationId: string) => void
  onAnnotationCreated: (annotation: AnnotationWithVotes) => void
  activeAnnotationId: string | null
}

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

type Segment =
  | { type: 'plain'; text: string }
  | { type: 'annotated'; text: string; annotationId: string }

function buildSegments(transcriptString: string, annotations: AnnotationWithVotes[]): Segment[] {
  const sorted = [...annotations].sort((a, b) => a.char_start - b.char_start)
  const segments: Segment[] = []
  let cursor = 0

  for (const ann of sorted) {
    if (ann.char_start > cursor) {
      segments.push({ type: 'plain', text: transcriptString.slice(cursor, ann.char_start) })
    }
    if (ann.char_end > ann.char_start) {
      segments.push({
        type: 'annotated',
        text: transcriptString.slice(ann.char_start, ann.char_end),
        annotationId: ann.id,
      })
    }
    cursor = Math.max(cursor, ann.char_end)
  }

  if (cursor < transcriptString.length) {
    segments.push({ type: 'plain', text: transcriptString.slice(cursor) })
  }

  return segments
}

export default function TranscriptView({
  annotations,
  transcriptString,
  user,
  speechId,
  onAnnotationClick,
  onAnnotationCreated,
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

  const openAnnotationForm = useCallback(() => {
    if (!toolbarState) return
    setPendingOffsets({
      start: toolbarState.start,
      end: toolbarState.end,
      selectedText: toolbarState.selectedText,
    })
    setAnnotationFormOpen(true)
    setToolbarState(null)
    window.getSelection()?.removeAllRanges()
  }, [toolbarState])

  const handleAnnotationSubmitted = useCallback(
    (newAnnotationId: string) => {
      setAnnotationFormOpen(false)
      // Optimistically add the new annotation so the highlight appears immediately
      if (pendingOffsets && user) {
        onAnnotationCreated({
          id: newAnnotationId,
          speech_id: speechId,
          author_id: user.id,
          char_start: pendingOffsets.start,
          char_end: pendingOffsets.end,
          selected_text: pendingOffsets.selectedText,
          body: null,
          media_url: null,
          upvotes: 0,
          status: 'live',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          votes: [],
        })
      }
      setPendingOffsets(null)
    },
    [pendingOffsets, user, speechId, onAnnotationCreated]
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

      if (!user) {
        setToolbarState(null)
        return
      }

      setToolbarState({ ...offsets, rect, mode: 'available' })
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [annotations, transcriptString, user])

  const segments = buildSegments(transcriptString, annotations)

  return (
    <>
      {/*
        white-space: pre-wrap means \n in text nodes renders as a line break,
        and \n\n renders as a blank line — matching how the transcript was typed.
        Critically, Range.toString() on these text nodes includes the \n characters,
        so getSelectionOffsets() produces offsets consistent with transcriptString.
      */}
      <div
        ref={transcriptRef}
        className="flex-1 px-10 py-8 bg-canvas-white min-w-0 font-body text-ink-black"
        style={{ fontSize: '18px', lineHeight: '1.75', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
      >
        {transcriptString.length === 0 ? (
          <span className="text-pale-ash">This speech has no transcript yet.</span>
        ) : (
          segments.map((seg, i) =>
            seg.type === 'plain' ? (
              <span key={i}>{seg.text}</span>
            ) : (
              <AnnotatedSpan
                key={i}
                text={seg.text}
                annotationId={seg.annotationId}
                isActive={activeAnnotationId === seg.annotationId}
                onClick={onAnnotationClick}
              />
            )
          )
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
