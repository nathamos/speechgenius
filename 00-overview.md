# Vows & Verses — Project Overview

## What We're Building

A Genius.com-style annotation platform for wedding speeches. Guests invited to a wedding can read the speech transcript, highlight passages, and add annotations that explain the easter eggs, references, and in-jokes layered into the speech. Other guests can comment on and upvote annotations.

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | File-based routing, server components, easy Vercel deploy |
| Database + Auth | Supabase | Magic link auth, RLS, real-time subscriptions, storage |
| Deployment | Vercel (from GitHub) | Zero-config Next.js hosting |
| Rich text editor | Tiptap | Headless, extensible, handles media embeds for annotations |
| Styling | Tailwind v4 | Matches design token system |

## Repository Structure

```
/
├── app/
│   ├── (auth)/
│   │   └── login/
│   ├── weddings/
│   │   └── [weddingSlug]/
│   │       ├── page.tsx                  # Wedding L1 (future)
│   │       └── speeches/
│   │           └── [speechSlug]/
│   │               └── page.tsx          # Speech L1 — Phase 1 scope
├── components/
│   ├── speech/
│   │   ├── SpeechBanner.tsx
│   │   ├── TranscriptView.tsx
│   │   ├── AnnotationSidebar.tsx
│   │   ├── HighlightToolbar.tsx
│   │   └── AnnotationForm.tsx
│   └── ui/                               # Shared primitives
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   └── annotations/
│       └── range-utils.ts                # Character offset helpers
├── supabase/
│   ├── migrations/
│   └── functions/                        # Edge functions
└── public/
```

## Data Hierarchy

```
Wedding
  └── Speech (many per wedding)
        └── Annotation (many per speech, anchored to a text range)
              └── Comment (many per annotation)
```

## Scope for Phase 1

**In scope:** Speech L1 page only.
- Speech banner (hero image, metadata, wedding link)
- Transcript with stanza/paragraph sectioning
- Highlight-to-annotate mechanic
- Annotation sidebar (right, non-overlapping)
- Annotation detail: rich text, media, comments, upvotes
- Guest authentication via magic link
- Wedding access control (three join modes)
- Speech reviewer role

**Out of scope (future phases):**
- Wedding L1 page
- Speech submission + approval flow
- AI annotation consolidation
- Mobile-optimised annotation UI

## Spec Documents

| File | Contents |
|---|---|
| `01-data-model.md` | Full Supabase schema, RLS policies |
| `02-auth-and-access.md` | Auth flow, wedding membership, roles |
| `03-speech-l1.md` | Page layout, component specs, transcript rendering |
| `04-annotation-mechanic.md` | Highlight detection, range storage, sidebar, comments |
| `05-design-system.md` | Tokens, typography, component patterns |
