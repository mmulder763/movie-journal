import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { prefersReducedMotion } from '../lib/motion'

const SESSION_KEY = 'movie-journal:intro-shown'
const DURATION_MS = 2900
const WORD = 'MOVIE JOURNAL'
const STREAK_COLORS = ['#3ee8a0', '#14b8a6', '#8b6cff', '#5eead4', '#a48bff', '#ff7ab6', '#2fc4ac']

/**
 * Netflix-achtige opening (één keer per sessie, tik om over te slaan):
 * het logo licht op, het woordmerk verschijnt, en dan zoom je het logo in
 * terwijl gekleurde lichtstralen uit elkaar spatten.
 */
export function Intro() {
  const [visible, setVisible] = useState(() => {
    try {
      return !sessionStorage.getItem(SESSION_KEY) && !prefersReducedMotion()
    } catch {
      return false
    }
  })
  const [leaving, setLeaving] = useState(false)

  // Lichtstralen met willekeurige kleur, breedte en vertraging (eenmalig per mount)
  const streaks = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        color: STREAK_COLORS[i % STREAK_COLORS.length],
        x: (i - 13.5) * 3.2 + (Math.random() - 0.5) * 2,
        w: 0.6 + Math.random() * 2.2,
        delay: Math.random() * 0.25,
      })),
    [],
  )

  useEffect(() => {
    if (!visible) return
    try {
      sessionStorage.setItem(SESSION_KEY, '1')
    } catch { /* privémodus: dan maar elke keer */ }
    const leave = setTimeout(() => setLeaving(true), DURATION_MS - 450)
    const done = setTimeout(() => setVisible(false), DURATION_MS)
    return () => {
      clearTimeout(leave)
      clearTimeout(done)
    }
  }, [visible])

  if (!visible) return null

  return (
    <div className={`intro ${leaving ? 'leaving' : ''}`} onClick={() => setVisible(false)} aria-hidden>
      <div className="intro-streaks">
        {streaks.map((s, i) => (
          <span key={i} style={{ '--x': `${s.x}vw`, '--w': `${s.w}vw`, '--c': s.color, '--d': `${s.delay}s` } as CSSProperties} />
        ))}
      </div>
      <div className="intro-stage">
        <div className="intro-glow" />
        <img className="intro-logo" src={`${import.meta.env.BASE_URL}icon.svg`} alt="" />
        <div className="intro-word">
          {[...WORD].map((ch, i) => (
            <span key={i} style={{ '--i': i } as CSSProperties} className={i >= 6 ? 'accent' : undefined}>
              {ch === ' ' ? ' ' : ch}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
