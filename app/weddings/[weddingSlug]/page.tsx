import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { weddingCookieName } from '@/lib/wedding-cookie'

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function getInitials(displayName: string | null, email: string | null): string {
  if (displayName) {
    const words = displayName.trim().split(/\s+/)
    return words.length >= 2
      ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
      : words[0][0].toUpperCase()
  }
  if (email) return email[0].toUpperCase()
  return '?'
}

interface Member {
  role: string
  display_name: string | null
  email: string | null
}

function MemberCircle({ member, size = 32 }: { member: { display_name: string | null; email: string | null }; size?: number }) {
  const initials = getInitials(member.display_name, member.email)
  return (
    <div
      style={{ width: size, height: size, borderRadius: '50%', fontSize: size * 0.38 }}
      className="bg-pale-ash flex items-center justify-center font-display tracking-[-0.047em] text-ink-black border border-canvas-white shrink-0"
    >
      {initials}
    </div>
  )
}

function OverflowCircle({ count, size = 32 }: { count: number; size?: number }) {
  return (
    <div
      style={{ width: size, height: size, borderRadius: '50%', fontSize: size * 0.34 }}
      className="bg-pale-ash flex items-center justify-center font-display tracking-[-0.047em] text-ink-black border border-canvas-white shrink-0"
    >
      +{count}
    </div>
  )
}

