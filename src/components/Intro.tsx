import { useEffect, useState } from 'react'
import { prefersReducedMotion } from '../lib/motion'

const SESSION_KEY = 'movie-journal:intro-shown'
const STEP_MS = 420

/** Filmleader-countdown (3-2-1), één keer per sessie. Klik om over te slaan. */
export function Intro() {
  const [count, setCount] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) || prefersReducedMotion() ? 0 : 3
    } catch {
      return 0
    }
  })
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (count === 0) return
    try {
      sessionStorage.setItem(SESSION_KEY, '1')
    } catch { /* privémodus: dan maar elke keer */ }
    const timer = setTimeout(() => (count === 1 ? setLeaving(true) : setCount(count - 1)), STEP_MS)
    return () => clearTimeout(timer)
  }, [count])

  if (count === 0) return null

  return (
    <div className={`intro ${leaving ? 'leaving' : ''}`} onClick={() => setLeaving(true)}
      onAnimationEnd={(e) => e.target === e.currentTarget && leaving && setCount(0)}>
      <div className="leader">
        <div className="leader-sweep" key={count} />
        <span className="leader-num" key={`n${count}`}>{count}</span>
      </div>
      <span className="intro-title">Movie Journal</span>
    </div>
  )
}
