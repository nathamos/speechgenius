# 04 — Annotation Mechanic

## Overview

1. Authenticated guest selects text in the transcript
2. A toolbar popover appears above the selection
3. Guest clicks "Annotate" → annotation form modal opens
4. Guest submits rich text + optional image
5. Highlighted range is claimed — no other user can annotate the same range
6. Other guests click the highlighted range → sidebar opens with annotation detail
7. Guests can comment and upvote from the sidebar

---

## Text Range Detection

### Character offsets

Annotations are stored as `char_start` / `char_end` offsets against the full speech transcript string. The full string is computed as:

```ts
// lib/annotations/range-utils.ts

export function buildTranscriptString(stanzas: Stanza[]): string {
  return stanzas
    .sort((a, b) => a.position - b.position)
    .map(s => s.body)
    .join('\n\n')
}

export function getSelectionOffsets(
  selection: Selection,
  transcriptEl: HTMLElement,
  transcriptString: string
): { start: number; end: number; selectedText: string } | null {
  // Walk the DOM to compute character offset relative to transcriptEl
  // Return null if selection crosses a stanza boundary in a way
  // that maps to an inconsistent range
}

export function offsetsToStanzaRanges(
  start: number,
  end: number,
  stanzas: Stanza[]
): { stanzaId: string; localStart: number; localEnd: number }[] {
  // Map global offsets back to per-stanza local offsets for rendering
}
```

### Selection listener

```tsx
// TranscriptView.tsx (client component)
useEffect(() => {
  const handleSelectionChange = () => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) {
      setToolbarState(null)
      return
    }

    const range = selection.getRangeAt(0)
    const transcriptEl = transcriptRef.current
    if (!transcriptEl?.contains(range.commonAncestorContainer)) return

    const offsets = getSelectionOffsets(selection, transcriptEl, transcriptString)
    if (!offsets) return

    // Check for overlap with existing annotations (client-side pre-check)
    const overlaps = annotations.some(a =>
      a.char_start < offsets.end && a.char_end > offsets.start
    )
    if (overlaps) {
      // Show "already annotated" tooltip instead of annotate button
      setToolbarState({ ...offsets, mode: 'claimed' })
      return
    }

    const rect = range.getBoundingClientRect()
    setToolbarState({ ...offsets, rect, mode: 'available' })
  }

  document.addEventListener('selectionchange', handleSelectionChange)
  return () => document.removeEventListener('selectionchange', handleSelectionChange)
}, [annotations, transcriptString])
```

---

## Component: `HighlightToolbar`

A small popover that appears above the user's selection.

### States

| State | Display |
|---|---|
| `available` | "Annotate" button (black, sharp corners) |
| `claimed` | "Already annotated — click to view" (grey, no button) |

### Positioning

Absolutely positioned relative to the viewport using the selection's `getBoundingClientRect()`. Renders via a React portal to avoid clipping by overflow-hidden ancestors.

```tsx
<div
  style={{
    position: 'fixed',
    top: toolbarState.rect.top - 44,
    left: toolbarState.rect.left + toolbarState.rect.width / 2,
    transform: 'translateX(-50%)',
  }}
  className="toolbar"
>
  {toolbarState.mode === 'available'
    ? <button onClick={openAnnotationForm}>Annotate</button>
    : <span>Already annotated</span>
  }
</div>
```

### Design

```css
.toolbar {
  background: var(--color-ink-black);
  color: var(--color-canvas-white);
  font-family: var(--font-custom21879);
  font-size: 12px;
  letter-spacing: -0.047em;
  padding: 6px 12px;
  border-radius: 0;         /* sharp corners per design system */
  white-space: nowrap;
}
```

---

## Component: `AnnotationForm`

A modal (centered overlay) triggered when the user clicks "Annotate".

### Fields

| Field | Component | Required |
|---|---|---|
| Selected text (read-only preview) | `<blockquote>` | — |
| Annotation body | Tiptap editor | Yes |
| Image attachment | File input → upload to `annotation-media` bucket | No |

### Tiptap config

```ts
const editor = useEditor({
  extensions: [
    StarterKit,
    Image,       // for pasted/uploaded images
    Placeholder.configure({ placeholder: 'What's the story behind this?' }),
  ],
})
```

### Submission

