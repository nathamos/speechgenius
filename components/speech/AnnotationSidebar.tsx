'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Tables } from '@/lib/supabase/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Vote {
  value: number
  user_id: string
}

interface Comment {
  id: string
  body: string
  created_at: string | null
  author_id: string
  annotation_id: string
  // Enriched client-side
  authorDisplay?: string
}

interface FullAnnotation extends Tables<'annotations'> {
  votes: Vote[]
  comments: Comment[]
  authorDisplay?: string
}

interface AnnotationSidebarProps {
  activeAnnotationId: string | null
  user: User | null
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return ''
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)

  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

async function fetchDisplayName(userId: string): Promise<string> {
  // Try profiles first
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .single()
  if (profile?.display_name) return profile.display_name

  // Fall back — we can't query auth.users from client, so return a placeholder
  return 'Guest'
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-4 bg-pale-ash w-3/4" />
      <div className="h-4 bg-pale-ash w-full" />
      <div className="h-4 bg-pale-ash w-5/6" />
      <div className="h-4 bg-pale-ash w-full" />
      <div className="h-4 bg-pale-ash w-2/3" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rich text renderer (Tiptap JSON → plain HTML-like display)
// We keep this simple: render paragraphs and basic marks from Tiptap JSON.
// ---------------------------------------------------------------------------

interface TiptapNode {
  type: string
  text?: string
  content?: TiptapNode[]
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
  attrs?: Record<string, unknown>
}

function renderTiptapNode(node: TiptapNode, key: string | number): React.ReactNode {
  if (node.type === 'text') {
    let el: React.ReactNode = node.text ?? ''
    if (node.marks) {
      for (const mark of node.marks) {
        if (mark.type === 'bold') el = <strong key={key}>{el}</strong>
        else if (mark.type === 'italic') el = <em key={key}>{el}</em>
        else if (mark.type === 'code') el = <code key={key}>{el}</code>
        else if (mark.type === 'link')
          el = (
            <a
              key={key}
              href={mark.attrs?.href as string}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {el}
            </a>
          )
      }
    }
    return el
  }

  const children = (node.content ?? []).map((child, i) =>
    renderTiptapNode(child, `${key}-${i}`)
  )

  switch (node.type) {
    case 'doc':
      return <>{children}</>
    case 'paragraph':
      return (
        <p key={key} className="font-body text-ink-black mb-2" style={{ fontSize: '16px', lineHeight: '1.5' }}>
          {children}
        </p>
      )
    case 'bulletList':
      return (
        <ul key={key} className="list-disc pl-4 mb-2">
          {children}
        </ul>
      )
    case 'orderedList':
      return (
        <ol key={key} className="list-decimal pl-4 mb-2">
          {children}
        </ol>
      )
    case 'listItem':
      return <li key={key}>{children}</li>
    case 'blockquote':
      return (
        <blockquote
          key={key}
          className="border-l-2 border-ink-black pl-3 mb-2 italic text-graphite"
        >
          {children}
        </blockquote>
      )
    case 'hardBreak':
      return <br key={key} />
    case 'image':
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={key}
          src={node.attrs?.src as string}
          alt={(node.attrs?.alt as string) ?? ''}
          className="max-w-full mb-2"
        />
      )
    default:
      return <span key={key}>{children}</span>
  }
}

function RichTextBody({ json }: { json: string | null }) {
  if (!json) return null
  try {
    const doc = JSON.parse(json) as TiptapNode
    return <div>{renderTiptapNode(doc, 'root')}</div>
  } catch {
    return <p className="font-body text-ink-black" style={{ fontSize: '16px' }}>{json}</p>
  }
}

// ---------------------------------------------------------------------------
// Main sidebar
// ---------------------------------------------------------------------------