export default async function WeddingPage({
  params,
}: {
  params: Promise<{ weddingSlug: string }>
}) {
  const { weddingSlug } = await params
  const supabase = await createClient()

  const { data: wedding } = await supabase
    .from('weddings')
    .select('id, title, date, join_mode, cover_image, cover_position')
    .eq('slug', weddingSlug)
    .single()

  if (!wedding) notFound()

  const { data: { user } } = await supabase.auth.getUser()

  if (wedding.join_mode !== 'open') {
    const cookieStore = await cookies()
    const hasCookie = cookieStore.get(weddingCookieName(wedding.id))?.value === '1'

    if (!hasCookie) {
      if (!user) redirect(`/weddings/${weddingSlug}/join`)

      const { data: member } = await supabase
        .from('wedding_members')
        .select('id')
        .eq('wedding_id', wedding.id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!member) redirect(`/weddings/${weddingSlug}/join`)
    }
  }

  // Fetch members then profiles separately (no direct FK between wedding_members and profiles)
  const { data: memberRows } = await supabase
    .from('wedding_members')
    .select('role, user_id')
    .eq('wedding_id', wedding.id)
    .order('joined_at', { ascending: true })

  const userIds = (memberRows ?? []).map((m) => m.user_id)
  const { data: profileRows } = userIds.length > 0
    ? await supabase.from('profiles').select('id, display_name, email').in('id', userIds)
    : { data: [] as { id: string; display_name: string | null; email: string | null }[] }

  const profileMap = Object.fromEntries((profileRows ?? []).map((p) => [p.id, p]))

  const members: Member[] = (memberRows ?? []).map((m) => ({
    role: m.role,
    display_name: profileMap[m.user_id]?.display_name ?? null,
    email: profileMap[m.user_id]?.email ?? null,
  }))

  const adminMembers = members.filter((m) => m.role === 'owner' || m.role === 'admin')
  const visibleCircles = members.slice(0, 3)
  const overflowCount = Math.max(0, members.length - 3)

  // Current user's role
  const myMemberRow = user ? (memberRows ?? []).find((m) => m.user_id === user.id) : null
  const isAdmin = myMemberRow?.role === 'owner' || myMemberRow?.role === 'admin'

  // Cover image URL
  let coverUrl: string | null = null
  if (wedding.cover_image) {
    const { data } = supabase.storage.from('wedding-covers').getPublicUrl(wedding.cover_image)
    coverUrl = data.publicUrl
  }

  // Fetch speeches
  const query = supabase
    .from('speeches')
    .select('id, title, speaker_name, slug, status, view_count')
    .eq('wedding_id', wedding.id)
    .order('created_at', { ascending: false })

  const { data: speeches } = isAdmin ? await query : await query.eq('status', 'live')

  return (
    <main className="pb-16 max-w-[1100px] mx-auto">
      {/* Hero image */}
      {coverUrl && (
        <div className="w-full mb-6" style={{ height: '320px' }}>
          <img
            src={coverUrl}
            alt={wedding.title}
            className="w-full h-full object-cover"
            style={{ objectPosition: wedding.cover_position }}
          />
        </div>
      )}

      <div className={coverUrl ? 'px-4' : 'px-4 pt-8'}>
        {/* Header row */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <h1
              className="font-display tracking-[-0.047em] text-ink-black"
              style={{ fontSize: '32px', lineHeight: '1.1' }}
            >
              {wedding.title}
            </h1>
            {isAdmin && (
              <Link
                href={`/weddings/${weddingSlug}/edit`}
                className="shrink-0 flex items-center justify-center border border-pale-ash hover:border-ink-black no-underline"
                style={{ width: 28, height: 28, borderRadius: '50%', marginTop: 4 }}
                title="Edit wedding"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </Link>
            )}
          </div>

          {isAdmin && (
            <Link
              href={`/weddings/${weddingSlug}/speeches/new`}
              className="font-display text-xs tracking-[-0.047em] text-canvas-white bg-ink-black px-3 py-1.5 no-underline hover:bg-graphite shrink-0"
            >
              Add speech
            </Link>
          )}
        </div>

        {/* Date */}
        {wedding.date && (
          <p className="font-body text-sm text-pale-ash mb-4">{formatDate(wedding.date)}</p>
        )}

        {/* Admin chips + member circles */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          {/* Owner / admin name chips */}
          {adminMembers.map((m, i) => (
            <span
              key={i}
              className="font-display text-xs tracking-[-0.047em] text-ink-black border border-pale-ash px-2 py-0.5"
            >
              {m.role === 'owner' ? '★ ' : ''}{m.display_name ?? m.email ?? 'Unknown'}
            </span>
          ))}

          {/* Divider if both chips and circles */}
          {adminMembers.length > 0 && members.length > 0 && (
            <span className="text-pale-ash text-xs">·</span>
          )}

          {/* Member circles */}
          <div className="flex items-center" style={{ gap: -6 }}>
            {visibleCircles.map((m, i) => (
              <div key={i} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: visibleCircles.length - i }}>
                <MemberCircle member={m} />
              </div>
            ))}
            {overflowCount > 0 && (
              <div style={{ marginLeft: -8, zIndex: 0 }}>
                <OverflowCircle count={overflowCount} />
              </div>
            )}
          </div>
        </div>

        {/* Speeches */}
        {!speeches || speeches.length === 0 ? (
          <p className="font-body text-sm text-pale-ash">No speeches yet.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-pale-ash">
                <th className="font-display text-xs tracking-[-0.047em] text-pale-ash text-left pb-2 pr-4 w-8">#</th>
                <th className="font-display text-xs tracking-[-0.047em] text-pale-ash text-left pb-2 pr-4">Speech</th>
                <th className="font-display text-xs tracking-[-0.047em] text-pale-ash text-left pb-2 pr-4">Speaker</th>
                {isAdmin && (
                  <th className="font-display text-xs tracking-[-0.047em] text-pale-ash text-left pb-2 pr-4">Status</th>
                )}
                <th className="font-display text-xs tracking-[-0.047em] text-pale-ash text-right pb-2">Views</th>
              </tr>
            </thead>
            <tbody>
              {speeches.map((speech, i) => (
                <tr
                  key={speech.id}
                  className="border-b border-pale-ash hover:bg-pale-ash/20 transition-colors"
                >
                  <td className="font-body text-sm text-pale-ash py-2 pr-4 tabular-nums">{i + 1}</td>
                  <td className="font-body text-sm py-2 pr-4">
                    <Link
                      href={`/weddings/${weddingSlug}/speeches/${speech.slug}`}
                      className="text-ink-black no-underline hover:underline"
                    >
                      {speech.title}
                    </Link>
                  </td>
                  <td className="font-body text-sm text-ink-black py-2 pr-4">{speech.speaker_name}</td>
                  {isAdmin && (
                    <td className="font-body text-sm py-2 pr-4">
                      <span className={speech.status === 'live' ? 'text-ink-black' : 'text-pale-ash'}>
                        {speech.status}
                      </span>
                    </td>
                  )}
                  <td className="font-body text-sm text-ink-black py-2 text-right tabular-nums">
                    {speech.view_count.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  )
}
