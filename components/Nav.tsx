'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export default function Nav({ user }: { user: User | null }) {
  const router = useRouter()

  async function signOut() {
    await supabase.auth.signOut()
    router.refresh()
  }

  return (
    <nav className="sticky top-0 z-10 flex h-6 items-center justify-between border-b border-pale-ash bg-canvas-white px-4">
      <Link
        href="/"
        className="font-display text-xs tracking-[-0.047em] text-ink-black no-underline"
      >
        WeddingGenius
      </Link>

      <div className="flex items-center gap-3">
        {user ? (
          <>
            <Link href="/" className="font-display text-xs tracking-[-0.047em] text-ink-black no-underline">
              Home
            </Link>
            <Link href="/weddings" className="font-display text-xs tracking-[-0.047em] text-ink-black no-underline">
              Weddings
            </Link>
            <Link href="/account" className="font-body text-xs text-pale-ash no-underline">
              {user.email}
            </Link>
            <button
              onClick={signOut}
              className="font-body text-xs text-pale-ash bg-transparent border-none cursor-pointer p-0"
            >
              Sign out
            </button>
          </>
        ) : (
          <Link href="/login" className="font-display text-xs tracking-[-0.047em] text-ink-black no-underline">
            Sign in
          </Link>
        )}
      </div>
    </nav>
  )
}
