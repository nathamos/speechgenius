import Image from 'next/image'
import Link from 'next/link'

interface SpeechBannerProps {
  title: string
  speakerName: string
  deliveredAt: string | null
  weddingTitle: string
  weddingSlug: string
  heroImageUrl: string | null
  editHref?: string | null
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return null
  }
}

export default function SpeechBanner({
  title,
  speakerName,
  deliveredAt,
  weddingTitle,
  weddingSlug,
  heroImageUrl,
  editHref,
}: SpeechBannerProps) {
  const formattedDate = formatDate(deliveredAt)

  return (
    <div className="bg-blush-tone">
      <div className="flex items-center gap-8 p-10">
        {/* Left: metadata — same p-10 origin as the transcript below */}
        <div className="flex-1 min-w-0">
          <div className="mb-3">
            <Link
              href={`/weddings/${weddingSlug}`}
              className="font-display tracking-[-0.047em] text-ink-black no-underline hover:underline"
              style={{ fontSize: '12px' }}
            >
              {weddingTitle}
            </Link>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <h1
              className="font-display tracking-[-0.047em] text-ink-black"
              style={{ fontSize: '56px', lineHeight: 0.9 }}
            >
              {title}
            </h1>
            {editHref && (
              <Link
                href={editHref}
                className="shrink-0 flex items-center justify-center border border-pale-ash hover:border-ink-black no-underline"
                style={{ width: 28, height: 28, borderRadius: '50%', marginTop: 4, alignSelf: 'flex-end', marginBottom: 2 }}
                title="Edit speech"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </Link>
            )}
          </div>

          <p className="font-body text-graphite mb-1" style={{ fontSize: '16px' }}>
            {speakerName}
          </p>

          {formattedDate && (
            <p className="font-body text-pale-ash" style={{ fontSize: '12px' }}>
              {formattedDate}
            </p>
          )}
        </div>

        {/* Right: hero image */}
        {heroImageUrl && (
          <div className="shrink-0 relative" style={{ width: 220, height: 220 }}>
            <Image
              src={heroImageUrl}
              alt=""
              fill
              priority
              className="object-cover"
            />
          </div>
        )}
      </div>
    </div>
  )
}
