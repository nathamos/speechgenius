'use client'

import { useState, useRef } from 'react'
import { createWedding } from './_actions'

export default function NewWeddingButton() {
  const [open, setOpen] = useState(false)
  const [joinMode, setJoinMode] = useState('open')
  const [loading, setLoading] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formRef.current) return
    setLoading(true)
    await createWedding(new FormData(formRef.current))
    setLoading(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="font-display text-xs tracking-[-0.047em] text-canvas-white bg-ink-black px-3 py-1.5 hover:bg-graphite"
      >
        New wedding
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="bg-canvas-white w-full max-w-[440px] border border-pale-ash p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display tracking-[-0.047em] text-ink-black" style={{ fontSize: '20px' }}>
                New wedding
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="font-body text-sm text-pale-ash hover:text-ink-black leading-none"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="font-display text-xs tracking-[-0.047em] text-ink-black">
                  Title <span className="text-pale-ash">(required)</span>
                </label>
                <input
                  name="title"
                  type="text"
                  required
                  placeholder="Sarah & James"
                  className="border border-pale-ash px-2 py-1.5 font-body text-sm text-ink-black bg-canvas-white outline-none focus:border-ink-black"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-display text-xs tracking-[-0.047em] text-ink-black">
                  Date <span className="text-pale-ash">(optional)</span>
                </label>
                <input
                  name="date"
                  type="date"
                  className="border border-pale-ash px-2 py-1.5 font-body text-sm text-ink-black bg-canvas-white outline-none focus:border-ink-black"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-display text-xs tracking-[-0.047em] text-ink-black">
                  Access
                </label>
                <div className="flex gap-3">
                  {(['open', 'password', 'invite'] as const).map((mode) => (
                    <label key={mode} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="join_mode"
                        value={mode}
                        checked={joinMode === mode}
                        onChange={() => setJoinMode(mode)}
                      />
                      <span className="font-body text-sm text-ink-black capitalize">{mode}</span>
                    </label>
                  ))}
                </div>
              </div>

              {joinMode === 'password' && (
                <div className="flex flex-col gap-1">
                  <label className="font-display text-xs tracking-[-0.047em] text-ink-black">
                    Password
                  </label>
                  <input
                    name="join_password"
                    type="text"
                    required
                    placeholder="guests will enter this to join"
                    className="border border-pale-ash px-2 py-1.5 font-body text-sm text-ink-black bg-canvas-white outline-none focus:border-ink-black"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="font-display text-xs tracking-[-0.047em] text-ink-black border border-pale-ash px-3 py-1.5 hover:border-ink-black"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="font-display text-xs tracking-[-0.047em] text-canvas-white bg-ink-black px-3 py-1.5 hover:bg-graphite disabled:opacity-50"
                >
                  {loading ? 'Creating…' : 'Create wedding'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
