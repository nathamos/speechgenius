'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function LoginPage() {
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/'

  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const origin = window.location.origin
    const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSubmitted(true)
    setLoading(false)
  }

  return (
    <main className="flex min-h-[calc(100vh-48px)] items-start justify-center pt-16 px-4">
      <div className="w-full max-w-[360px]">
        <h1 className="font-display tracking-[-0.047em] text-ink-black text-lg mb-1">
          Sign in
        </h1>
        <p className="font-body text-sm text-pale-ash mb-6">
          We&apos;ll send you a magic link — no password needed.
        </p>

        {submitted ? (
          <p className="font-body text-sm text-ink-black border border-pale-ash px-3 py-2">
            Check your inbox — we sent you a magic link.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="email"
                className="font-display text-xs tracking-[-0.047em] text-ink-black"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
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
              {loading ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
