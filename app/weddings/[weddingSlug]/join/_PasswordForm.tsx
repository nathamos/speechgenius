'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { joinWithPassword } from './_actions'

interface Props {
  weddingId: string
  weddingTitle: string
  next: string
}

export default function PasswordForm({ weddingId, weddingTitle, next }: Props) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await joinWithPassword({ weddingId, password, next })

    if (result?.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    // Server action redirects on success; if we reach here something unexpected happened
    router.refresh()
  }

  return (
    <main className="flex min-h-[calc(100vh-48px)] items-start justify-center pt-16 px-4">
      <div className="w-full max-w-[360px]">
        <h1 className="font-display tracking-[-0.047em] text-ink-black text-lg mb-1">
          {weddingTitle}
        </h1>
        <p className="font-body text-sm text-pale-ash mb-6">
          This wedding is password-protected. Enter the password to access its speeches.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="password"
              className="font-display text-xs tracking-[-0.047em] text-ink-black"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter wedding password"
              className="border border-pale-ash py-1 px-2 font-body text-base text-ink-black bg-canvas-white outline-none w-full focus:border-ink-black"
            />
          </div>

          {error && (
            <p className="font-body text-xs text-pale-ash">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-ink-black text-canvas-white font-display text-xs tracking-[-0.047em] px-5 py-2.5 border-none cursor-pointer hover:bg-graphite disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Joining…' : 'Join'}
          </button>
        </form>
      </div>
    </main>
  )
}
