import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { weddingCookieName } from '@/lib/wedding-cookie'
import TrendingSpeechesTable from './_SpeechesTable'

export interface SpeechRow {
  id: string
  title: string
  speaker_name: string
  slug: string
  view_count: number
  annotationCount: number
  wedding: {
    id: string
    title: string
    slug: string
    join_mode: string
  } | null
}

export default async function HomePage() {
  const supabase = await createClient()

  const [{ data: { user } }, { data: rawSpeeches }, { data: annotationRows }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('speeches')
      .select('id, title, speaker_name, slug, view_count, wedding_id, weddings(id, title, slug, join_mode)')
      .eq('status', 'live')
      .order('view_count', { ascending: false }),
    supabase
      .from('annotations')
      .select('speech_id')
      .eq('status', 'live'),
  ])

  // Fetch which weddings the signed-in user already belongs to
  let memberWeddingIds: string[] = []
  if (user) {
    const { data: memberships } = await supabase
      .from('wedding_members')
      .select('wedding_id')
      .eq('user_id', user.id)
    memberWeddingIds = (memberships ?? []).map((m) => m.wedding_id)
  }

  // Also include weddings unlocked via session cookie (guest password access)
  const cookieStore = await cookies()
  const cookieIds = (rawSpeeches ?? [])
    .map((s) => {
      const w = Array.isArray(s.weddings) ? (s.weddings[0] ?? null) : (s.weddings ?? null)
      return w as { id: string; join_mode: string } | null
    })
    .filter((w): w is { id: string; join_mode: string } => w !== null && w.join_mode !== 'open')
    .filter((w) => cookieStore.get(weddingCookieName(w.id))?.value === '1')
    .map((w) => w.id)
  memberWeddingIds = [...new Set([...memberWeddingIds, ...cookieIds])]

  const annotationCountMap: Record<string, number> = {}
  for (const row of annotationRows ?? []) {
    annotationCountMap[row.speech_id] = (annotationCountMap[row.speech_id] ?? 0) + 1
  }

  const speeches: SpeechRow[] = (rawSpeeches ?? []).map((s) => {
    const w = Array.isArray(s.weddings) ? (s.weddings[0] ?? null) : (s.weddings ?? null)
    return {
      id: s.id,
      title: s.title,
      speaker_name: s.speaker_name,
      slug: s.slug,
      view_count: s.view_count,
      annotationCount: annotationCountMap[s.id] ?? 0,
      wedding: w as SpeechRow['wedding'],
    }
  })

  return (
    <main className="px-4 pt-8 pb-16 max-w-[1100px] mx-auto">
      <h1 className="font-display tracking-[-0.047em] text-ink-black mb-6" style={{ fontSize: '32px', lineHeight: '1.1' }}>
        Trending Speeches 🔥
      </h1>
      <TrendingSpeechesTable
        speeches={speeches}
        userId={user?.id ?? null}
        userEmail={user?.email ?? null}
        memberWeddingIds={memberWeddingIds}
      />
    </main>
  )
}
