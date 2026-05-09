import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

interface WeddingInfo {
  id: string
  title: string
  slug: string
  join_mode: string
}

interface SpeechRow {
  id: string
  title: string
  speaker_name: string
  slug: string
  view_count: number
  wedding_id: string
  weddings: WeddingInfo | null
  annotationCount: number
}

export default async function HomePage() {
  const supabase = await createClient()

  const { data: rawSpeeches } = await supabase
    .from('speeches')
    .select('id, title, speaker_name, slug, view_count, wedding_id, weddings(id, title, slug, join_mode)')
    .eq('status', 'live')
    .order('view_count', { ascending: false })

  // Fetch annotation counts grouped by speech_id
  const { data: annotationRows } = await supabase
    .from('annotations')
    .select('speech_id')
    .eq('status', 'live')

  const annotationCountMap: Record<string, number> = {}
  for (const row of annotationRows ?? []) {
    annotationCountMap[row.speech_id] = (annotationCountMap[row.speech_id] ?? 0) + 1
  }

  const speeches: SpeechRow[] = (rawSpeeches ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    speaker_name: s.speaker_name,
    slug: s.slug,
    view_count: s.view_count,
    wedding_id: s.wedding_id,
    weddings: (Array.isArray(s.weddings) ? (s.weddings[0] ?? null) : (s.weddings ?? null)) as WeddingInfo | null,
    annotationCount: annotationCountMap[s.id] ?? 0,
  }))

  return (
    <main className="px-4 pt-8 pb-16 max-w-[1100px] mx-auto">
      <h1 className="font-display tracking-[-0.047em] text-ink-black mb-6" style={{ fontSize: '32px', lineHeight: '1.1' }}>
        Speeches
      </h1>

      {speeches.length === 0 ? (
        <p className="font-body text-sm text-pale-ash">No live speeches yet.</p>
      ) : (
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
              const wedding = speech.weddings
              const isOpen = wedding?.join_mode === 'open'
              const weddingSlug = wedding?.slug ?? ''

              const speechHref = isOpen
                ? `/weddings/${weddingSlug}/speeches/${speech.slug}`
                : `/weddings/${weddingSlug}/join`

              const weddingHref = `/weddings/${weddingSlug}/join`

              return (
                <tr
                  key={speech.id}
                  className="border-b border-pale-ash hover:bg-pale-ash/20 transition-colors"
                >
                  <td className="font-body text-sm text-pale-ash py-2 pr-4 tabular-nums">
                    {i + 1}
                  </td>
                  <td className="font-body text-sm text-ink-black py-2 pr-4">
                    <Link
                      href={speechHref}
                      className="text-ink-black no-underline hover:underline"
                    >
                      {speech.title}
                    </Link>
                  </td>
                  <td className="font-body text-sm text-ink-black py-2 pr-4">
                    {speech.speaker_name}
                  </td>
                  <td className="font-body text-sm py-2 pr-4">
                    {wedding ? (
                      <Link
                        href={weddingHref}
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
      )}
    </main>
  )
}
