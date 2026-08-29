import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { TONE_COLORS, isCjk, lookupAt } from '../services/dict'
import type { Lookup } from '../services/dict'

/**
 * Renders the page text with every character tappable, and pops the word's reading and gloss.
 *
 * One <span> per character rather than caret hit-testing: at this font size a character is a big
 * target, and per-character spans mean no dead zones between them. That was the fix in
 * lockscreen-translate after taps kept missing.
 */
export function TappableText({ text, className }: { text: string; className?: string }) {
  const [hit, setHit] = useState<{ lk: Lookup; x: number; y: number } | null>(null)
  const [busy, setBusy] = useState(false)

  async function tap(e: React.MouseEvent, flatIndex: number, flat: string) {
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setBusy(true)
    try {
      const lk = await lookupAt(flat, flatIndex)
      if (lk) setHit({ lk, x: rect.left + rect.width / 2, y: rect.top })
    } finally {
      setBusy(false)
    }
  }

  // Absolute offsets into the whole page string, so forward-maximum-match can read across a line
  // break. Computed up front rather than with a counter during render: split('\n') discards a
  // character that still occupies an index, and a running counter silently drifts by one line.
  const lines: { text: string; start: number }[] = []
  let at = 0
  for (const line of text.split('\n')) {
    lines.push({ text: line, start: at })
    at += line.length + 1 // + the newline split() removed
  }

  return (
    <>
      <div className={className} onClick={() => hit && setHit(null)}>
        {lines.map((line, li) => (
          <p key={li} className={line.text.trim() ? 'mb-[0.45em]' : 'h-[0.3em]'}>
            {[...line.text].map((ch, ci) => {
              const idx = line.start + ci
              if (!isCjk(ch)) return <span key={idx}>{ch}</span>
              return (
                <span
                  key={idx}
                  className="cursor-pointer active:opacity-60"
                  onClick={(e) => {
                    e.stopPropagation()
                    tap(e, idx, text)
                  }}
                >
                  {ch}
                </span>
              )
            })}
          </p>
        ))}
      </div>

      <AnimatePresence>
        {hit && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 520, damping: 32 }}
            className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-2xl border border-white/10 bg-neutral-900/95 px-4 py-3 shadow-2xl backdrop-blur"
            style={{ left: hit.x, top: hit.y - 10, maxWidth: 'min(88vw, 30rem)' }}
          >
            <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              {hit.lk.reading.syllables.map((s, i) => (
                <span key={i} className="text-lg font-medium" style={{ color: TONE_COLORS[s.tone] }}>
                  {s.text}
                </span>
              ))}
            </div>
            <div className="text-2xl text-white">{hit.lk.word}</div>
            {hit.lk.def && <div className="mt-1 text-sm leading-snug text-neutral-400">{hit.lk.def}</div>}
            {hit.lk.reading.isMandarinFallback && (
              <div className="mt-1.5 text-[11px] uppercase tracking-wide text-amber-400/90">
                Mandarin pinyin — no jyutping in the dictionary
              </div>
            )}
            {hit.lk.reading.composed && (
              <div className="mt-1.5 text-[11px] uppercase tracking-wide text-sky-400/80">
                composed per character
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {busy && <div className="fixed bottom-24 left-1/2 -translate-x-1/2 text-xs text-neutral-500">loading dictionary…</div>}
    </>
  )
}
