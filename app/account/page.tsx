import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DisplayNameEditor from './DisplayNameEditor'

export default async function AccountPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/account')
  }

  // Profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  // Wedding count
  const { count: weddingCount } = await supabase
    .from('wedding_members')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // Annotation count
  const { count: annotationCount } = await supabase
    .from('annotations')
    .select('*', { count: 'exact', head: true })
    .eq('author_id', user.id)
    .eq('status', 'live')

  // Comment count
  const { count: commentCount } = await supabase
    .from('annotation_comments')
    .select('*', { count: 'exact', head: true })
    .eq('author_id', user.id)

  // Upvotes received: get all annotation ids by user, then sum votes with value > 0
  const { data: userAnnotations } = await supabase
    .from('annotations')
    .select('id')
    .eq('author_id', user.id)

  let upvotesReceived = 0
  if (userAnnotations && userAnnotations.length > 0) {
    const annotationIds = userAnnotations.map((a) => a.id)
    const { data: votes } = await supabase
      .from('annotation_votes')
      .select('value')
      .in('annotation_id', annotationIds)
      .gt('value', 0)
    upvotesReceived = (votes ?? []).reduce((sum, v) => sum + v.value, 0)
  }

  const stats = [
    { label: 'Weddings joined', value: weddingCount ?? 0 },
    { label: 'Annotations', value: annotationCount ?? 0 },
    { label: 'Comments', value: commentCount ?? 0 },
  ]

  return (
    <main className="px-4 pt-8 pb-16 max-w-[640px] mx-auto">
      <h1 className="font-display tracking-[-0.047em] text-ink-black mb-6" style={{ fontSize: '32px', lineHeight: '1.1' }}>
        Account
      </h1>

      <DisplayNameEditor
        userId={user.id}
        initialDisplayName={profile?.display_name ?? null}
        email={user.email}
      />

      <div className="border-t border-pale-ash pt-6">
        <h2 className="font-display text-xs tracking-[-0.047em] text-pale-ash mb-3 uppercase" style={{ letterSpacing: '0.04em' }}>
          Your activity
        </h2>

        <div className="flex gap-3 mb-3">
          {stats.map((stat) => (
            <div key={stat.label} className="border border-pale-ash p-4 flex-1">
              <p
                className="font-display tracking-[-0.047em] text-ink-black"
                style={{ fontSize: '36px', lineHeight: '1', marginBottom: '4px' }}
              >
                {stat.value.toLocaleString()}
              </p>
              <p className="font-display text-xs tracking-[-0.047em] text-pale-ash">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        <div className="border border-pale-ash p-4 inline-block min-w-[140px]">
          <p
            className="font-display tracking-[-0.047em] text-ink-black"
            style={{ fontSize: '36px', lineHeight: '1', marginBottom: '4px' }}
          >
            {upvotesReceived.toLocaleString()}
          </p>
          <p className="font-display text-xs tracking-[-0.047em] text-pale-ash">
            Upvotes received
          </p>
        </div>
      </div>
    </main>
  )
}
