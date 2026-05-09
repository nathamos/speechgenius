# 06 — Navigation & Information Architecture

## Site Map

```
/                                              # Home — chart of all speeches
/weddings                                      # Weddings directory
/weddings/[weddingSlug]/join                   # Join flow (password / invite)
/weddings/[weddingSlug]/speeches/new           # Speech submission (admin/owner only)
/weddings/[weddingSlug]/speeches/[speechSlug]  # Speech L1
/weddings/[weddingSlug]                        # Wedding L1 (future phase)
/account                                       # Account page
/login                                         # Auth
```

---

## Navigation Bar

Sticky, full-width. Defined in the design system (48px height, 1px pale-ash border-bottom).

### Unauthenticated

```
[WeddingGenius]                                              [Sign in]
```

### Authenticated

```
[WeddingGenius]          [Home]  [Weddings]        [display name]  [Sign out]
```

The account page is accessed by clicking the display name / email — not a dedicated nav link. `Home` and `Weddings` are visible to all (authenticated or not).

---

## Home Page — Chart

**URL:** `/`  
**Access:** Public — no authentication required.

The landing page for WeddingGenius. A ranked table of all live speeches on the platform, sorted by recent view activity by default.

### Table columns

| Column | Detail |
|---|---|
| # | Rank (row number) |
| Speech | Title — links to the speech if the wedding is open; redirects to join page if password/invite |
| Speaker | `speaker_name` |
| Wedding | `wedding.title` — links to `/weddings/[slug]` |
| Access | Open icon or padlock icon based on `join_mode` |
| Annotations | Count of live annotations |
| Views | `speeches.view_count` |

### Sort options

Default: **Recent views** (highest recent view activity first). Secondary sorts: Most annotations, Most views (all-time), Newest.

### Behaviour for locked speeches

Speeches from password or invite weddings appear in the chart with their title, speaker, wedding name, and padlock icon. Clicking the speech title redirects to `/weddings/[slug]/join` rather than the speech page. This allows first-time visitors to discover a wedding they were invited to.

---

## Weddings Directory

**URL:** `/weddings`  
**Access:** Public — no authentication required.

A global listing of all weddings on the platform.

### Card layout

Each wedding renders as a card:
- Wedding title (e.g. "Sarah & James")
- Date
- Number of live speeches
- Access indicator: Open / Password-protected / Invite-only

### Behaviour

Clicking a card navigates to the wedding join page (`/weddings/[slug]/join`), which handles the appropriate flow:
- **Open:** immediately redirects to the wedding page
- **Password:** shows password entry form; on success, creates membership and redirects
- **Invite:** shows "you need an invite" message

---

## Account Page

**URL:** `/account`  
**Access:** Authenticated only. Redirects unauthenticated users to `/login?next=/account`.

### Contents

- Display name (editable inline — updates `profiles.display_name`)
- Email address (read-only, from `auth.users`)
- Summary statistics:
  - Weddings you're a member of (count)
  - Annotations you've submitted (count)
  - Comments you've submitted (count)
  - Total upvotes received on your annotations (sum of positive `annotation_votes.value` where the annotation's `author_id` is you)

---

## Speech Submission Form

**URL:** `/weddings/[weddingSlug]/speeches/new`  
**Access:** `owner` or `admin` of the wedding only. Others redirected to `/`.

### Fields

| Field | Component | Required |
|---|---|---|
| Speech title | Text input | Yes |
| Speaker name | Text input | Yes |
| Date delivered | Date picker | No |
| Hero image | File upload → `speech-heroes` bucket | No |
| Transcript | Stanza editor (see below) | Yes (at least one stanza) |

### Transcript editor

The transcript is composed of discrete stanzas. The form presents a multi-stanza editor:
- Each stanza is a plain-text `<textarea>`
- **Add stanza** button appends a new block
- Stanzas can be reordered (drag handle) and deleted
- On publish, each stanza is inserted into `speech_stanzas` with `position` reflecting its order

### Publish behaviour

Clicking **Publish** sets `speeches.status = 'live'` immediately — no approval step. The speech becomes visible to all guests with access to the wedding.

### Draft behaviour

The form auto-saves or can be saved explicitly. A saved-but-unpublished speech has `status = 'draft'` and is visible only to owners and admins of the wedding.

### View count tracking

Every page load of a live speech increments `speeches.view_count` server-side (in the page's server component, before streaming the response). No per-user deduplication in Phase 1 — refreshes count.
