'use client'

import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { supabase } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

interface AnnotationFormProps {
  offsets: {
    start: number
    end: number
    selectedText: string
  }
  speechId: string
  user: User
  onSubmitted: (newAnnotationId: string) => void
  onClose: () => void
}

async function uploadAnnotationMedia(file: File, speechId: string): Promise<string | null> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${speechId}/${crypto.randomUUID()}.${ext}`

  const res = await fetch('/api/signed-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket: 'annotation-media', path }),
  })
  const json = await res.json()
  if (!res.ok) return null

  const uploadRes = await fetch(json.signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  if (!uploadRes.ok) return null

  return path
}

export default function AnnotationForm({
  offsets,
  speechId,
  user,
  onSubmitted,
  onClose,
}: AnnotationFormProps) {
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [overlapError, setOverlapError] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Placeholder.configure({ placeholder: "What's the story behind this?" }),
    ],
    editorProps: {
      attributes: {
        class:
          'font-body text-ink-black min-h-[120px] outline-none focus:outline-none',
        style: 'font-size:16px;line-height:1.5;',
      },
    },
  })

  const handleSubmit = useCallback(async () => {
    if (!editor || editor.isEmpty || submitting) return
    setSubmitting(true)
    setOverlapError(false)

    let mediaUrl: string | null = null
    if (imageFile) {
      mediaUrl = await uploadAnnotationMedia(imageFile, speechId)
    }

    const { data, error } = await supabase
      .from('annotations')
      .insert({
        speech_id: speechId,
        author_id: user.id,
        char_start: offsets.start,
        char_end: offsets.end,
        selected_text: offsets.selectedText,
        body: JSON.stringify(editor.getJSON()),
        media_url: mediaUrl,
      })
      .select('id')
      .single()

    if (error) {
      if (
        error.message?.includes('annotation_overlap') ||
        error.code === '23514' ||
        error.message?.includes('overlap')
      ) {
        setOverlapError(true)
        setSubmitting(false)
        return
      }
      // Generic error — still close so user isn't stuck
      console.error('Annotation insert error:', error)
      setSubmitting(false)
      return
    }

    if (data?.id) {
      onSubmitted(data.id)
    }

    setSubmitting(false)
  }, [editor, imageFile, speechId, user.id, offsets, submitting, onSubmitted])

  const modal = (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="bg-canvas-white w-[560px] max-w-[calc(100vw-32px)] p-5 border border-graphite"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <span className="font-display tracking-[-0.047em] text-ink-black text-xs">
            New annotation
          </span>
          <button
            onClick={onClose}
            className="font-body text-pale-ash text-xs bg-transparent border-none cursor-pointer p-0 hover:text-ink-black"
          >
            ✕
          </button>
        </div>

        {/* Selected text preview */}
        <blockquote className="border-l-2 border-ink-black pl-3 mb-4 font-body text-sm italic text-graphite">
          {offsets.selectedText}
        </blockquote>

        {/* Tiptap editor */}
        <div className="border border-pale-ash p-2 mb-4 focus-within:border-ink-black">
          <EditorContent editor={editor} />
        </div>

        {/* Image upload */}
        <div className="mb-4">
          <label className="font-display tracking-[-0.047em] text-xs text-ink-black block mb-1">
            Image (optional)
          </label>
          <input
            type="file"
            accept="image/*"
            className="font-body text-xs text-ink-black w-full"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
          />
          {imageFile && (
            <p className="font-body text-xs text-pale-ash mt-1">{imageFile.name}</p>
          )}
        </div>

        {/* Overlap error */}
        {overlapError && (
          <p className="font-body text-xs text-ink-black mb-3">
            Someone just annotated that passage — try another selection.
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="font-display tracking-[-0.047em] text-xs text-ink-black border border-ink-black px-4 py-2 bg-transparent cursor-pointer hover:bg-ink-black hover:text-canvas-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !editor || editor.isEmpty}
            className="font-display tracking-[-0.047em] text-xs text-canvas-white bg-ink-black px-4 py-2 border-none cursor-pointer hover:bg-graphite disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Saving…' : 'Save annotation'}
          </button>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modal, document.body)
}
