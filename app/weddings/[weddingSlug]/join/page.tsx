import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PasswordForm from './_PasswordForm'

interface Props {
  params: Promise<{ weddingSlug: string }>
  searchParams: Promise<{ next?: string }>
}

export default async function JoinPage({ params, searchParams }: Props) {
  const { weddingSlug } = await params
  const { next } = await searchParams
  const destination = next ?? `/weddings/${weddingSlug}`

  const supabase = await createClient()

  const { data: wedding } = await supabase
    .from('weddings')
    .select('id, title, join_mode')
    .eq('slug', weddingSlug)
    .single()

  if (!wedding) notFound()

  // Open weddings need no join step — access is implicit
  if (wedding.join_mode === 'open') {
    redirect(destination)
  }

  // Invite-only wedding
  if (wedding.join_mode === 'invite') {
    return (
      <main className="flex min-h-[calc(100vh-48px)] items-start justify-center pt-16 px-4">
        <div className="w-full max-w-[360px]">
          <h1 className="font-display tracking-[-0.047em] text-ink-black text-lg mb-1">
            {wedding.title}
          </h1>
          <p className="font-body text-sm text-pale-ash">
            You need an invite to access this wedding.
          </p>
        </div>
      </main>
    )
  }

  // Password-protected wedding — check auth before showing the form
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const loginNext = `/weddings/${weddingSlug}/join${next ? `?next=${encodeURIComponent(next)}` : ''}`
    redirect(`/login?next=${encodeURIComponent(loginNext)}`)
  }

  // Already a member? Skip straight through
  const { data: existingMember } = await supabase
    .from('wedding_members')
    .select('id')
    .eq('wedding_id', wedding.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingMember) {
    redirect(destination)
  }

  return (
    <PasswordForm
      weddingId={wedding.id}
      weddingTitle={wedding.title}
      next={destination}
    />
  )
}
