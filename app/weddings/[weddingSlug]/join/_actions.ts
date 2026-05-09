'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

interface JoinWithPasswordArgs {
  weddingId: string
  password: string
  next: string
}

export async function joinWithPassword({
  weddingId,
  password,
  next,
}: JoinWithPasswordArgs): Promise<{ error: string } | never> {
  const supabase = await createClient()

  // Must be authenticated to join
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // Return an error — the page should have already redirected unauthenticated users
    return { error: 'You must be signed in to join this wedding.' }
  }

  // Fetch the wedding's stored password
  // TODO: replace plain-text comparison with bcrypt once join_password is hashed
  const { data: wedding, error: fetchError } = await supabase
    .from('weddings')
    .select('id, join_password')
    .eq('id', weddingId)
    .single()

  if (fetchError || !wedding) {
    return { error: 'Wedding not found.' }
  }

  if (wedding.join_password !== password) {
    return { error: 'Incorrect password. Please try again.' }
  }

  // Password matched — upsert membership (idempotent)
  const { error: upsertError } = await supabase.from('wedding_members').upsert(
    {
      wedding_id: weddingId,
      user_id: user.id,
      role: 'guest',
    },
    { onConflict: 'wedding_id,user_id' }
  )

  if (upsertError) {
    return { error: 'Could not join the wedding. Please try again.' }
  }

  redirect(next)
}
