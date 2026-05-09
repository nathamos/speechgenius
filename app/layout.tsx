import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/Nav'
import './globals.css'

export const metadata: Metadata = {
  title: 'WeddingGenius',
  description: 'Annotation platform for wedding speeches',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <html lang="en">
      <body>
        <Nav user={user} />
        {children}
      </body>
    </html>
  )
}
