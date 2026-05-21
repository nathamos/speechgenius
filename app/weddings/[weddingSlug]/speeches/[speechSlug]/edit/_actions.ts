'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function updateSpeech(
  weddingSlug: string,
  speechSlug: string,
  formData: FormData
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: speech } = await supabase
    .from('speeches')
    .select('id, wedding_id')
    .eq('slug', speechSlug)
    .single()

  if (!speech) redirect('/')

  const { data: member } = await supabase
    .from('wedding_members')
    .select('role')
    .eq('wedding_id', speech.wedding_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || !['owner', 'admin'].includes(member.role)) redirect('/')

  const title = (formData.get('title') as string).trim()
  const speakerName = (formData.get('speaker_name') as string).trim()
  const deliveredAt = (formData.get('delivered_at') as string) || null
  const heroImage = (formData.get('hero_image') as string) || null
  const transcript = (formData.get('transcript') as string).trim()

  await supabase
    .from('speeches')
    .update({ title, speaker_name: speakerName, delivered_at: deliveredAt, hero_image: heroImage, updated_at: new Date().toISOString() })
    .eq('id', speech.id)

  // Update the single stanza (position 1)
  await supabase
    .from('speech_stanzas')
    .update({ body: transcript })
    .eq('speech_id', speech.id)
    .eq('position', 1)

  redirect(`/weddings/${weddingSlug}/speeches/${speechSlug}`)
}
