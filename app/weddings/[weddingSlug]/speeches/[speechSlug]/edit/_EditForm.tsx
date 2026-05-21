'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { updateSpeech } from './_actions'

interface Props {
  weddingSlug: string
  speechSlug: string
  initial: {
    title: string
    speakerName: string
    deliveredAt: string | null
    heroImage: string | null
    heroImageUrl: string | null
    transcript: string
  }
}

export default function EditSpeechForm({ weddingSlug, speechSlug, initial }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'error'>('idle')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(initial.heroImageUrl)
  const [heroPath, setHeroPath] = useState<string | null>(initial.heroImage)

  const fileRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadState('uploading')
    setUploadError(null)

    const ext = file.name.split('.').pop()
    const path = `${speechSlug}/hero-${Date.now()}.${ext}`

    const res = await fetch('/api/signed-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket: 'speech-heroes', path }),
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

    setHeroPath(path)
    const { data } = supabase.storage.from('speech-heroes').getPublicUrl(path)
    setPreviewUrl(data.publicUrl)
    setUploadState('idle')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formRef.current) return
    setLoading(true)

    const fd = new FormData(formRef.current)
    if (heroPath) fd.set('hero_image', heroPath)
    else fd.delete('hero_image')

    await updateSpeech(weddingSlug, speechSlug, fd)
    setLoading(false)
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-5">
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

      {/* Speaker */}
      <div className="flex flex-col gap-1">
        <label className="font-display text-xs tracking-[-0.047em] text-ink-black">Speaker name</label>
        <input
          name="speaker_name"
          type="text"
          required
          defaultValue={initial.speakerName}
          className="border border-pale-ash px-2 py-1.5 font-body text-sm text-ink-black bg-canvas-white outline-none focus:border-ink-black"
        />
      </div>

      {/* Date */}
      <div className="flex flex-col gap-1">
        <label className="font-display text-xs tracking-[-0.047em] text-ink-black">
          Date delivered <span className="text-pale-ash">(optional)</span>
        </label>
        <input
          name="delivered_at"
          type="date"
          defaultValue={initial.deliveredAt ?? ''}
          className="border border-pale-ash px-2 py-1.5 font-body text-sm text-ink-black bg-canvas-white outline-none focus:border-ink-black"
        />
      </div>

      {/* Hero image */}
      <div className="flex flex-col gap-2">
        <span className="font-display text-xs tracking-[-0.047em] text-ink-black">
          Hero image <span className="text-pale-ash">(optional)</span>
        </span>

        {previewUrl && (
          <div className="relative w-full border border-pale-ash" style={{ height: '160px' }}>
            <img src={previewUrl} alt="" className="w-full h-full object-cover" />
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
          {uploadState === 'uploading' ? 'Uploading…' : previewUrl ? 'Replace image' : 'Upload image'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
      </div>

      {/* Transcript */}
      <div className="flex flex-col gap-1">
        <label className="font-display text-xs tracking-[-0.047em] text-ink-black">Transcript</label>
        <textarea
          name="transcript"
          required
          defaultValue={initial.transcript}
          rows={20}
          className="border border-pale-ash px-2 py-1.5 font-body text-sm text-ink-black bg-canvas-white outline-none focus:border-ink-black resize-y"
          style={{ lineHeight: '1.6' }}
        />
      </div>

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
