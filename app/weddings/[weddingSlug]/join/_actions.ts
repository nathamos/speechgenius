'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { weddingCookieName } from '@/lib/wedding-cookie'

interface JoinArgs {
  weddingId: string
  password: string
  next: string
}

/**
 * Validates the wedding password and either:
 * - Creates a permanent guest membership (signed-in users)
 * - Sets a session cookie for temporary access (unauthenticated users)
 */
export async function joinWithPassword({
  weddingId,
  password,
  next,
}: JoinArgs): Promise<{ error: string } | never> {
  const supabase = await createClient()

  const { data: wedding } = await supabase
    .from('weddings')
    .select('id, join_password')
    .eq('id', weddingId)
    .single()

  if (!wedding) return { error: 'Wedding not found.' }
  if (wedding.join_password !== password) return { error: 'Incorrect password. Please try again.' }

  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Signed-in: create permanent membership
    const { error: upsertError } = await supabase.from('wedding_members').upsert(
      { wedding_id: weddingId, user_id: user.id, role: 'guest' },
      { onConflict: 'wedding_id,user_id' }
    )
    if (upsertError) return { error: 'Could not join. Please try again.' }
  } else {
    // Guest: set session cookie (expires when browser closes)
    const cookieStore = await cookies()
    cookieStore.set(weddingCookieName(weddingId), '1', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    })
  }

  redirect(next)
}
