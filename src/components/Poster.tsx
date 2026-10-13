import { useState } from 'react'
import { FilmIcon } from './Icons'
import { posterUrl } from '../lib/tmdb'

interface Props {
  path: string | null
  title: string
  size?: 'w92' | 'w185' | 'w342' | 'w500'
  className?: string
}

export function Poster({ path, title, size = 'w185', className = '' }: Props) {
  const [loaded, setLoaded] = useState(false)
  const src = posterUrl(path, size)
  return src ? (
    <img
      className={`poster ${loaded ? 'loaded' : ''} ${className}`}
      src={src}
      alt={title}
      loading="lazy"
      // Ook bij een cache-hit (al geladen voordat React de handler koppelt)
      ref={(img) => { if (img?.complete && img.naturalWidth) setLoaded(true) }}
      onLoad={() => setLoaded(true)}
    />
  ) : (
    <div className={`poster poster-empty ${className}`} aria-label={title}><FilmIcon size={22} /></div>
  )
}
