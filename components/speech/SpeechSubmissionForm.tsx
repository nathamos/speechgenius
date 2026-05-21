'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

interface Wedding {
  id: string
  slug: string
  title: string
}

export default function SpeechSubmissionForm({ wedding }: { wedding: Wedding }) {
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [speakerName, setSpeakerName] = useState('')
  const [deliveredAt, setDeliveredAt] = useState('')
  const [transcript, setTranscript] = useState('')
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null)
  const [heroPreview, setHeroPreview] = useState<string | null>(null)

  const [extracting, setExtracting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const docFileRef = useRef<HTMLInputElement>(null)
  const heroFileRef = useRef<HTMLInputElement>(null)

  async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setExtracting(true)
    setError(null)

    const ext = file.name.split('.').pop()?.toLowerCase()

    if (ext === 'txt') {
      const text = await file.text()
      setTranscript(text)
    } else if (ext === 'docx') {
      try {
        const mammoth = await import('mammoth')
        const buffer = await file.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer: buffer })
        setTranscript(result.value)
      } catch {
        setError('Could not read the Word document. Please paste the text manually.')
      }
    } else if (ext === 'pdf') {
      setError('PDF text extraction is not supported yet — please paste the speech text directly.')
    } else {
      setError('Unsupported file type. Upload a .txt or .docx file, or paste the text below.')
    }

    setExtracting(false)
    // Reset so the same file can be re-selected if needed
    e.target.value = ''
  }

  function handleHeroChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setHeroImageFile(file)
    setHeroPreview(URL.createObjectURL(file))
  }

  async function handlePublish() {
    if (!title.trim() || !speakerName.trim() || !transcript.trim()) {
      setError('Title, speaker name, and transcript are required.')
      return
    }

    setLoading(true)
    setError(null)

    // Upload hero image if provided
    let heroImagePath: string | null = null
    if (heroImageFile) {
      const ext = heroImageFile.name.split('.').pop()
      const path = `${wedding.id}/${Date.now()}.${ext}`

      const res = await fetch('/api/signed-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket: 'speech-heroes', path }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(`Hero image upload failed: ${json.error}`)
        setLoading(false)
        return
      }

      const uploadRes = await fetch(json.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': heroImageFile.type },
        body: heroImageFile,
      })

      if (!uploadRes.ok) {
        setError('Hero image upload failed. Please try again.')
        setLoading(false)
        return
      }

      heroImagePath = path
    }

    // Generate slug from title
    const slug = title.trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    // Insert speech as live
    const { data: speech, error: speechError } = await supabase
      .from('speeches')
      .insert({
        wedding_id: wedding.id,
        slug,
        title: title.trim(),
        speaker_name: speakerName.trim(),
        delivered_at: deliveredAt || null,
        hero_image: heroImagePath,
        status: 'live',
      })
      .select('id, slug')
      .single()

    if (speechError || !speech) {
      setError(speechError?.message ?? 'Failed to publish speech.')
      setLoading(false)
      return
    }

    // Insert transcript as a single stanza
    const { error: stanzaError } = await supabase.from('speech_stanzas').insert({
      speech_id: speech.id,
      position: 1,
      body: transcript.trim(),
    })

    if (stanzaError) {
      setError('Speech published but transcript failed to save.')
      setLoading(false)
      return
    }

    router.push(`/weddings/${wedding.slug}/speeches/${speech.slug}`)
  }

  return (
    <main className="flex justify-center px-4 py-8">
      <div className="w-full max-w-[720px]">
        <h1 className="font-display tracking-[-0.047em] text-ink-black mb-8" style={{ fontSize: '28px', lineHeight: '1.1' }}>
          Add a speech — {wedding.title}
        </h1>

        <div className="flex flex-col gap-5">
          {/* Title */}
          <div className="flex flex-col gap-1">
            <label htmlFor="title" className="font-display text-xs tracking-[-0.047em] text-ink-black">
              Speech title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Best man speech"
              className="border border-pale-ash py-1.5 px-2 font-body text-sm text-ink-black bg-canvas-white outline-none w-full focus:border-ink-black"
            />
          </div>

          {/* Speaker name */}
          <div className="flex flex-col gap-1">
            <label htmlFor="speakerName" className="font-display text-xs tracking-[-0.047em] text-ink-black">
              Speaker name
            </label>
            <input
              id="speakerName"
              type="text"
              value={speakerName}
              onChange={(e) => setSpeakerName(e.target.value)}
              placeholder="e.g. James Miller"
              className="border border-pale-ash py-1.5 px-2 font-body text-sm text-ink-black bg-canvas-white outline-none w-full focus:border-ink-black"
            />
          </div>

          {/* Date delivered */}
          <div className="flex flex-col gap-1">
            <label htmlFor="deliveredAt" className="font-display text-xs tracking-[-0.047em] text-ink-black">
              Date delivered <span className="text-pale-ash">(optional)</span>
            </label>
            <input
              id="deliveredAt"
              type="date"
              value={deliveredAt}
              onChange={(e) => setDeliveredAt(e.target.value)}
              className="border border-pale-ash py-1.5 px-2 font-body text-sm text-ink-black bg-canvas-white outline-none w-full focus:border-ink-black"
            />
          </div>

          {/* Hero image */}
          <div className="flex flex-col gap-2">
            <span className="font-display text-xs tracking-[-0.047em] text-ink-black">
              Hero image <span className="text-pale-ash">(optional)</span>
            </span>
            {heroPreview && (
              <div className="w-full border border-pale-ash" style={{ height: '160px' }}>
                <img src={heroPreview} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <button
              type="button"
              onClick={() => heroFileRef.current?.click()}
              className="font-display text-xs tracking-[-0.047em] text-ink-black border border-pale-ash px-3 py-1.5 hover:border-ink-black self-start"
            >
              {heroPreview ? 'Replace image' : 'Upload image'}
            </button>
            <input ref={heroFileRef} type="file" accept="image/*" className="hidden" onChange={handleHeroChange} />
          </div>

          {/* Transcript */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor="transcript" className="font-display text-xs tracking-[-0.047em] text-ink-black">
                Transcript
              </label>
              <button
                type="button"
                onClick={() => docFileRef.current?.click()}
                disabled={extracting}
                className="font-display text-xs tracking-[-0.047em] text-ink-black border border-pale-ash px-2 py-1 hover:border-ink-black disabled:opacity-50"
              >
                {extracting ? 'Reading file…' : 'Import from .txt or .docx'}
              </button>
              <input
                ref={docFileRef}
                type="file"
                accept=".txt,.docx,.pdf"
                className="hidden"
                onChange={handleDocUpload}
              />
            </div>
            <textarea
              id="transcript"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={16}
              placeholder="Paste or type the speech here…"
              className="border border-pale-ash py-2 px-2 font-body text-sm text-ink-black bg-canvas-white outline-none w-full focus:border-ink-black resize-y"
            />
          </div>

          {error && (
            <p className="font-body text-xs text-pale-ash">{error}</p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => router.back()}
              className="font-display text-xs tracking-[-0.047em] text-ink-black border border-pale-ash px-5 py-2.5 hover:border-ink-black"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={loading}
              className="bg-ink-black text-canvas-white font-display text-xs tracking-[-0.047em] px-5 py-2.5 hover:bg-graphite disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Publishing…' : 'Publish speech'}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
