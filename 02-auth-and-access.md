# 02 — Auth & Access Control

## Authentication

Supabase magic link auth only. No passwords for end users.

### Flow

1. User lands on `/login?next=/weddings/[slug]/speeches/[slug]`
2. Enters email → Supabase sends magic link
3. User clicks link → redirected to `next` param
4. On arrival, access control middleware checks wedding membership (see below)

### Supabase Client Setup

```ts
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  )
}
```

```ts
// lib/supabase/client.ts — browser only
import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

### Middleware

```ts
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Refresh session, protect /weddings/* routes
  // Redirect unauthenticated users to /login?next=<current path>
}

export const config = { matcher: ['/weddings/:path*'] }
```

---

## Wedding Membership & Join Modes

After a user authenticates, they must be a member of the wedding to view its speeches. Membership is checked on every page load via RLS (the query simply returns no rows if the user isn't a member).

### Three Join Modes

| Mode | How a guest joins |
|---|---|
| `open` | Any authenticated user can self-join on first visit |
| `password` | Guest provides a password on the join screen; server validates against bcrypt hash |
| `invite` | Guest must be pre-added to `wedding_members` by an owner |

### Self-Join Edge Function

For `open` and `password` modes, a Supabase Edge Function handles the join:

```
POST /functions/v1/join-wedding
Body: { wedding_id, password? }
Auth: Bearer <user JWT>
```

**Logic:**
1. Fetch wedding `join_mode` and `join_password`
2. If `open`: insert into `wedding_members` (role: `guest`) — idempotent
3. If `password`: bcrypt compare → insert if match, 403 if not
4. If `invite`: 403 always (join only via owner invite)
5. Return `{ joined: true }` or error

### Invite Flow (owner-initiated)

Owners enter an email address in the wedding admin panel. The Edge Function:
1. Looks up or creates the Supabase auth user for that email
2. Inserts into `wedding_members` with role `guest`
3. Triggers a Supabase magic link email to the address

---

## Roles

| Role | Scope | Capabilities |
|---|---|---|
| `owner` | Wedding | Manage members, set join mode, approve speeches, assign reviewers |
| `reviewer` | Speech (appointed per speech by owner) | Approve/reject the speech, remove annotations and comments |
| `guest` | Wedding | Read approved speeches, create annotations, comment, vote |

### Reviewer Assignment

Owners can assign any wedding member as reviewer for a specific speech. This is stored as a `reviewer` role in `wedding_members` scoped at the wedding level for now. (Per-speech reviewer assignment is a future enhancement.)

---

## Auth Guards in Next.js

### Server Component pattern

```ts
// app/weddings/[weddingSlug]/speeches/[speechSlug]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function SpeechPage({ params }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect(`/login?next=/weddings/${params.weddingSlug}/speeches/${params.speechSlug}`)

  const { data: speech } = await supabase
    .from('speeches')
    .select('*, wedding:weddings(*), stanzas:speech_stanzas(*)') 
    .eq('slug', params.speechSlug)
    .single()

  // RLS returns null if user isn't a wedding member or speech isn't approved
  if (!speech) redirect('/weddings/' + params.weddingSlug + '/join')

  return <SpeechL1 speech={speech} user={user} />
}
```

### Join redirect

If `speech` is null because the user isn't a member (not because the speech doesn't exist), the wedding join page handles the appropriate flow based on `join_mode`. Pass `?next=` through so they land back on the speech after joining.
