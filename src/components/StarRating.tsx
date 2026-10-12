import type { CSSProperties, MouseEvent } from 'react'

interface Props {
  /** 0.5 – 5 in stappen van 0.5 */
  value?: number
  onChange?: (value: number | undefined) => void
  size?: 'sm' | 'lg'
}

/** Rondt een (gemiddelde) rating af op halve sterren */
export const roundHalf = (n: number) => Math.round(n * 2) / 2

const fill = (n: number, value: number) => (value >= n ? 'on' : value >= n - 0.5 ? 'half' : '')

export function StarRating({ value = 0, onChange, size = 'sm' }: Props) {
  const shown = roundHalf(value)
  const label = `${String(shown).replace('.', ',')} van 5 sterren`

  if (!onChange) {
    return (
      <span className={`stars stars-${size}`} role="img" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => <span key={n} className={fill(n, shown)}>★</span>)}
      </span>
    )
  }

  // Linkerhelft van een ster = halve ster, rechterhelft = hele; nogmaals dezelfde waarde wist de rating
  const pick = (n: number) => (e: MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const next = e.clientX - r.left < r.width / 2 ? n - 0.5 : n
    onChange(next === value ? undefined : next)
  }

  return (
    <span className={`stars stars-${size}`} role="radiogroup" aria-label={value ? label : 'Geen rating'}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" className={fill(n, shown)} style={{ '--i': n } as CSSProperties}
          aria-label={`${n} ster${n > 1 ? 'ren' : ''} (links tikken voor een halve)`} onClick={pick(n)}>
          ★
        </button>
      ))}
    </span>
  )
}
