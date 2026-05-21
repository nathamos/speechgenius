'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { updateWedding } from './_actions'

const FOCAL_GRID = [
  ['top left',    'top center',    'top right'],
  ['center left', 'center',        'center right'],
  ['bottom left', 'bottom center', 'bottom right'],
] as const

type FocalPoint = typeof FOCAL_GRID[number][number]

interface Props {
  weddingSlug: string
  initial: {
    title: string
    date: string | null
    joinMode: string
    joinPassword: string | null
    coverImage: string | null
    coverPosition: string
  }
}

export default function EditForm({ weddingSlug, initial }: Props) {
  const router = useRouter()
  const [joinMode, setJoinMode] = useState(initial.joinMode)
  const [loading, setLoading] = useState(false)
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'error'>('idle')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [focalPoint, setFocalPoint] = useState<FocalPoint>(
    (initial.coverPosition as FocalPoint) ?? 'center'
  )

  // Show existing cover or a local preview before/after upload
  const existingUrl = initial.coverImage
    ? supabase.storage.from('wedding-covers').getPublicUrl(initial.coverImage).data.publicUrl
    : null
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingUrl)
  const [coverPath, setCoverPath] = useState<string | null>(initial.coverImage)

  const fileRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadState('uploading')
    setUploadError(null)

    const ext = file.name.split('.').pop()
    const path = `${weddingSlug}/cover-${Date.now()}.${ext}`

    // Get a signed upload URL from the server (avoids client-side auth issues)
    const res = await fetch('/api/signed-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket: 'wedding-covers', path }),
    })
    const json = await res.json()

    if (!res.ok) {
      setUploadState('error')
      setUploadError(`Upload failed: ${json.error}`)
      return
    }

    const uploadRes = await fetch(json.signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    })

    if (!uploadRes.ok) {
      setUploadState('error')
      setUploadError('Upload failed. Please try again.')
      return
    }

    setCoverPath(path)
    const { data } = supabase.storage.from('wedding-covers').getPublicUrl(path)
    setPreviewUrl(data.publicUrl)
    setUploadState('idle')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formRef.current) return
    setLoading(true)

    const fd = new FormData(formRef.current)
    if (coverPath) fd.set('cover_image', coverPath)
    fd.set('cover_position', focalPoint)

    await updateWedding(weddingSlug, fd)
    setLoading(false)
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Cover image */}
      <div className="flex flex-col gap-2">
        <span className="font-display text-xs tracking-[-0.047em] text-ink-black">Cover image</span>

        {previewUrl && (
          <div className="relative w-full border border-pale-ash" style={{ height: '200px' }}>
            <img
              src={previewUrl}
              alt=""
              className="w-full h-full object-cover"
              style={{ objectPosition: focalPoint }}
            />
            {/* Focal point picker — 3×3 grid overlaid on image */}
            <div
              className="absolute inset-0 grid"
              style={{ gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr 1fr', padding: '12px' }}
            >
              {FOCAL_GRID.map((row, ri) =>
                row.map((point, ci) => (
                  <button
                    key={`${ri}-${ci}`}
                    type="button"
                    onClick={() => setFocalPoint(point)}
                    title={point}
                    className="flex items-center justify-center"
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <span
                      style={{
                        display: 'block',
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: focalPoint === point ? '#fff' : 'rgba(255,255,255,0.45)',
                        border: focalPoint === point ? '2px solid #111' : '1.5px solid rgba(255,255,255,0.7)',
                        boxShadow: '0 0 3px rgba(0,0,0,0.4)',
                        transition: 'background 0.1s',
                      }}
                    />
                  </button>
                ))
              )}
            </div>
            {uploadState === 'uploading' && (
              <div className="absolute inset-0 flex items-center justify-center bg-canvas-white/70">
                <span className="font-display text-xs tracking-[-0.047em] text-ink-black">Uploading…</span>
              </div>
            )}
          </div>
        )}

        {uploadError && (
          <p className="font-body text-xs text-pale-ash">{uploadError}</p>
        )}

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploadState === 'uploading'}
          className="font-display text-xs tracking-[-0.047em] text-ink-black border border-pale-ash px-3 py-1.5 hover:border-ink-black self-start disabled:opacity-50"
        >
          {uploadState === 'uploading'
            ? 'Uploading…'
            : previewUrl
            ? 'Replace image'
            : 'Upload image'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
      </div>

      {/* Title */}
      <div className="flex flex-col gap-1">
        <label className="font-display text-xs tracking-[-0.047em] text-ink-black">Title</label>
        <input
          name="title"
          type="text"
          required
          defaultValue={initial.title}
          className="border border-pale-ash px-2 py-1.5 font-body text-sm text-ink-black bg-canvas-white outline-none focus:border-ink-black"
        />
      </div>

      {/* Date */}
      <div className="flex flex-col gap-1">
        <label className="font-display text-xs tracking-[-0.047em] text-ink-black">
          Date <span className="text-pale-ash">(optional)</span>
        </label>
        <input
          name="date"
          type="date"
          defaultValue={initial.date ?? ''}
          className="border border-pale-ash px-2 py-1.5 font-body text-sm text-ink-black bg-canvas-white outline-none focus:border-ink-black"
        />
      </div>

      {/* Access */}
      <div className="flex flex-col gap-1">
        <span className="font-display text-xs tracking-[-0.047em] text-ink-black">Access</span>
        <div className="flex gap-3">
          {(['open', 'password', 'invite'] as const).map((mode) => (
            <label key={mode} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="join_mode"
                value={mode}
                checked={joinMode === mode}
                onChange={() => setJoinMode(mode)}
              />
              <span className="font-body text-sm text-ink-black capitalize">{mode}</span>
            </label>
          ))}
        </div>
      </div>

      {joinMode === 'password' && (
        <div className="flex flex-col gap-1">
          <label className="font-display text-xs tracking-[-0.047em] text-ink-black">Password</label>
          <input
            name="join_password"
            type="text"
            defaultValue={initial.joinPassword ?? ''}
            required
            className="border border-pale-ash px-2 py-1.5 font-body text-sm text-ink-black bg-canvas-white outline-none focus:border-ink-black"
          />
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => router.back()}
          className="font-display text-xs tracking-[-0.047em] text-ink-black border border-pale-ash px-3 py-1.5 hover:border-ink-black"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || uploadState === 'uploading'}
          className="font-display text-xs tracking-[-0.047em] text-canvas-white bg-ink-black px-3 py-1.5 hover:bg-graphite disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}
