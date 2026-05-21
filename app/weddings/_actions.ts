'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function createWedding(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/weddings')

  const title = (formData.get('title') as string).trim()
  const date = (formData.get('date') as string) || null
  const joinMode = formData.get('join_mode') as string
  const joinPassword = joinMode === 'password'
    ? (formData.get('join_password') as string).trim()
    : null

  if (!title) return

  const base = slugify(title)
  let slug = base
  let attempt = 1

  while (true) {
    const { data: existing } = await supabase
      .from('weddings')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (!existing) break
    slug = `${base}-${++attempt}`
  }

  const { data: wedding, error } = await supabase
    .from('weddings')
    .insert({ title, slug, date, join_mode: joinMode, join_password: joinPassword })
    .select('id, slug')
    .single()

  if (error || !wedding) throw new Error(error?.message ?? 'Failed to create wedding')

  await supabase
    .from('wedding_members')
    .insert({ wedding_id: wedding.id, user_id: user.id, role: 'owner' })

  redirect(`/weddings/${wedding.slug}`)
}
