'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { joinWithPassword } from '@/app/weddings/[weddingSlug]/join/_actions'
import type { SpeechRow } from './page'

interface LockedSpeech {
  speech: SpeechRow
  speechUrl: string
}

function AccessModal({
  locked,
  userId,
  userEmail,
  onClose,
}: {
  locked: LockedSpeech
  userId: string | null
  userEmail: string | null
  onClose: () => void
}) {
  const router = useRouter()
  const { speech, speechUrl } = locked
  const wedding = speech.wedding!
  const isPassword = wedding.join_mode === 'password'

  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const loginUrl = `/login?next=${encodeURIComponent(speechUrl)}`

  async function handleJoin() {
    setLoading(true)
    setError(null)
    const result = await joinWithPassword({
      weddingId: wedding.id,
      password,
      next: speechUrl,
    })
    if (result && 'error' in result) {
      setError(result.error)
      setLoading(false)
    }
    // on success joinWithPassword sets cookie + redirects server-side
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.35)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-canvas-white border border-pale-ash p-6 flex flex-col gap-4"
        style={{ width: 360, maxWidth: '90vw' }}
      >
        <div>
          <p className="font-display tracking-[-0.047em] text-ink-black mb-1" style={{ fontSize: '14px' }}>
            {speech.title}
          </p>
          <p className="font-body text-pale-ash" style={{ fontSize: '12px' }}>
            {isPassword
              ? 'This wedding is password-protected. Enter the password to access this speech.'
              : 'This wedding is invite-only. You need an account and invitation to view this speech.'}
          </p>
        </div>

        {isPassword && (
          <div className="flex flex-col gap-2">
            <input
              type="password"
              placeholder="Wedding password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleJoin() }}
              className="border border-pale-ash px-2 py-1.5 font-body text-sm text-ink-black bg-canvas-white outline-none focus:border-ink-black"
              autoFocus
            />
            {error && <p className="font-body text-xs text-pale-ash">{error}</p>}
            <button
              onClick={handleJoin}
              disabled={loading || !password.trim()}
              className="font-display text-xs tracking-[-0.047em] text-canvas-white bg-ink-black px-3 py-1.5 hover:bg-graphite disabled:opacity-50 border-none cursor-pointer"
            >
              {loading ? 'Entering…' : userId ? 'Join' : 'View'}
            </button>
            {!userId && (
              <p className="font-body text-pale-ash" style={{ fontSize: '11px' }}>
                <Link href={loginUrl} className="text-ink-black underline">Sign in</Link>
                {' '}to save your access permanently.
              </p>
            )}
          </div>
        )}

        {!isPassword && (
          <div className="flex flex-col gap-2">
            {!userId ? (
              <>
                <Link
                  href={loginUrl}
                  className="font-display text-xs tracking-[-0.047em] text-canvas-white bg-ink-black px-3 py-1.5 hover:bg-graphite no-underline text-center"
                >
                  Sign in
                </Link>
                <Link
                  href={loginUrl}
                  className="font-display text-xs tracking-[-0.047em] text-ink-black border border-pale-ash px-3 py-1.5 hover:border-ink-black no-underline text-center"
                >
                  Create account
                </Link>
              </>
            ) : (
              <>
                <Link
                  href={`/weddings/${wedding.slug}`}
                  className="font-display text-xs tracking-[-0.047em] text-canvas-white bg-ink-black px-3 py-1.5 hover:bg-graphite no-underline text-center"
                >
                  Go to wedding page
                </Link>
              </>
            )}
          </div>
        )}

        <button
          onClick={onClose}
          className="font-display text-xs tracking-[-0.047em] text-pale-ash bg-transparent border-none cursor-pointer p-0 self-start hover:text-ink-black"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function TrendingSpeechesTable({
  speeches,
  userId,
  userEmail,
  memberWeddingIds,
}: {
  speeches: SpeechRow[]
  userId: string | null
  userEmail: string | null
  memberWeddingIds: string[]
}) {
  const [lockedModal, setLockedModal] = useState<LockedSpeech | null>(null)
  const memberSet = new Set(memberWeddingIds)

  if (speeches.length === 0) {
    return <p className="font-body text-sm text-pale-ash">No live speeches yet.</p>
  }

  return (
    <>
      {lockedModal && (
        <AccessModal
          locked={lockedModal}
          userId={userId}
          userEmail={userEmail}
          onClose={() => setLockedModal(null)}
        />
      )}

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-pale-ash">
            <th className="font-display text-xs tracking-[-0.047em] text-pale-ash text-left pb-2 pr-4 w-8">#</th>
            <th className="font-display text-xs tracking-[-0.047em] text-pale-ash text-left pb-2 pr-4">Speech</th>
            <th className="font-display text-xs tracking-[-0.047em] text-pale-ash text-left pb-2 pr-4">Speaker</th>
            <th className="font-display text-xs tracking-[-0.047em] text-pale-ash text-left pb-2 pr-4">Wedding</th>
            <th className="font-display text-xs tracking-[-0.047em] text-pale-ash text-left pb-2 pr-4 w-8">Access</th>
            <th className="font-display text-xs tracking-[-0.047em] text-pale-ash text-right pb-2 pr-4">Annotations</th>
            <th className="font-display text-xs tracking-[-0.047em] text-pale-ash text-right pb-2">Views</th>
          </tr>
        </thead>
        <tbody>
          {speeches.map((speech, i) => {
            const wedding = speech.wedding
            const isOpen = wedding?.join_mode === 'open'
            const isMember = wedding ? memberSet.has(wedding.id) : false
            const canAccessDirectly = isOpen || isMember
            const weddingSlug = wedding?.slug ?? ''
            const speechUrl = `/weddings/${weddingSlug}/speeches/${speech.slug}`

            return (
              <tr
                key={speech.id}
                className="border-b border-pale-ash hover:bg-pale-ash/20 transition-colors"
              >
                <td className="font-body text-sm text-pale-ash py-2 pr-4 tabular-nums">{i + 1}</td>
                <td className="font-body text-sm text-ink-black py-2 pr-4">
                  {canAccessDirectly ? (
                    <Link href={speechUrl} className="text-ink-black no-underline hover:underline">
                      {speech.title}
                    </Link>
                  ) : (
                    <button
                      onClick={() => setLockedModal({ speech, speechUrl })}
                      className="font-body text-sm text-ink-black bg-transparent border-none p-0 cursor-pointer hover:underline text-left"
                    >
                      {speech.title}
                    </button>
                  )}
                </td>
                <td className="font-body text-sm text-ink-black py-2 pr-4">{speech.speaker_name}</td>
                <td className="font-body text-sm py-2 pr-4">
                  {wedding ? (
                    <Link
                      href={`/weddings/${weddingSlug}`}
                      className="text-ink-black no-underline hover:underline"
                    >
                      {wedding.title}
                    </Link>
                  ) : (
                    <span className="text-pale-ash">—</span>
                  )}
                </td>
                <td className="font-body text-sm text-ink-black py-2 pr-4">
                  {isOpen ? (
                    <span title="Open access">&#128275;</span>
                  ) : (
                    <span title="Password or invite required">&#128274;</span>
                  )}
                </td>
                <td className="font-body text-sm text-ink-black py-2 pr-4 text-right tabular-nums">
                  {speech.annotationCount}
                </td>
                <td className="font-body text-sm text-ink-black py-2 text-right tabular-nums">
                  {speech.view_count.toLocaleString()}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
}
