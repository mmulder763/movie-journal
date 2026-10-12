import { useEffect, useState } from 'react'

export const prefersReducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Telt soepel op naar `target` (voor statistieken). */
export function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(prefersReducedMotion() ? target : 0)

  // Animeert vanaf de huidige waarde naar elk nieuw doel
  useEffect(() => {
    if (prefersReducedMotion()) return setValue(target)
    let frame = 0
    const from = value
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      setValue(from + (target - from) * (1 - Math.pow(1 - p, 3)))
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])

  return value
}