export default function AnnotationSidebar({
  activeAnnotationId,
  user,
  onClose,
}: AnnotationSidebarProps) {
  const [annotation, setAnnotation] = useState<FullAnnotation | null>(null)
  const [loading, setLoading] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const [userVote, setUserVote] = useState<number | null>(null)
  const [voteCount, setVoteCount] = useState(0)
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // Fetch annotation detail when activeAnnotationId changes
  useEffect(() => {
    if (!activeAnnotationId) {
      setAnnotation(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setAnnotation(null)

    async function load() {
      const { data, error } = await supabase
        .from('annotations')
        .select('*, votes:annotation_votes(value, user_id), comments:annotation_comments(*)')
        .eq('id', activeAnnotationId!)
        .order('created_at', { referencedTable: 'annotation_comments', ascending: true })
        .single()

      if (error || !data) {
        setLoading(false)
        return
      }

      // Enrich author display name
      const authorDisplay = await fetchDisplayName(data.author_id)

      // Enrich comment authors
      const comments: Comment[] = await Promise.all(
        ((data.comments ?? []) as Comment[]).map(async (c) => ({
          ...c,
          authorDisplay: await fetchDisplayName(c.author_id),
        }))
      )

      const full: FullAnnotation = {
        ...(data as Tables<'annotations'>),
        votes: (data.votes ?? []) as Vote[],
        comments,
        authorDisplay,
      }

      setAnnotation(full)
      setVoteCount(data.upvotes ?? 0)

      // Set user's current vote
      if (user) {
        const myVote = (data.votes ?? []).find(
          (v: Vote) => v.user_id === user.id
        )
        setUserVote(myVote ? myVote.value : null)
      }

      setLoading(false)
    }

    load()
  }, [activeAnnotationId, user])

  // Realtime: subscribe to new comments for the open annotation
  useEffect(() => {
    // Cleanup old channel
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current)
      realtimeChannelRef.current = null
    }

    if (!activeAnnotationId) return

    const channel = supabase
      .channel(`annotation:${activeAnnotationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'annotation_comments',
          filter: `annotation_id=eq.${activeAnnotationId}`,
        },
        async (payload) => {
          const newComment = payload.new as Comment
          const authorDisplay = await fetchDisplayName(newComment.author_id)
          setAnnotation((prev) => {
            if (!prev) return prev
            // Don't duplicate comments we may have optimistically added
            const exists = prev.comments.some((c) => c.id === newComment.id)
            if (exists) return prev
            return {
              ...prev,
              comments: [...prev.comments, { ...newComment, authorDisplay }],
            }
          })
        }
      )
      .subscribe()

    realtimeChannelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      realtimeChannelRef.current = null
    }
  }, [activeAnnotationId])

  // Voting
  const handleVote = useCallback(
    async (value: 1 | -1) => {
      if (!user || !activeAnnotationId) return

      const isToggleOff = userVote === value

      if (isToggleOff) {
        setUserVote(null)
        setVoteCount((c) => c - value)
        await supabase
          .from('annotation_votes')
          .delete()
          .eq('annotation_id', activeAnnotationId)
          .eq('user_id', user.id)
      } else {
        const prev = userVote ?? 0
        setUserVote(value)
        setVoteCount((c) => c - prev + value)
        await supabase.from('annotation_votes').upsert({
          annotation_id: activeAnnotationId,
          user_id: user.id,
          value,
        })
      }
    },
    [user, activeAnnotationId, userVote]
  )

  // Comment submission
  const handlePostComment = useCallback(async () => {
    if (!user || !activeAnnotationId || !commentText.trim() || postingComment) return
    setPostingComment(true)

    const body = commentText.trim().slice(0, 1000)

    // Optimistic update
    const optimisticComment: Comment = {
      id: `optimistic-${Date.now()}`,
      annotation_id: activeAnnotationId,
      author_id: user.id,
      body,
      created_at: new Date().toISOString(),
      authorDisplay: annotation?.authorDisplay === user.id ? annotation?.authorDisplay : 'You',
    }

    setAnnotation((prev) =>
      prev ? { ...prev, comments: [...prev.comments, optimisticComment] } : prev
    )
    setCommentText('')

    await supabase.from('annotation_comments').insert({
      annotation_id: activeAnnotationId,
      author_id: user.id,
      body,
    })

    setPostingComment(false)
  }, [user, activeAnnotationId, commentText, postingComment, annotation])

  // Reviewer: remove annotation
  const handleRemoveAnnotation = useCallback(async () => {
    if (!activeAnnotationId) return
    await supabase
      .from('annotations')
      .update({ status: 'removed' })
      .eq('id', activeAnnotationId)
    onClose()
  }, [activeAnnotationId, onClose])

  // Reviewer: remove comment
  const handleRemoveComment = useCallback(async (commentId: string) => {
    await supabase.from('annotation_comments').delete().eq('id', commentId)
    setAnnotation((prev) =>
      prev ? { ...prev, comments: prev.comments.filter((c) => c.id !== commentId) } : prev
    )
  }, [])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <aside className="w-40 flex-shrink-0 border-l border-pale-ash min-h-screen p-4 bg-canvas-white sticky top-6 max-h-[calc(100vh-48px)] overflow-y-auto self-start">
      {/* Empty state */}
      {!activeAnnotationId && !loading && (
        <p className="font-body text-pale-ash text-xs" style={{ lineHeight: '1.5' }}>
          Click any underlined passage to read its annotation.
        </p>
      )}

      {/* Loading state */}
      {loading && <Skeleton />}

      {/* Annotation detail */}
      {!loading && annotation && (
        <div>
          {/* Back button */}
          <button
            onClick={onClose}
            className="font-display tracking-[-0.047em] text-xs text-ink-black bg-transparent border-none cursor-pointer p-0 mb-4 hover:underline"
          >
            ← Back
          </button>

          {/* Selected text as blockquote */}
          <blockquote className="border-l-2 border-ink-black pl-3 mb-4 font-body text-sm italic text-graphite">
            {annotation.selected_text}
          </blockquote>

          {/* Hero image if present */}
          {annotation.media_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={annotation.media_url}
              alt=""
              className="w-full mb-4"
            />
          )}

          {/* Rich text body */}
          <div className="mb-4">
            <RichTextBody json={annotation.body} />
          </div>

          {/* Author + vote count */}
          <div className="flex items-center justify-between mb-2">
            <span className="font-body text-pale-ash" style={{ fontSize: '12px' }}>
              By: {annotation.authorDisplay ?? 'Guest'}
            </span>
            <span className="font-display tracking-[-0.047em] text-xs text-ink-black">
              {voteCount > 0 ? `↑ ${voteCount}` : voteCount < 0 ? `↓ ${Math.abs(voteCount)}` : '0'}
            </span>
          </div>

          {/* Vote buttons */}
          {user && (
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => handleVote(1)}
                className={[
                  'font-display tracking-[-0.047em] text-xs px-3 py-1 border border-ink-black cursor-pointer bg-transparent hover:bg-ink-black hover:text-canvas-white',
                  userVote === 1 ? 'bg-ink-black text-canvas-white' : 'text-ink-black',
                ].join(' ')}
              >
                ▲ Upvote
              </button>
              <button
                onClick={() => handleVote(-1)}
                className={[
                  'font-display tracking-[-0.047em] text-xs px-3 py-1 border border-ink-black cursor-pointer bg-transparent hover:bg-ink-black hover:text-canvas-white',
                  userVote === -1 ? 'bg-ink-black text-canvas-white' : 'text-ink-black',
                ].join(' ')}
              >
                ▼ Downvote
              </button>
            </div>
          )}

          {/* Divider */}
          <hr className="border-none border-t border-pale-ash my-3" />

          {/* Comments section */}
          <p className="font-display tracking-[-0.047em] text-xs text-ink-black mb-3 uppercase tracking-widest">
            Comments
          </p>

          {annotation.comments.length === 0 && (
            <p className="font-body text-pale-ash text-xs mb-3">
              No comments yet.
            </p>
          )}

          {annotation.comments.map((comment, i) => (
            <div key={comment.id}>
              {i > 0 && <hr className="border-none border-t border-pale-ash my-3" />}
              <div className="flex items-center justify-between mb-1">
                <span className="font-body text-pale-ash" style={{ fontSize: '12px' }}>
                  {comment.authorDisplay ?? 'Guest'}
                  {comment.created_at && (
                    <> · {relativeTime(comment.created_at)}</>
                  )}
                </span>
                {/* Reviewer remove comment */}
                {user && (
                  <button
                    onClick={() => handleRemoveComment(comment.id)}
                    className="font-body text-pale-ash text-xs bg-transparent border-none cursor-pointer p-0 hover:text-ink-black"
                    title="Remove comment"
                  >
                    ✕
                  </button>
                )}
              </div>
              <p className="font-body text-ink-black" style={{ fontSize: '14px', lineHeight: '1.5' }}>
                {comment.body}
              </p>
            </div>
          ))}

          {/* Comment input */}
          {user ? (
            <div className="mt-4">
              <hr className="border-none border-t border-pale-ash mb-3" />
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value.slice(0, 1000))}
                placeholder="Add a comment…"
                rows={3}
                className="w-full border border-pale-ash p-2 font-body text-ink-black focus:border-ink-black outline-none resize-none"
                style={{ fontSize: '14px', lineHeight: '1.5', borderRadius: 0 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handlePostComment()
                  }
                }}
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={handlePostComment}
                  disabled={postingComment || !commentText.trim()}
                  className="font-display tracking-[-0.047em] text-xs text-canvas-white bg-ink-black px-4 py-2 border-none cursor-pointer hover:bg-graphite disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {postingComment ? 'Posting…' : 'Post'}
                </button>
              </div>
            </div>
          ) : (
            <p className="font-body text-pale-ash text-xs mt-4">
              Sign in to annotate or comment.
            </p>
          )}

          {/* Reviewer: remove annotation */}
          {user && (
            <div className="mt-4">
              <hr className="border-none border-t border-pale-ash mb-3" />
              <button
                onClick={handleRemoveAnnotation}
                className="font-body text-pale-ash text-xs bg-transparent border-none cursor-pointer p-0 hover:text-ink-black"
              >
                Remove annotation
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
