'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function updateWedding(weddingSlug: string, formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: wedding } = await supabase
    .from('weddings')
    .select('id')
    .eq('slug', weddingSlug)
    .single()

  if (!wedding) redirect('/')

  const { data: member } = await supabase
    .from('wedding_members')
    .select('role')
    .eq('wedding_id', wedding.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || !['owner', 'admin'].includes(member.role)) redirect('/')

  const title = (formData.get('title') as string).trim()
  const date = (formData.get('date') as string) || null
  const joinMode = formData.get('join_mode') as string
  const joinPassword = joinMode === 'password'
    ? (formData.get('join_password') as string).trim()
    : null
  const coverImage = (formData.get('cover_image') as string) || null
  const coverPosition = (formData.get('cover_position') as string) || 'center'

  await supabase
    .from('weddings')
    .update({ title, date, join_mode: joinMode, join_password: joinPassword, cover_image: coverImage, cover_position: coverPosition, updated_at: new Date().toISOString() })
    .eq('id', wedding.id)

  redirect(`/weddings/${weddingSlug}`)
}
