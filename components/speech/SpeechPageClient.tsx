'use client'

import { useState } from 'react'
import TranscriptView from '@/components/speech/TranscriptView'
import AnnotationSidebar from '@/components/speech/AnnotationSidebar'
import type { Tables } from '@/lib/supabase/types'
import type { User } from '@supabase/supabase-js'
import type { AnnotationWithVotes } from '@/app/weddings/[weddingSlug]/speeches/[speechSlug]/page'

interface SpeechPageClientProps {
  stanzas: Tables<'speech_stanzas'>[]
  annotations: AnnotationWithVotes[]
  transcriptString: string
  user: User | null
  speechId: string
}

export default function SpeechPageClient({
  stanzas,
  annotations,
  transcriptString,
  user,
  speechId,
}: SpeechPageClientProps) {
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null)

  function handleAnnotationClick(annotationId: string) {
    setActiveAnnotationId(annotationId)
  }

  function handleSidebarClose() {
    setActiveAnnotationId(null)
  }

  return (
    <div className="flex">
      <TranscriptView
        stanzas={stanzas}
        annotations={annotations}
        transcriptString={transcriptString}
        user={user}
        speechId={speechId}
        onAnnotationClick={handleAnnotationClick}
        activeAnnotationId={activeAnnotationId}
      />
      <AnnotationSidebar
        activeAnnotationId={activeAnnotationId}
        user={user}
        onClose={handleSidebarClose}
      />
    </div>
  )
}
