# 02 — Auth & Access Control

## Authentication

Supabase magic link auth only. No passwords for end users.

### Flow

1. User lands on `/login?next=<destination>`
2. Enters email → Supabase sends magic link
3. User clicks link → redirected to `next` param
4. On arrival, access control middleware checks the destination's requirements

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
  // Refresh session on every request
  // Protect /account and /weddings/*/speeches/new (require auth)
  // Redirect unauthenticated users to /login?next=<current path>
}

export const config = { matcher: ['/account', '/weddings/:path*/speeches/new'] }
```

---

## Viewing vs. Annotating

These are two distinct access levels. Viewing does not require an account.

| Action | Requirement |
|---|---|
| View home chart (speech metadata) | None — public |
| View weddings directory | None — public |
| View speech transcript + annotations (open wedding) | None — public |
| View speech transcript + annotations (password wedding) | Must have entered the password at least once (creates membership) |
| View speech transcript + annotations (invite wedding) | Must be a `wedding_member` |
| Create annotations, comments, votes | Must have a WeddingGenius account (`auth.uid() is not null`) + view access above |
| Submit / publish a speech | Must be `owner` or `admin` of the wedding |

---

## Wedding Membership & Join Modes

`wedding_members` tracks who belongs to a wedding. It is used to gate access for password-protected and invite-only weddings. For open weddings, the `can_access_wedding()` RLS helper bypasses the membership check.

### Three Join Modes

| Mode | How a guest joins |
|---|---|
| `open` | Any visitor can view; any authenticated user can annotate — no join step required |
| `password` | Visitor enters the wedding password once → `wedding_members` row inserted (role: `guest`) → permanent access and annotation rights from that point |
| `invite` | Must be pre-added to `wedding_members` by an owner; owner can add by email (see invite flow) |

### Password Join Edge Function

```
POST /functions/v1/join-wedding
Body: { wedding_id, password }
Auth: Bearer <user JWT>  (required — guest must have a WeddingGenius account)
```

**Logic:**
1. Fetch wedding `join_mode` and `join_password`
2. bcrypt compare input password against `join_password`
3. If match: upsert into `wedding_members` (role: `guest`) — idempotent
4. If no match: 403
5. Return `{ joined: true }` or error

> For `open` weddings the join edge function is not needed — access is implicit.

### Invite Flow (owner-initiated)

Owners or admins enter an email address. The Edge Function:
1. Looks up or creates the Supabase auth user for that email
2. Inserts into `wedding_members` with role `guest`
3. Sends a Supabase magic link email to the address (combining auth + join in one click)
4. If the user already has a WeddingGenius account, they are added immediately; the email is a notification/link to the wedding

---

## Roles

| Role | Appointed by | Capabilities |
|---|---|---|
| `owner` | — (creates the wedding) | Manage members, set join mode, assign admins and reviewers, all admin capabilities |
| `admin` | owner | Submit and publish speeches, manage guests — day-to-day operations |
| `reviewer` | owner | Remove annotations and comments |
| `guest` | self-join or invite | Read speeches, create annotations, comment, vote |

### Role assignment

- `owner` is set when the wedding is created (the creating user)
- `admin` and `reviewer` are assigned by the owner via the wedding admin panel
- `guest` is the default for anyone who joins via any method

---

## Auth Guards in Next.js

### Public pages (no guard needed)

Home (`/`), Weddings directory (`/weddings`), and Speech L1 for open weddings do not require authentication at the page level. RLS enforces content access at the database level.

### Protected pages

```ts
// app/account/page.tsx — example protected page
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AccountPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/account')
  // ...
}
```

### Speech L1 — access check

```ts
// app/weddings/[weddingSlug]/speeches/[speechSlug]/page.tsx
export default async function SpeechPage({ params }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: speech } = await supabase
    .from('speeches')
    .select('*, wedding:weddings(*), stanzas:speech_stanzas(*)')
    .eq('slug', params.speechSlug)
    .single()

  // speech metadata is always readable; stanzas are null if RLS blocks access
  if (!speech) notFound()

  const hasTranscript = speech.stanzas?.length > 0

  if (!hasTranscript && !user) {
    redirect(`/login?next=/weddings/${params.weddingSlug}/speeches/${params.speechSlug}`)
  }

  if (!hasTranscript && user) {
    redirect(`/weddings/${params.weddingSlug}/join?next=...`)
  }

  return <SpeechL1 speech={speech} user={user} />
}
```

### Speech submission guard

```ts
// app/weddings/[weddingSlug]/speeches/new/page.tsx
export default async function NewSpeechPage({ params }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/weddings/${params.weddingSlug}/speeches/new`)

  // Check admin or owner role
  const { data: member } = await supabase
    .from('wedding_members')
    .select('role')
    .eq('wedding_id', ...) // resolved from slug
    .eq('user_id', user.id)
    .single()

  if (!member || !['owner', 'admin'].includes(member.role)) redirect('/')

  return <SpeechSubmissionForm weddingId={...} />
}
```
