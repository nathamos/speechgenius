export interface Stanza {
  id: string
  position: number
  body: string
}

export function buildTranscriptString(stanzas: Stanza[]): string {
  return stanzas
    .sort((a, b) => a.position - b.position)
    .map(s => s.body)
    .join('\n\n')
}

export function getSelectionOffsets(
  selection: Selection,
  transcriptEl: HTMLElement,
  _transcriptString: string
): { start: number; end: number; selectedText: string } | null {
  if (selection.isCollapsed) return null

  const range = selection.getRangeAt(0)
  if (!transcriptEl.contains(range.commonAncestorContainer)) return null

  const preRange = document.createRange()
  preRange.setStart(transcriptEl, 0)
  preRange.setEnd(range.startContainer, range.startOffset)
  const start = preRange.toString().length

  const selectedText = range.toString()
  if (!selectedText.trim()) return null

  return { start, end: start + selectedText.length, selectedText }
}

export function offsetsToStanzaRanges(
  start: number,
  end: number,
  stanzas: Stanza[]
): { stanzaId: string; localStart: number; localEnd: number }[] {
  const sorted = [...stanzas].sort((a, b) => a.position - b.position)
  const results: { stanzaId: string; localStart: number; localEnd: number }[] = []
  let cursor = 0

  for (const stanza of sorted) {
    const stanzaStart = cursor
    const stanzaEnd = cursor + stanza.body.length

    if (end <= stanzaStart) break
    if (start < stanzaEnd) {
      results.push({
        stanzaId: stanza.id,
        localStart: Math.max(0, start - stanzaStart),
        localEnd: Math.min(stanza.body.length, end - stanzaStart),
      })
    }

    cursor = stanzaEnd + 2 // accounts for \n\n separator
  }

  return results
}
