import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SpeechSubmissionForm from '@/components/speech/SpeechSubmissionForm'

export default async function NewSpeechPage({
  params,
}: {
  params: Promise<{ weddingSlug: string }>
}) {
  const { weddingSlug } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/weddings/${weddingSlug}/speeches/new`)
  }

  // Fetch wedding by slug
  const { data: wedding } = await supabase
    .from('weddings')
    .select('id, title, slug')
    .eq('slug', weddingSlug)
    .single()

  if (!wedding) notFound()

  // Check role — must be owner or admin
  const { data: member } = await supabase
    .from('wedding_members')
    .select('role')
    .eq('wedding_id', wedding.id)
    .eq('user_id', user.id)
    .single()

  if (!member || !['owner', 'admin'].includes(member.role)) {
    redirect('/')
  }

  return <SpeechSubmissionForm wedding={wedding} />
}
