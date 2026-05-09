# 05 — Design System

The visual language is adapted from a minimalist gallery-wall aesthetic: high contrast, text-dominant, near-monochromatic, with a single warm accent. Applied to a Genius-style annotation product, this creates an editorial feel — the speech is the art, the UI recedes.

---

## Color Tokens

```css
:root {
  --color-canvas-white: #ffffff;      /* Page backgrounds, card surfaces */
  --color-ink-black:    #000000;      /* Primary text, prominent UI */
  --color-graphite:     #282828;      /* Dark borders, separator lines */
  --color-pale-ash:     #dcdcdc;      /* Secondary text, dividers, inactive */
  --color-blush-tone:   #efc4b2;      /* Speech banner background */
}
```

**Usage rules:**
- No gradients, no shadows, no blur
- `--color-blush-tone` is reserved for the speech banner only — nowhere else in the UI
- CTAs use `--color-ink-black` background / `--color-canvas-white` text — there is no distinct CTA color
- Borders are always 1px `--color-pale-ash` (dividers) or 1px `--color-graphite` (elevated/inverted surfaces)

---

## Typography

### Font Families

```css
--font-display:  'custom_21879', ui-sans-serif, system-ui, sans-serif;
--font-body:     -apple-system, ui-sans-serif, system-ui, sans-serif;
```

`custom_21879` is used for all headings, nav links, and interactive text. It has tight letter-spacing (`-0.047em`) and is the typographic identity of the product.

`-apple-system` (system-ui fallback) is used for all body text, transcript, and descriptive copy.

### Type Scale

| Role | Font | Size | Weight | Letter-spacing | Line-height | Usage |
|---|---|---|---|---|---|---|
| `display` | custom_21879 | 56px | 400 | -0.047em | 0.9 | Speech title in banner |
| `heading-lg` | custom_21879 | 32px | 400 | -0.047em | 1.1 | Section headings |
| `heading-sm` | custom_21879 | 18px | 400 | -0.047em | 1.2 | Sidebar section titles |
| `nav` | custom_21879 | 12px | 400 | -0.047em | 1.17 | Navigation, metadata labels |
| `transcript` | -apple-system | 18px | 400 | normal | 1.75 | Speech body text |
| `body` | -apple-system | 16px | 400 | normal | 1.5 | Annotation body, comments |
| `caption` | -apple-system | 12px | 400 | normal | 1.4 | Timestamps, author email |

**Rules:**
- No bold (`font-weight: 700`) except for `custom_21879` at `display` and `heading-lg` roles in specific emphasis contexts (sparingly)
- Never mix font families within a single UI element
- Sentence case always — no ALL CAPS, no Title Case

---

## Spacing

**Base unit:** 8px

```css
--space-1:  8px
--space-2:  16px
--space-3:  24px
--space-4:  32px
--space-5:  40px
--space-6:  48px
--space-8:  64px
--space-10: 80px
```

**Density:** compact. Between list items: 1px separator, minimal padding. Between sections: `--space-8` or `--space-10`.

---

## Shape

```css
--radius: 0px;
```

**No rounded corners anywhere.** Buttons, modals, inputs, cards — all sharp. This is a hard rule from the design system.

---

## Component Patterns

### Navigation (sticky, full-width)

```
background: --color-canvas-white
border-bottom: 1px solid --color-pale-ash
padding: 0 --space-4
height: 48px
display: flex, align-items: center, justify-content: space-between
```

Left: Site name ("Vows & Verses") — `--font-display`, 12px
Right: User email + "Sign out" — `--font-body`, 12px, `--color-pale-ash`

### Speech Banner

```
background: --color-blush-tone
min-height: 380px
position: relative
overflow: hidden
padding: --space-10
```

Hero image: absolutely positioned, `object-fit: cover`, `width: 100%`, `height: 100%`, opacity 0.35 overlay of blush tone so text reads clearly.

Content sits in a `position: relative` z-index layer above the image.

### Buttons

```css
/* Primary */
.btn-primary {
  background: var(--color-ink-black);
  color: var(--color-canvas-white);
  font-family: var(--font-display);
  font-size: 12px;
  letter-spacing: -0.047em;
  padding: 10px 20px;
  border: none;
  border-radius: 0;
  cursor: pointer;
}
.btn-primary:hover {
  background: var(--color-graphite);
}

/* Ghost */
.btn-ghost {
  background: transparent;
  color: var(--color-ink-black);
  border: 1px solid var(--color-ink-black);
  font-family: var(--font-display);
  font-size: 12px;
  letter-spacing: -0.047em;
  padding: 10px 20px;
  border-radius: 0;
  cursor: pointer;
}
.btn-ghost:hover {
  background: var(--color-ink-black);
  color: var(--color-canvas-white);
}
```

### Annotation Highlight

```css
.annotated-span {
  background: rgba(0, 0, 0, 0.06);
  border-bottom: 1.5px solid var(--color-ink-black);
  cursor: pointer;
  transition: background 0.1s;
}
.annotated-span:hover,
.annotated-span.active {
  background: rgba(0, 0, 0, 0.14);
}
```

### Sidebar

```css
.annotation-sidebar {
  width: 320px;
  flex-shrink: 0;
  border-left: 1px solid var(--color-pale-ash);
  min-height: 100vh;
  padding: var(--space-4);
  background: var(--color-canvas-white);
  position: sticky;
  top: 48px;                          /* below sticky nav */
  max-height: calc(100vh - 48px);
  overflow-y: auto;
}
```

### Dividers

```css
.divider {
  border: none;
  border-top: 1px solid var(--color-pale-ash);
  margin: var(--space-3) 0;
}
```

### Input / Textarea

```css
input, textarea {
  border: 1px solid var(--color-pale-ash);
  border-radius: 0;
  padding: var(--space-1) var(--space-2);
  font-family: var(--font-body);
  font-size: 16px;
  color: var(--color-ink-black);
  background: var(--color-canvas-white);
  outline: none;
  width: 100%;
}
input:focus, textarea:focus {
  border-color: var(--color-ink-black);
}
```

### Modal Overlay

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.modal-card {
  background: var(--color-canvas-white);
  border-radius: 0;
  width: 560px;
  max-width: calc(100vw - 32px);
  padding: var(--space-5);
  border: 1px solid var(--color-graphite);
}
```

---

## Tailwind v4 Theme

```css
@theme {
  --color-canvas-white: #ffffff;
  --color-ink-black:    #000000;
  --color-graphite:     #282828;
  --color-pale-ash:     #dcdcdc;
  --color-blush-tone:   #efc4b2;

  --font-display: 'custom_21879', ui-sans-serif, system-ui, sans-serif;
  --font-body:    -apple-system, ui-sans-serif, system-ui, sans-serif;

  --radius: 0px;
  --spacing: 8px;
}
```

---

## Do's and Don'ts

**Do:**
- Use text and 1px borders as the primary means of visual separation
- Keep the transcript area clean — the speech is the hero
- Use `--color-blush-tone` only in the banner
- Default to `custom_21879` for anything interactive or heading-level

**Don't:**
- No gradients, shadows, or blur anywhere
- No rounded corners
- No colorful states — success/error use black or pale ash, not green/red
- Don't add padding between repeating items (comments, stanzas) beyond 1px dividers
- Don't use `font-weight: 700` unless the design spec explicitly calls for it
