import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EditSpeechForm from './_EditForm'

export default async function EditSpeechPage({
  params,
}: {
  params: Promise<{ weddingSlug: string; speechSlug: string }>
}) {
  const { weddingSlug, speechSlug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/weddings/${weddingSlug}/speeches/${speechSlug}/edit`)

  const { data: speech } = await supabase
    .from('speeches')
    .select('*, stanzas:speech_stanzas(*)')
    .eq('slug', speechSlug)
    .single()

  if (!speech) notFound()

  const { data: member } = await supabase
    .from('wedding_members')
    .select('role')
    .eq('wedding_id', speech.wedding_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || !['owner', 'admin'].includes(member.role)) redirect('/')

  // Get hero image public URL if present
  let heroImageUrl: string | null = null
  if (speech.hero_image) {
    const { data } = supabase.storage.from('speech-heroes').getPublicUrl(speech.hero_image)
    heroImageUrl = data.publicUrl
  }

  // Get stanza body (position 1)
  const stanzas = (speech.stanzas ?? []) as { body: string; position: number }[]
  const transcript = stanzas.find((s) => s.position === 1)?.body ?? ''

  return (
    <main className="px-4 pt-8 pb-16 max-w-[720px] mx-auto">
      <h1
        className="font-display tracking-[-0.047em] text-ink-black mb-6"
        style={{ fontSize: '28px', lineHeight: '1.1' }}
      >
        Edit speech
      </h1>
      <EditSpeechForm
        weddingSlug={weddingSlug}
        speechSlug={speechSlug}
        initial={{
          title: speech.title,
          speakerName: speech.speaker_name,
          deliveredAt: speech.delivered_at,
          heroImage: speech.hero_image,
          heroImageUrl,
          transcript,
        }}
      />
    </main>
  )
}
