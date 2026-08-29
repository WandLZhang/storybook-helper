import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * Set the text as large as it can be and still fit the box.
 *
 * Needed because page length swings from one short line to a dense paragraph, and both phonetic
 * fonts draw their romanization ABOVE the glyph inside the line box — so a line is roughly three
 * times its nominal height and eyeballing a size does not work. Same binary search as
 * lockscreen-translate's render.html fitText.
 *
 * Below `min` it stops shrinking and lets the box scroll: unreadably small is worse than scrolling.
 */
export function FitText({
  children,
  deps,
  min = 22,
  max = 150,
  className = '',
}: {
  children: React.ReactNode
  deps: unknown[]
  min?: number
  max?: number
  className?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(min)

  const fit = () => {
    const b = box.current
    const el = inner.current
    if (!b || !el) return
    let lo = min
    let hi = max
    // 8 iterations over a 22-150px range lands within half a pixel.
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2
      el.style.fontSize = `${mid}px`
      const fits = el.scrollHeight <= b.clientHeight && el.scrollWidth <= b.clientWidth
      if (fits) lo = mid
      else hi = mid
    }
    el.style.fontSize = `${lo}px`
    setSize(lo)
  }

  useLayoutEffect(fit, deps) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const b = box.current
    if (!b) return
    const ro = new ResizeObserver(fit)
    ro.observe(b)
    // The fonts are large and load late; refit once they are actually available or the first
    // measurement is against a fallback face with completely different metrics.
    document.fonts?.ready.then(fit).catch(() => {})
    return () => ro.disconnect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={box} className={`no-scrollbar h-full w-full overflow-y-auto ${className}`}>
      <div ref={inner} style={{ fontSize: size }} className="w-full">
        {children}
      </div>
    </div>
  )
}
