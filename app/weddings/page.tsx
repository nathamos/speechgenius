import Link from 'next/link'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { weddingCookieName } from '@/lib/wedding-cookie'
import NewWeddingButton from './_NewWeddingButton'

interface WeddingRow {
  id: string
  title: string
  slug: string
  date: string | null
  join_mode: string
  speechCount: number
}

function accessLabel(joinMode: string): string {
  if (joinMode === 'open') return 'Open'
  if (joinMode === 'password') return 'Password'
  return 'Invite only'
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default async function WeddingsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: rawWeddings }, { data: speechRows }, { data: memberships }] = await Promise.all([
    supabase
      .from('weddings')
      .select('id, title, slug, date, join_mode, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('speeches')
      .select('wedding_id')
      .eq('status', 'live'),
    user
      ? supabase.from('wedding_members').select('wedding_id').eq('user_id', user.id)
      : Promise.resolve({ data: [] as { wedding_id: string }[] }),
  ])

  // Also include weddings unlocked this session via password cookie
  const cookieStore = await cookies()
  const cookieMemberIds = (rawWeddings ?? [])
    .filter((w) => w.join_mode !== 'open')
    .filter((w) => cookieStore.get(weddingCookieName(w.id))?.value === '1')
    .map((w) => w.id)

  const memberSet = new Set([
    ...(memberships ?? []).map((m) => m.wedding_id),
    ...cookieMemberIds,
  ])

  const speechCountMap: Record<string, number> = {}
  for (const row of speechRows ?? []) {
    speechCountMap[row.wedding_id] = (speechCountMap[row.wedding_id] ?? 0) + 1
  }

  const weddings: WeddingRow[] = (rawWeddings ?? []).map((w) => ({
    id: w.id,
    title: w.title,
    slug: w.slug,
    date: w.date,
    join_mode: w.join_mode,
    speechCount: speechCountMap[w.id] ?? 0,
  }))

  return (
    <main className="px-4 pt-8 pb-16 max-w-[1100px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display tracking-[-0.047em] text-ink-black" style={{ fontSize: '32px', lineHeight: '1.1' }}>
          Weddings
        </h1>
        {user && <NewWeddingButton />}
      </div>

      {weddings.length === 0 ? (
        <p className="font-body text-sm text-pale-ash">No weddings yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {weddings.map((wedding) => {
            const canAccess = wedding.join_mode === 'open' || memberSet.has(wedding.id)
            const href = canAccess
              ? `/weddings/${wedding.slug}`
              : `/weddings/${wedding.slug}/join`
            return (
            <Link
              key={wedding.id}
              href={href}
              className="block border border-pale-ash p-4 no-underline hover:border-ink-black transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="font-display tracking-[-0.047em] text-ink-black" style={{ fontSize: '18px', lineHeight: '1.2' }}>
                  {wedding.title}
                </span>
                <span className="font-display text-xs tracking-[-0.047em] text-pale-ash shrink-0 border border-pale-ash px-1.5 py-0.5">
                  {accessLabel(wedding.join_mode)}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {wedding.date && (
                  <span className="font-body text-xs text-pale-ash">
                    {formatDate(wedding.date)}
                  </span>
                )}
                <span className="font-body text-xs text-pale-ash">
                  {wedding.speechCount === 1
                    ? '1 speech'
                    : `${wedding.speechCount} speeches`}
                </span>
              </div>
            </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
