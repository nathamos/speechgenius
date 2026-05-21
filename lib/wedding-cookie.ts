export function weddingCookieName(weddingId: string) {
  return `wga_${weddingId.replace(/-/g, '')}`
}
