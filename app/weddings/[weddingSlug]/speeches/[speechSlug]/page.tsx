import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { buildTranscriptString } from '@/lib/annotations/range-utils'
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
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch speech + wedding + stanzas
  const { data: speech } = await supabase
    .from('speeches')
    .select('*, wedding:weddings(*), stanzas:speech_stanzas(*)')
    .eq('slug', speechSlug)
    .single()

  if (!speech) notFound()

  // Increment view count (fire and forget)
  supabase
    .from('speeches')
    .update({ view_count: speech.view_count + 1 })
    .eq('id', speech.id)

  // Stanzas come back from RLS — null/empty if user can't access content
  const hasAccess = speech.stanzas && speech.stanzas.length > 0

  if (!hasAccess && !user) {
    redirect(`/login?next=/weddings/${weddingSlug}/speeches/${speechSlug}`)
  }
  if (!hasAccess && user) {
    redirect(
      `/weddings/${weddingSlug}/join?next=/weddings/${weddingSlug}/speeches/${speechSlug}`
    )
  }

  // Fetch annotations with votes
  const { data: annotations } = await supabase
    .from('annotations')
    .select('*, votes:annotation_votes(value, user_id)')
    .eq('speech_id', speech.id)
    .eq('status', 'live')
    .order('char_start')

  // Generate signed URL for hero image if present
  let heroImageUrl: string | null = null
  if (speech.hero_image) {
    const { data } = await supabase.storage
      .from('speech-heroes')
      .createSignedUrl(speech.hero_image, 3600)
    heroImageUrl = data?.signedUrl ?? null
  }

  const stanzas = (speech.stanzas ?? []).sort(
    (a: Tables<'speech_stanzas'>, b: Tables<'speech_stanzas'>) =>
      a.position - b.position
  )
  const transcriptString = buildTranscriptString(stanzas)
  const liveAnnotations = (annotations ?? []) as AnnotationWithVotes[]

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
      />
      <SpeechPageClient
        stanzas={stanzas}
        annotations={liveAnnotations}
        transcriptString={transcriptString}
        user={user}
        speechId={speech.id}
      />
    </>
  )
}
