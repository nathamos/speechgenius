import Image from 'next/image'
import Link from 'next/link'

interface SpeechBannerProps {
  title: string
  speakerName: string
  deliveredAt: string | null
  weddingTitle: string
  weddingSlug: string
  heroImageUrl: string | null
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
}: SpeechBannerProps) {
  const formattedDate = formatDate(deliveredAt)

  return (
    <div className="relative min-h-[380px] bg-blush-tone overflow-hidden flex items-end">
      {/* Hero image — sits behind a blush overlay */}
      {heroImageUrl && (
        <>
          <Image
            src={heroImageUrl}
            alt=""
            fill
            priority
            className="object-cover"
            style={{ zIndex: 0 }}
          />
          {/* 35% opacity blush-tone wash so text is always legible */}
          <div
            className="absolute inset-0 bg-blush-tone"
            style={{ opacity: 0.35, zIndex: 1 }}
          />
        </>
      )}

      {/* Content layer — sits above image + overlay */}
      <div className="relative z-10 p-10 w-full">
        {/* Wedding link */}
        <div className="mb-3">
          <Link
            href={`/weddings/${weddingSlug}`}
            className="font-display tracking-[-0.047em] text-ink-black no-underline hover:underline"
            style={{ fontSize: '12px' }}
          >
            {weddingTitle}
          </Link>
        </div>

        {/* Speech title */}
        <h1
          className="font-display tracking-[-0.047em] text-ink-black leading-none mb-3"
          style={{ fontSize: '56px', lineHeight: 0.9 }}
        >
          {title}
        </h1>

        {/* Speaker name */}
        <p className="font-body text-graphite mb-1" style={{ fontSize: '16px' }}>
          {speakerName}
        </p>

        {/* Date */}
        {formattedDate && (
          <p className="font-body text-pale-ash" style={{ fontSize: '12px' }}>
            {formattedDate}
          </p>
        )}
      </div>
    </div>
  )
}
