import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { buildTranscriptString } from '@/lib/annotations/range-utils'
import { weddingCookieName } from '@/lib/wedding-cookie'
import SpeechBanner from '@/components/speech/SpeechBanner'
import SpeechPageClient from '@/components/speech/SpeechPageClient'
import type { Tables } from '@/lib/supabase/types'

export type AnnotationWithVotes = Tables<'annotations'> & {
  votes: Array<{ value: number; user_id: string }>
}

export default async function SpeechPage({
  params,
}: {
  params: Promise<{ weddingSlug: string; speechSlug: string }>
}) {
  const { weddingSlug, speechSlug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch speech + wedding + stanzas (stanzas blocked by RLS for non-members)
  const { data: speech } = await supabase
    .from('speeches')
    .select('*, wedding:weddings(*), stanzas:speech_stanzas(*)')
    .eq('slug', speechSlug)
    .single()

  if (!speech) notFound()

  // Increment view count (SECURITY DEFINER bypasses RLS)
  supabase.rpc('increment_speech_view_count', { speech_id: speech.id })

  // Check cookie-based access (guests who entered the wedding password this session)
  const cookieStore = await cookies()
  const hasCookie = cookieStore.get(weddingCookieName(speech.wedding_id))?.value === '1'

  let stanzas: Tables<'speech_stanzas'>[] = speech.stanzas ?? []

  if (stanzas.length === 0 && hasCookie) {
    // Cookie grants access — fetch stanzas via SECURITY DEFINER function
    const { data: bypass } = await supabase.rpc('get_stanzas_bypassing_rls', { p_speech_id: speech.id })
    stanzas = (bypass ?? []) as Tables<'speech_stanzas'>[]
  }

  const hasAccess = stanzas.length > 0

  if (!hasAccess) {
    // Redirect everyone to the join page — it handles both auth'd and guest flows
    redirect(`/weddings/${weddingSlug}/join?next=${encodeURIComponent(`/weddings/${weddingSlug}/speeches/${speechSlug}`)}`)
  }

  // Check if user is admin/owner of this wedding
  let isAdmin = false
  if (user) {
    const { data: member } = await supabase
      .from('wedding_members')
      .select('role')
      .eq('wedding_id', speech.wedding_id)
      .eq('user_id', user.id)
      .maybeSingle()
    isAdmin = member?.role === 'owner' || member?.role === 'admin'
  }

  // Fetch annotations with votes — for cookie-only guests RLS blocks the join query,
  // so fall back to a SECURITY DEFINER function that bypasses RLS
  let liveAnnotations: AnnotationWithVotes[]
  if (hasCookie) {
    const { data: bypass } = await supabase.rpc('get_speech_annotations_with_votes', { p_speech_id: speech.id })
    liveAnnotations = (bypass ?? []) as unknown as AnnotationWithVotes[]
  } else {
    const { data: annotations } = await supabase
      .from('annotations')
      .select('*, votes:annotation_votes(value, user_id)')
      .eq('speech_id', speech.id)
      .eq('status', 'live')
      .order('char_start')
    liveAnnotations = (annotations ?? []) as AnnotationWithVotes[]
  }

  // Build public URL for hero image
  let heroImageUrl: string | null = null
  if (speech.hero_image) {
    const { data } = supabase.storage.from('speech-heroes').getPublicUrl(speech.hero_image)
    heroImageUrl = data.publicUrl
  }

  stanzas.sort((a, b) => a.position - b.position)
  const transcriptString = buildTranscriptString(stanzas)
  const wedding = speech.wedding as Tables<'weddings'> | null

  return (
    <>
      <SpeechBanner
        title={speech.title}
        speakerName={speech.speaker_name}
        deliveredAt={speech.delivered_at}
        weddingTitle={wedding?.title ?? ''}
        weddingSlug={weddingSlug}
        heroImageUrl={heroImageUrl}
        editHref={isAdmin ? `/weddings/${weddingSlug}/speeches/${speechSlug}/edit` : null}
      />
      <SpeechPageClient
        annotations={liveAnnotations}
        transcriptString={transcriptString}
        user={user}
        speechId={speech.id}
      />
    </>
  )
}
