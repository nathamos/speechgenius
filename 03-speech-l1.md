# 03 — Speech L1 Page

## URL

```
/weddings/[weddingSlug]/speeches/[speechSlug]
```

## Page Layout

```
┌─────────────────────────────────────────────────────┐
│ NAV (sticky, full-width)                            │
├─────────────────────────────────────────────────────┤
│ BANNER (blush-tone bg, ~380px tall)                 │
│   hero image · speech title · speaker · date ·     │
│   wedding link                                      │
├──────────────────────────────┬──────────────────────┤
│ TRANSCRIPT                   │ ANNOTATION SIDEBAR   │
│ (white bg, flex-1)           │ (320px fixed, white) │
│                              │                      │
│  Stanza 1                    │  [opens on click]    │
│                              │                      │
│  Stanza 2                    │                      │
│  ...                         │                      │
└──────────────────────────────┴──────────────────────┘
```

The transcript + sidebar section uses `display: flex`. The sidebar is always present in the DOM at 320px wide but shows an empty state until an annotation is selected. It does **not** overlay the transcript.

---

## Component: `SpeechBanner`

**Background:** `--color-blush-tone` (`#efc4b2`)

### Contents

| Element | Detail |
|---|---|
| Hero image | Full-bleed background image with `object-fit: cover`, overlaid by a semi-transparent blush tone wash so text is always legible. If no hero image, solid blush tone. |
| Speech title | `--font-custom21879`, display size (~56px), `--color-ink-black`, tight letter-spacing |
| Speaker name | `--font-apple-system`, 16px, `--color-graphite` |
| Date delivered | `--font-apple-system`, 12px, `--color-pale-ash` |
| Wedding link | `--font-custom21879`, 12px, `--color-ink-black`, underline on hover — links to `/weddings/[slug]` |

### Props

```ts
interface SpeechBannerProps {
  title: string
  speakerName: string
  deliveredAt: string | null
  weddingTitle: string
  weddingSlug: string
  heroImageUrl: string | null   // signed URL from Supabase Storage
}
```

### Behaviour

- Hero image is loaded via Next.js `<Image>` with `priority` and `fill` layout
- Signed URL is generated server-side (`createSignedUrl`, expires 1h)
- If `heroImageUrl` is null, banner renders with solid blush tone background

---

## Component: `TranscriptView`

**Background:** `--color-canvas-white`

### Layout

```
padding: 64px 80px (desktop)
max-width: none (fills remaining width after sidebar)
```

### Stanza rendering

Each `speech_stanza` renders as its own block, separated by `2rem` vertical gap. Stanzas are `<p>` tags by default; if the stanza body contains line breaks (`\n`), each line is a separate `<span>` with `display: block`.

```tsx
{speech.stanzas
  .sort((a, b) => a.position - b.position)
  .map(stanza => (
    <StanzaBlock
      key={stanza.id}
      stanza={stanza}
      annotations={annotationsForStanza(stanza, allAnnotations)}
    />
  ))
}
```

### `StanzaBlock`

Renders the stanza body with annotated ranges highlighted inline. Uses a character-offset splitting algorithm to interleave plain text spans and `<AnnotatedSpan>` components.

```tsx
// Pseudo-structure
<p className="stanza">
  <span>plain text before </span>
  <AnnotatedSpan annotationId="..." onClick={openSidebar}>
    the annotated words
  </AnnotatedSpan>
  <span> plain text after</span>
</p>
```

**`AnnotatedSpan` styles:**
- Background: `#000000` at 8% opacity (subtle underline-like wash)
- Bottom border: `1px solid --color-ink-black`
- Cursor: `pointer`
- On hover: background at 16% opacity

### Transcript typography

```css
.stanza {
  font-family: var(--font-apple-system);
  font-size: 18px;
  line-height: 1.75;
  color: var(--color-ink-black);
  margin-bottom: 2rem;
}
```

---

## Data Fetching

All data is fetched server-side in the page component. Annotations are passed as props to `TranscriptView` — no client-side fetch on initial load.

```ts
const { data: annotations } = await supabase
  .from('annotations')
  .select(`
    *,
    author:auth.users(email),
    comments:annotation_comments(
      id, body, created_at,
      author:auth.users(email)
    ),
    votes:annotation_votes(value, user_id)
  `)
  .eq('speech_id', speech.id)
  .eq('status', 'live')
  .order('char_start')
```

Real-time annotation updates (new annotations from other guests) are subscribed to client-side via Supabase Realtime on the `annotations` channel, filtered by `speech_id`.

---

## Empty States

| Condition | Display |
|---|---|
| No stanzas | "This speech has no transcript yet." centered in transcript area |
| No annotations | Sidebar empty state: "Be the first to annotate this speech." with arrow pointing to transcript |
| User not logged in | Sidebar shows "Sign in to annotate" instead of highlight toolbar |
