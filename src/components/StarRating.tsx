import type { CSSProperties } from 'react'

interface Props {
  value?: number
  onChange?: (value: number | undefined) => void
  size?: 'sm' | 'lg'
}

export function StarRating({ value = 0, onChange, size = 'sm' }: Props) {
  const readOnly = !onChange
  return (
    <span className={`stars stars-${size}`} role={readOnly ? 'img' : 'radiogroup'} aria-label={`${value} van 5 sterren`}>
      {[1, 2, 3, 4, 5].map((n) =>
        readOnly ? (
          <span key={n} className={n <= value ? 'on' : ''}>★</span>
        ) : (
          <button
            key={n}
            type="button"
            className={n <= value ? 'on' : ''}
            style={{ '--i': n } as CSSProperties}
            aria-label={`${n} ster${n > 1 ? 'ren' : ''}`}
            // Nogmaals op dezelfde ster klikken wist de rating
            onClick={() => onChange(n === value ? undefined : n)}
          >
            ★
          </button>
        ),
      )}
    </span>
  )
}
