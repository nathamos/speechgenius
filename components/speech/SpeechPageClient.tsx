'use client'

import { useState } from 'react'
import TranscriptView from '@/components/speech/TranscriptView'
import AnnotationSidebar from '@/components/speech/AnnotationSidebar'
import type { User } from '@supabase/supabase-js'
import type { AnnotationWithVotes } from '@/app/weddings/[weddingSlug]/speeches/[speechSlug]/page'

interface SpeechPageClientProps {
  annotations: AnnotationWithVotes[]
  transcriptString: string
  user: User | null
  speechId: string
}

export default function SpeechPageClient({
  annotations: initialAnnotations,
  transcriptString,
  user,
  speechId,
}: SpeechPageClientProps) {
  const [annotations, setAnnotations] = useState(initialAnnotations)
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null)

  function handleAnnotationCreated(annotation: AnnotationWithVotes) {
    setAnnotations((prev) => [...prev, annotation])
    setActiveAnnotationId(annotation.id)
  }

  function handleSidebarClose() {
    setActiveAnnotationId(null)
  }

  return (
    <div className="flex">
      <TranscriptView
        annotations={annotations}
        transcriptString={transcriptString}
        user={user}
        speechId={speechId}
        onAnnotationCreated={handleAnnotationCreated}
        onAnnotationClick={setActiveAnnotationId}
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