```ts
async function submitAnnotation() {
  // 1. If image selected, upload to Supabase Storage, get path
  const mediaUrl = imageFile
    ? await uploadAnnotationMedia(imageFile, speechId)
    : null

  // 2. Insert annotation
  const { error } = await supabase.from('annotations').insert({
    speech_id: speechId,
    author_id: user.id,
    char_start: offsets.start,
    char_end: offsets.end,
    selected_text: offsets.selectedText,
    body: JSON.stringify(editor.getJSON()),
    media_url: mediaUrl,
  })

  // 3. Handle overlap error from DB trigger
  if (error?.message === 'annotation_overlap') {
    showToast('Someone just annotated that passage — try another selection.')
    return
  }

  closeModal()
  openSidebar(newAnnotationId)
}
```

### Modal design

- Full-screen overlay: `rgba(0,0,0,0.6)`
- Modal card: `--color-canvas-white`, 0px border-radius, 560px max-width
- No rounded corners anywhere
- Submit button: `--color-ink-black` background, `--color-canvas-white` text

---

## Component: `AnnotationSidebar`

Fixed 320px panel on the right side of the transcript. Does not overlay the transcript — transcript column is `flex: 1`.

### States

| State | Display |
|---|---|
| Empty | Instruction text: "Click any underlined passage to read its annotation." |
| Loading | Skeleton loaders for body and comments |
| Annotation detail | Full annotation content (see below) |

### Annotation Detail Layout

```
┌─────────────────────────────────┐
│ ← Back (closes sidebar detail) │
├─────────────────────────────────┤
│ [Selected text as blockquote]  │
├─────────────────────────────────┤
│ [Hero image, full-width]       │  ← if present
├─────────────────────────────────┤
│ [Rich text annotation body]    │
├─────────────────────────────────┤
│ By: author email   ↑ 12 votes  │
│ [▲ Upvote] [▼ Downvote]        │
├─────────────────────────────────┤
│ COMMENTS                        │
│ ─────────────────────────────  │
│ user@email.com · 2h ago        │
│ Comment text here               │
│ ─────────────────────────────  │
│ [Add a comment...]   [Post]    │
└─────────────────────────────────┘
```

### Opening the sidebar

Clicking an `<AnnotatedSpan>` calls `openSidebar(annotationId)`. Sidebar content is loaded client-side:

```ts
const { data: annotation } = await supabase
  .from('annotations')
  .select(`
    *,
    comments:annotation_comments(*, author:auth.users(email))
      .order(created_at, ascending: true),
    votes:annotation_votes(value, user_id)
  `)
  .eq('id', annotationId)
  .single()
```

### Real-time comments

Subscribe to new comments on the open annotation:

```ts
supabase
  .channel(`annotation:${annotationId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'annotation_comments',
    filter: `annotation_id=eq.${annotationId}`,
  }, payload => {
    setComments(prev => [...prev, payload.new])
  })
  .subscribe()
```

### Voting

```ts
async function vote(value: 1 | -1) {
  const existingVote = annotation.votes.find(v => v.user_id === user.id)

  if (existingVote?.value === value) {
    // Remove vote (toggle off)
    await supabase.from('annotation_votes').delete().eq('annotation_id', annotationId).eq('user_id', user.id)
  } else {
    // Upsert vote
    await supabase.from('annotation_votes').upsert({
      annotation_id: annotationId,
      user_id: user.id,
      value,
    })
  }
}
```

A Postgres trigger updates `annotations.upvotes` on `annotation_votes` insert/update/delete:

```sql
create or replace function sync_annotation_upvotes()
returns trigger language plpgsql as $$
begin
  update annotations
  set upvotes = (
    select coalesce(sum(value), 0)
    from annotation_votes
    where annotation_id = coalesce(new.annotation_id, old.annotation_id)
  )
  where id = coalesce(new.annotation_id, old.annotation_id);
  return null;
end;
$$;

create trigger sync_upvotes
after insert or update or delete on annotation_votes
for each row execute function sync_annotation_upvotes();
```

### Comment submission

Plain text, max 1000 characters. No rich text.

```ts
await supabase.from('annotation_comments').insert({
  annotation_id: annotationId,
  author_id: user.id,
  body: commentText.trim(),
})
```

---

## Reviewer Actions

For users with `owner` or `reviewer` role, annotation detail shows additional controls:

- "Remove annotation" → sets `annotations.status = 'removed'`
- "Remove comment" → deletes the comment row

These appear as small text links below the relevant content, styled in `--color-pale-ash`.
