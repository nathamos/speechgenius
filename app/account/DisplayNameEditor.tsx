'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'

interface Props {
  userId: string
  initialDisplayName: string | null
  email: string | null | undefined
}

export default function DisplayNameEditor({ userId, initialDisplayName, email }: Props) {
  const [displayName, setDisplayName] = useState(initialDisplayName ?? '')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(initialDisplayName ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    const { error: err } = await supabase
      .from('profiles')
      .update({ display_name: draft.trim() || null })
      .eq('id', userId)
    setSaving(false)
    if (err) {
      setError('Failed to save. Please try again.')
      return
    }
    setDisplayName(draft.trim())
    setEditing(false)
  }

  function cancel() {
    setDraft(displayName)
    setEditing(false)
    setError(null)
  }

  return (
    <div className="mb-6">
      <div className="mb-4">
        <p className="font-display text-xs tracking-[-0.047em] text-pale-ash mb-1">Display name</p>
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save()
                if (e.key === 'Escape') cancel()
              }}
              autoFocus
              className="border border-pale-ash py-1 px-2 font-body text-base text-ink-black bg-canvas-white outline-none focus:border-ink-black"
              style={{ width: '260px' }}
            />
            <button
              onClick={save}
              disabled={saving}
              className="bg-ink-black text-canvas-white font-display text-xs tracking-[-0.047em] px-4 py-1.5 border-none cursor-pointer hover:bg-graphite disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={cancel}
              className="bg-transparent text-ink-black font-display text-xs tracking-[-0.047em] px-4 py-1.5 border border-pale-ash cursor-pointer hover:border-ink-black"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setDraft(displayName)
              setEditing(true)
            }}
            className="font-display tracking-[-0.047em] text-ink-black bg-transparent border-none cursor-pointer p-0 hover:opacity-70 text-left"
            style={{ fontSize: '18px', lineHeight: '1.2' }}
          >
            {displayName || <span className="text-pale-ash text-sm">Set a display name</span>}
          </button>
        )}
        {error && (
          <p className="font-body text-xs text-pale-ash mt-1">{error}</p>
        )}
      </div>

      <div>
        <p className="font-display text-xs tracking-[-0.047em] text-pale-ash mb-1">Email</p>
        <p className="font-body text-sm text-ink-black">{email ?? '—'}</p>
      </div>
    </div>
  )
}
