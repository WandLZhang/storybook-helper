import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Page } from '../services/books'
import { FitText } from './FitText'
import { TappableText } from './TappableText'
import { useWakeLock } from '../hooks/useWakeLock'

const SPRING = { type: 'spring' as const, stiffness: 380, damping: 38, mass: 0.8 }

export function Reader({
  title,
  pages,
  hasMandarin,
  onBack,
}: {
  title: string
  pages: Page[]
  hasMandarin: boolean
  onBack: () => void
}) {
  const [i, setI] = useState(0)
  const [dir, setDir] = useState(1)
  const startedRight = useRef(true)
  const [showCmn, setShowCmn] = useState(false)
  const [zoom, setZoom] = useState(false)
  useWakeLock(true)

  const page = pages[i]
  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(pages.length - 1, next))
    if (clamped === i) return
    setDir(clamped > i ? 1 : -1)
    setI(clamped)
    setZoom(false)
    if (navigator.vibrate) navigator.vibrate(8)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(i + 1)
      if (e.key === 'ArrowLeft') go(i - 1)
      if (e.key === 'Escape') onBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 flex flex-col bg-[#0a0a0b] text-white">
      <div className="flex shrink-0 items-center gap-3 px-4 pb-1 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={onBack}
          className="rounded-full bg-white/5 px-3 py-1.5 text-sm text-neutral-300 active:bg-white/10"
        >
          ←
        </motion.button>
        <div className="min-w-0 flex-1 truncate text-sm text-neutral-400">{title}</div>
        {hasMandarin && (
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => setShowCmn((v) => !v)}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
              showCmn ? 'bg-sky-500/20 text-sky-300' : 'bg-white/5 text-neutral-400'
            }`}
          >
            {showCmn ? '粵' : '普'}
          </motion.button>
        )}
        <div className="tabular-nums text-sm text-neutral-500">
          {i + 1}/{pages.length}
        </div>
      </div>

      {/*
        The drag lives on a PERSISTENT layer, not on the page that animates in and out. Putting it
        on the animated child meant the element handling the gesture was being unmounted by
        AnimatePresence mid-swipe, so the drag never resolved into a page turn.
        The .swipe-zone class puts touch-action:pan-y on this element AND every descendant. Without
        it on the descendants the browser keeps the horizontal axis inside the text's vertical
        scroller, so only swipes starting at the screen edge ever turned a page.
      */}
      <motion.div
        className="swipe-zone relative min-h-0 flex-1 overflow-hidden"
        drag="x"
        dragDirectionLock
        dragElastic={0.14}
        dragMomentum={false}
        dragConstraints={{ left: 0, right: 0 }}
        onDragStart={(_, info) => {
          startedRight.current = info.point.x > window.innerWidth / 2
        }}
        onDragEnd={(_, info) => {
          // Which HALF the swipe began in decides the direction, not which way the finger went.
          // Reading one-handed with a book in the other, a flick anywhere on the right should mean
          // forward even when it comes out as a short, sloppy, or slightly backwards drag.
          const moved = Math.abs(info.offset.x) > 24 || Math.abs(info.velocity.x) > 250
          if (moved) go(i + (startedRight.current ? 1 : -1))
        }}
      >
        <AnimatePresence initial={false} custom={dir}>
          <motion.div
            key={i}
            custom={dir}
            initial={{ x: dir * 70, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: dir * -70, opacity: 0 }}
            transition={SPRING}
            className="absolute inset-0 flex flex-col px-5 pb-2"
          >
            {/*
              Fixed 96x96 box with object-contain, NOT h-24 w-auto: a landscape page photo rendered
              wider than the reserved gutter and sat on top of the text.
            */}
            {page.photoUrl && (
              <img
                src={page.photoUrl}
                alt=""
                onClick={() => setZoom(true)}
                className="absolute right-4 top-1 z-10 h-24 w-24 cursor-pointer rounded-xl border border-white/10 object-contain shadow-lg active:scale-95"
              />
            )}

            <div className="min-h-0 flex-1 pt-2">
              {/* 普 swaps the language rather than stacking both, so whichever you are reading
                  gets the whole page and the fitter can size it properly. */}
              <FitText deps={[i, showCmn, page.yue, page.cmn]} min={46}>
                {/*
                  An invisible float the exact size of the photo. The first lines wrap around it and
                  everything below reclaims the full width — reserving a right gutter for the whole
                  column instead would waste it on every line of a long page.
                */}
                {page.photoUrl && (
                  <div aria-hidden className="pointer-events-none float-right h-[7rem] w-[7.5rem]" />
                )}
                {showCmn && page.cmn ? (
                  <TappableText text={page.cmn} className="zh-cmn text-white" />
                ) : (
                  <TappableText text={page.yue} className="zh-yue text-white" />
                )}
              </FitText>
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <Thumbs pages={pages} index={i} onPick={go} />

      <AnimatePresence>
        {zoom && page.photoUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setZoom(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          >
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              transition={SPRING}
              src={page.photoUrl}
              alt=""
              className="max-h-full max-w-full rounded-2xl object-contain"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Bottom strip of page thumbnails — you recognise the picture faster than you recall the number. */
function Thumbs({ pages, index, onPick }: { pages: Page[]; index: number; onPick: (i: number) => void }) {
  const strip = useRef<HTMLDivElement>(null)
  const items = useMemo(() => pages.map((p, n) => ({ n, url: p.photoUrl })), [pages])

  useEffect(() => {
    const el = strip.current?.querySelector<HTMLElement>(`[data-page="${index}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [index])

  return (
    <div
      ref={strip}
      className="no-scrollbar flex shrink-0 gap-1.5 overflow-x-auto px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
      style={{ touchAction: 'pan-x' }}
    >
      {items.map(({ n, url }) => (
        <motion.button
          key={n}
          data-page={n}
          whileTap={{ scale: 0.88 }}
          onClick={() => onPick(n)}
          className={`relative h-14 w-11 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
            n === index ? 'border-white' : 'border-white/20'
          }`}
        >
          {url ? (
            <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-white/5 text-xs tabular-nums text-neutral-500">
              {n + 1}
            </span>
          )}
          <span className="absolute bottom-0 right-0 bg-black/70 px-1 text-[9px] tabular-nums text-white">
            {n + 1}
          </span>
        </motion.button>
      ))}
    </div>
  )
}
