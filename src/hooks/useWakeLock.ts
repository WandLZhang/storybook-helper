import { useEffect, useRef } from 'react'

/**
 * Hold the screen awake while a book is open — hands are on the paper book, not the phone.
 *
 * The browser silently drops the lock whenever the tab is hidden (or the screen locks anyway), so
 * it has to be re-acquired on visibilitychange; acquiring once is the classic bug here.
 */
export function useWakeLock(active: boolean) {
  const held = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let dead = false

    const acquire = async () => {
      if (dead || document.visibilityState !== 'visible' || held.current) return
      try {
        held.current = await navigator.wakeLock.request('screen')
        held.current.addEventListener('release', () => {
          held.current = null
        })
      } catch {
        /* denied or unsupported — reading still works, the screen just dims */
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire()
    }

    acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      dead = true
      document.removeEventListener('visibilitychange', onVisible)
      held.current?.release().catch(() => {})
      held.current = null
    }
  }, [active])
}
