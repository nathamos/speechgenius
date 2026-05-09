'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

interface Wedding {
  id: string
  slug: string
  title: string
}

interface Stanza {
  id: string
  body: string
}

export default function SpeechSubmissionForm({ wedding }: { wedding: Wedding }) {
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [speakerName, setSpeakerName] = useState('')
  const [deliveredAt, setDeliveredAt] = useState('')
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null)
  const [stanzas, setStanzas] = useState<Stanza[]>([{ id: crypto.randomUUID(), body: '' }])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draftSaved, setDraftSaved] = useState(false)

  function addStanza() {
    setStanzas((prev) => [...prev, { id: crypto.randomUUID(), body: '' }])
  }

  function removeStanza(id: string) {
    setStanzas((prev) => prev.filter((s) => s.id !== id))
  }

  function updateStanza(id: string, body: string) {
    setStanzas((prev) => prev.map((s) => (s.id === id ? { ...s, body } : s)))
  }

  function moveStanza(index: number, direction: 'up' | 'down') {
    setStanzas((prev) => {
      const next = [...prev]
      const target = direction === 'up' ? index - 1 : index + 1
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  async function submit(status: 'draft' | 'live') {
    setLoading(true)
    setError(null)
    setDraftSaved(false)

    // 1. Upload hero image if selected
    let heroImagePath: string | null = null
    if (heroImageFile) {
      const ext = heroImageFile.name.split('.').pop()
      const path = `${wedding.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('speech-heroes')
        .upload(path, heroImageFile)
      if (uploadError) {
        setError('Failed to upload hero image. Please try again.')
        setLoading(false)
        return
      }
      heroImagePath = path
    }

    // 2. Generate slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    // 3. Insert speech
    const { data: speech, error: speechError } = await supabase
      .from('speeches')
      .insert({
        wedding_id: wedding.id,
        slug,
        title,
        speaker_name: speakerName,
        delivered_at: deliveredAt || null,
        hero_image: heroImagePath,
        status,
      })
      .select('id, slug')
      .single()

    if (speechError || !speech) {
      setError(speechError?.message ?? 'Failed to save speech. Please try again.')
      setLoading(false)
      return
    }

    // 4. Insert stanzas
    const { error: stanzaError } = await supabase.from('speech_stanzas').insert(
      stanzas.map((s, i) => ({
        speech_id: speech.id,
        position: i + 1,
        body: s.body,
      }))
    )

    if (stanzaError) {
      setError('Speech saved but stanzas failed to save. Please try again.')
      setLoading(false)
      return
    }

    if (status === 'live') {
      router.push(`/weddings/${wedding.slug}/speeches/${speech.slug}`)
    } else {
      setDraftSaved(true)
      setLoading(false)
    }
  }

  return (
    <main className="flex justify-center px-4 py-8">
      <div className="w-full max-w-[720px]">
        <h1 className="font-display tracking-[-0.047em] text-ink-black text-lg mb-8">
          Add a speech
        </h1>

        <div className="flex flex-col gap-4">
          {/* Title */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="title"
              className="font-display text-xs tracking-[-0.047em] text-pale-ash"
            >
              Speech title
            </label>
            <input
              id="title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Best man speech"
              className="border border-pale-ash py-1 px-2 font-body text-base text-ink-black bg-canvas-white outline-none w-full focus:border-ink-black"
            />
          </div>

          {/* Speaker name */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="speakerName"
              className="font-display text-xs tracking-[-0.047em] text-pale-ash"
            >
              Speaker name
            </label>
            <input
              id="speakerName"
              type="text"
              required
              value={speakerName}
              onChange={(e) => setSpeakerName(e.target.value)}
              placeholder="e.g. James Miller"
              className="border border-pale-ash py-1 px-2 font-body text-base text-ink-black bg-canvas-white outline-none w-full focus:border-ink-black"
            />
          </div>

          {/* Date delivered */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="deliveredAt"
              className="font-display text-xs tracking-[-0.047em] text-pale-ash"
            >
              Date delivered
            </label>
            <input
              id="deliveredAt"
              type="date"
              value={deliveredAt}
              onChange={(e) => setDeliveredAt(e.target.value)}
              className="border border-pale-ash py-1 px-2 font-body text-base text-ink-black bg-canvas-white outline-none w-full focus:border-ink-black"
            />
          </div>

          {/* Hero image */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="heroImage"
              className="font-display text-xs tracking-[-0.047em] text-pale-ash"
            >
              Hero image
            </label>
            <input
              id="heroImage"
              type="file"
              accept="image/*"
              onChange={(e) => setHeroImageFile(e.target.files?.[0] ?? null)}
              className="border border-pale-ash py-1 px-2 font-body text-base text-ink-black bg-canvas-white outline-none w-full focus:border-ink-black"
            />
          </div>

          {/* Transcript / Stanza editor */}
          <div className="flex flex-col gap-3">
            <span className="font-display text-xs tracking-[-0.047em] text-pale-ash">
              Transcript
            </span>

            <div className="flex flex-col gap-4">
              {stanzas.map((stanza, index) => (
                <div key={stanza.id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-xs tracking-[-0.047em] text-pale-ash">
                      Stanza {index + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveStanza(index, 'up')}
                        disabled={index === 0}
                        className="font-display text-xs tracking-[-0.047em] text-pale-ash bg-transparent border-none cursor-pointer p-0 disabled:opacity-30 disabled:cursor-not-allowed hover:text-ink-black"
                        aria-label="Move stanza up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStanza(index, 'down')}
                        disabled={index === stanzas.length - 1}
                        className="font-display text-xs tracking-[-0.047em] text-pale-ash bg-transparent border-none cursor-pointer p-0 disabled:opacity-30 disabled:cursor-not-allowed hover:text-ink-black"
                        aria-label="Move stanza down"
                      >
                        ↓
                      </button>
                      {stanzas.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStanza(stanza.id)}
                          className="font-display text-xs tracking-[-0.047em] text-pale-ash bg-transparent border-none cursor-pointer p-0 hover:text-ink-black"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                  <textarea
                    value={stanza.body}
                    onChange={(e) => updateStanza(stanza.id, e.target.value)}
                    rows={4}
                    placeholder="Enter stanza text…"
                    className="border border-pale-ash py-1 px-2 font-body text-base text-ink-black bg-canvas-white outline-none w-full focus:border-ink-black resize-y"
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addStanza}
              className="border border-ink-black bg-transparent text-ink-black font-display text-xs tracking-[-0.047em] px-5 py-2.5 hover:bg-ink-black hover:text-canvas-white self-start"
            >
              Add stanza
            </button>
          </div>

          {/* Error */}
          {error && (
            <p className="font-body text-xs text-pale-ash">{error}</p>
          )}

          {/* Draft saved confirmation */}
          {draftSaved && (
            <p className="font-body text-sm text-ink-black border border-pale-ash px-3 py-2">
              Draft saved.
            </p>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => submit('draft')}
              disabled={loading}
              className="border border-ink-black bg-transparent text-ink-black font-display text-xs tracking-[-0.047em] px-5 py-2.5 hover:bg-ink-black hover:text-canvas-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving…' : 'Save draft'}
            </button>
            <button
              type="button"
              onClick={() => submit('live')}
              disabled={loading}
              className="bg-ink-black text-canvas-white font-display text-xs tracking-[-0.047em] px-5 py-2.5 border-none cursor-pointer hover:bg-graphite disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Publishing…' : 'Publish'}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
