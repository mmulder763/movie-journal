import { useId, type CSSProperties, type MouseEvent } from 'react'

interface Props {
  /** 0.5 – 5 in stappen van 0.5 */
  value?: number
  onChange?: (value: number | undefined) => void
  size?: 'sm' | 'lg'
}

/** Rondt een (gemiddelde) rating af op halve sterren */
export const roundHalf = (n: number) => Math.round(n * 2) / 2

const STAR = 'M12 2.8l2.75 5.6 6.15.9-4.45 4.33 1.05 6.12L12 16.85l-5.5 2.9 1.05-6.12L3.1 9.3l6.15-.9z'

/** Eén ster in de app-stijl: vol, half of leeg */
export function Star({ fill = 'full', size = 14 }: { fill?: 'full' | 'half' | 'empty'; size?: number }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg className={`star star-${fill}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8ff5c8" />
          <stop offset="1" stopColor="#14b8a6" />
        </linearGradient>
        <clipPath id={`h${id}`}><rect x="0" y="0" width="12" height="24" /></clipPath>
      </defs>
      <path d={STAR} fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.22)" strokeWidth="1.2" strokeLinejoin="round" />
      {fill !== 'empty' && (
        <path d={STAR} fill={`url(#g${id})`} stroke={`url(#g${id})`} strokeWidth="1.2" strokeLinejoin="round"
          clipPath={fill === 'half' ? `url(#h${id})` : undefined} />
      )}
    </svg>
  )
}

const fillOf = (n: number, value: number) => (value >= n ? 'full' : value >= n - 0.5 ? 'half' : 'empty') as 'full' | 'half' | 'empty'

export function StarRating({ value = 0, onChange, size = 'sm' }: Props) {
  const shown = roundHalf(value)
  const label = `${String(shown).replace('.', ',')} van 5 sterren`
  const px = size === 'lg' ? 34 : 14

  if (!onChange) {
    return (
      <span className={`stars stars-${size}`} role="img" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => <Star key={n} fill={fillOf(n, shown)} size={px} />)}
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
        <button key={n} type="button" className={fillOf(n, shown) !== 'empty' ? 'on' : ''} style={{ '--i': n } as CSSProperties}
          aria-label={`${n} ster${n > 1 ? 'ren' : ''} (links tikken voor een halve)`} onClick={pick(n)}>
          <Star fill={fillOf(n, shown)} size={px} />
        </button>
      ))}
    </span>
  )
}

/** Compacte score: ster + getal (bijv. op posters en in lijsten) */
export function StarScore({ value, size = 12 }: { value: number; size?: number }) {
  return (
    <span className="star-score"><Star size={size} /> {value.toFixed(1)}</span>
  )
}
