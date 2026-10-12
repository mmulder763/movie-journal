import { useEffect, useState, type CSSProperties } from 'react'
import type { MediaType } from '../types'
import { fetchTitleDetails, logoUrl, profileUrl, type TitleDetails } from '../lib/tmdb'
import { formatLongDate } from '../lib/dates'

// Binnen een sessie niet opnieuw ophalen bij heen-en-weer klikken
const cache = new Map<string, Promise<TitleDetails>>()

function loadDetails(mediaType: MediaType, tmdbId: number) {
  const key = `${mediaType}-${tmdbId}`
  let pending = cache.get(key)
  if (!pending) {
    pending = fetchTitleDetails(mediaType, tmdbId)
    pending.catch(() => cache.delete(key))
    cache.set(key, pending)
  }
  return pending
}

const languageName = (code?: string) => {
  if (!code) return undefined
  try {
    return new Intl.DisplayNames(['nl'], { type: 'language' }).of(code)
  } catch {
    return code
  }
}

const formatRuntime = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}u ${min % 60}m` : `${min}m`)

interface Props {
  mediaType: MediaType
  tmdbId: number
  title: string
}

/** Algemene filminfo in het detailscherm: verhaal, feiten, cast, streaming en trailer. */
export function TitleInfo({ mediaType, tmdbId, title }: Props) {
  const [details, setDetails] = useState<TitleDetails | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setDetails(null)
    setError(null)
    loadDetails(mediaType, tmdbId)
      .then((d) => !cancelled && setDetails(d))
      .catch((err) => !cancelled && setError((err as Error).message))
    return () => {
      cancelled = true
    }
  }, [mediaType, tmdbId])

  if (error) return <p className="muted small">Details konden niet geladen worden: {error}</p>
  if (!details) {
    return (
      <div className="title-info">
        <span className="skeleton-line" style={{ width: '90%' }} />
        <span className="skeleton-line" style={{ width: '75%' }} />
        <span className="skeleton-line" style={{ width: '60%' }} />
      </div>
    )
  }

  const facts: [string, string][] = []
  if (details.releaseDate) facts.push([mediaType === 'tv' ? 'Eerste uitzending' : 'Release', formatLongDate(details.releaseDate)])
  if (details.runtime) facts.push(['Speelduur', formatRuntime(details.runtime)])
  if (details.seasons) facts.push(['Seizoenen', `${details.seasons} · ${details.episodes ?? '?'} afleveringen`])
  if (details.status) facts.push(['Status', details.status])
  if (details.creators.names.length) facts.push([details.creators.label, details.creators.names.join(', ')])
  if (details.originalTitle && details.originalTitle !== title) facts.push(['Originele titel', details.originalTitle])
  const language = languageName(details.originalLanguage)
  if (language) facts.push(['Taal', language])

  return (
    <div className="title-info">
      {details.tagline && <p className="tagline">“{details.tagline}”</p>}
      {details.genres.length > 0 && (
        <div className="genre-chips">
          {details.genres.map((g) => <span key={g} className="genre-chip">{g}</span>)}
        </div>
      )}
      {details.overview && <p className="overview">{details.overview}</p>}

      {details.trailerKey && (
        <a className="btn-ghost trailer-btn" href={`https://www.youtube.com/watch?v=${details.trailerKey}`} target="_blank" rel="noreferrer">
          ▶ Bekijk trailer
        </a>
      )}

      {facts.length > 0 && (
        <dl className="facts">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {details.cast.length > 0 && (
        <>
          <h4 className="section-label">Cast</h4>
          <ul className="cast-row">
            {details.cast.map((c, i) => {
              const img = profileUrl(c.profilePath)
              return (
                <li key={`${c.name}-${i}`} style={{ '--i': i } as CSSProperties}>
                  {img ? <img src={img} alt="" loading="lazy" /> : <span className="cast-empty">{c.name[0]}</span>}
                  <strong>{c.name}</strong>
                  {c.character && <span>{c.character}</span>}
                </li>
              )
            })}
          </ul>
        </>
      )}

      {(details.streaming.length > 0 || details.rentBuy.length > 0) && (
        <>
          <h4 className="section-label">Kijken in Nederland</h4>
          <div className="providers">
            {details.streaming.map((p) => (
              <span key={p.name} className="provider" title={`${p.name} (abonnement)`}>
                <img src={logoUrl(p.logoPath)} alt="" />{p.name}
              </span>
            ))}
            {details.rentBuy.slice(0, 4).map((p) => (
              <span key={p.name} className="provider rent" title={`${p.name} (huren/kopen)`}>
                <img src={logoUrl(p.logoPath)} alt="" />{p.name}
              </span>
            ))}
          </div>
          {details.watchLink && (
            <a className="muted small" href={details.watchLink} target="_blank" rel="noreferrer">Bron: JustWatch via TMDB ↗</a>
          )}
        </>
      )}
    </div>
  )
}
