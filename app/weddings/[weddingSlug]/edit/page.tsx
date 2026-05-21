import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EditForm from './_EditForm'

export default async function EditWeddingPage({
  params,
}: {
  params: Promise<{ weddingSlug: string }>
}) {
  const { weddingSlug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/weddings/${weddingSlug}/edit`)

  const { data: wedding } = await supabase
    .from('weddings')
    .select('id, title, date, join_mode, join_password, cover_image, cover_position')
    .eq('slug', weddingSlug)
    .single()

  if (!wedding) notFound()

  const { data: member } = await supabase
    .from('wedding_members')
    .select('role')
    .eq('wedding_id', wedding.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || !['owner', 'admin'].includes(member.role)) redirect('/')

  return (
    <main className="px-4 pt-8 pb-16 max-w-[560px] mx-auto">
      <h1
        className="font-display tracking-[-0.047em] text-ink-black mb-6"
        style={{ fontSize: '28px', lineHeight: '1.1' }}
      >
        Edit wedding
      </h1>
      <EditForm
        weddingSlug={weddingSlug}
        initial={{
          title: wedding.title,
          date: wedding.date,
          joinMode: wedding.join_mode,
          joinPassword: wedding.join_password,
          coverImage: wedding.cover_image,
          coverPosition: wedding.cover_position,
        }}
      />
    </main>
  )
}
