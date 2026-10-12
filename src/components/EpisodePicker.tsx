import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { Entry } from '../types'
import { fetchSeasonEpisodes, fetchSeasons, type EpisodeInfo, type SeasonInfo } from '../lib/tmdb'
import { today } from '../lib/dates'

// Seizoens-/afleveringsdata zijn per sessie stabiel genoeg om in het geheugen te houden
const seasonCache = new Map<number, Promise<SeasonInfo[]>>()
const episodeCache = new Map<string, Promise<EpisodeInfo[]>>()

function cached<K, V>(map: Map<K, Promise<V>>, key: K, load: () => Promise<V>) {
  let p = map.get(key)
  if (!p) {
    p = load()
    p.catch(() => map.delete(key))
    map.set(key, p)
  }
  return p
}

export const loadSeasons = (tvId: number) => cached(seasonCache, tvId, () => fetchSeasons(tvId))

const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: '2-digit' })

export interface EpisodeSelection {
  season: number
  episodes: number[]
}

interface Props {
  tvId: number
  /** Eerdere kijkmomenten van deze serie, om gezien-status te tonen */
  history: Entry[]
  value: EpisodeSelection
  onChange: (value: EpisodeSelection) => void
  /** Meerdere afleveringen tegelijk aanvinken (nieuw kijkmoment) of precies één (bewerken) */
  multiple: boolean
}

/** Kies seizoen + aflevering(en); laat zien welke je al zag en wanneer. */
export function EpisodePicker({ tvId, history, value, onChange, multiple }: Props) {
  const [seasons, setSeasons] = useState<SeasonInfo[] | null>(null)
  const [episodes, setEpisodes] = useState<EpisodeInfo[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadSeasons(tvId)
      .then((s) => !cancelled && setSeasons(s))
      .catch((err) => !cancelled && setError((err as Error).message))
    return () => {
      cancelled = true
    }
  }, [tvId])

  useEffect(() => {
    let cancelled = false
    setEpisodes(null)
    cached(episodeCache, `${tvId}-${value.season}`, () => fetchSeasonEpisodes(tvId, value.season))
      .then((e) => !cancelled && setEpisodes(e))
      .catch((err) => !cancelled && setError((err as Error).message))
    return () => {
      cancelled = true
    }
  }, [tvId, value.season])

  /** "seizoen-aflevering" → laatste datum (of "" als gezien zonder datum) */
  const seen = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of history) {
      if (e.season == null || e.episode == null) continue
      const key = `${e.season}-${e.episode}`
      const prev = map.get(key)
      if (prev === undefined || (e.date ?? '') > prev) map.set(key, e.date ?? '')
    }
    return map
  }, [history])

  const seenInSeason = (n: number) => [...seen.keys()].filter((k) => k.startsWith(`${n}-`)).length
  const todayIso = today()
  const aired = (ep: EpisodeInfo) => !ep.airDate || ep.airDate <= todayIso

  const toggle = (n: number) => {
    if (!multiple) return onChange({ ...value, episodes: [n] })
    const has = value.episodes.includes(n)
    onChange({ ...value, episodes: has ? value.episodes.filter((x) => x !== n) : [...value.episodes, n].sort((a, b) => a - b) })
  }

  const selectUnseen = () =>
    episodes && onChange({ ...value, episodes: episodes.filter((e) => aired(e) && !seen.has(`${value.season}-${e.number}`)).map((e) => e.number) })

  if (error) return <p className="error small">Afleveringen laden mislukt: {error}</p>

  return (
    <div className="episode-picker">
      <div className="chips season-chips">
        {(seasons ?? []).map((s) => {
          const done = seenInSeason(s.number)
          return (
            <button type="button" key={s.number} className={`chip ${value.season === s.number ? 'active' : ''}`}
              onClick={() => onChange({ season: s.number, episodes: [] })}>
              {s.number === 0 ? 'Specials' : `S${s.number}`}
              <span className="chip-count">{done}/{s.episodeCount}</span>
            </button>
          )
        })}
      </div>

      {multiple && episodes && (
        <div className="episode-tools">
          <span className="muted small">{value.episodes.length ? `${value.episodes.length} geselecteerd` : 'Vink aan wat je hebt gekeken'}</span>
          <button type="button" className="btn-text" onClick={selectUnseen}>Alle ongeziene</button>
        </div>
      )}

      <ul className="episode-list">
        {!episodes
          ? Array.from({ length: 4 }, (_, i) => <li key={i} className="episode-skeleton" />)
          : episodes.map((ep, i) => {
              const seenDate = seen.get(`${value.season}-${ep.number}`)
              const selected = value.episodes.includes(ep.number)
              const upcoming = !aired(ep)
              return (
                <li key={ep.number} style={{ '--i': Math.min(i, 12) } as CSSProperties}>
                  <button type="button" className={`episode ${selected ? 'selected' : ''} ${seenDate !== undefined ? 'seen' : ''}`}
                    onClick={() => toggle(ep.number)} disabled={upcoming} aria-pressed={selected}>
                    <span className="episode-check" aria-hidden>{selected ? '✓' : ''}</span>
                    <span className="episode-num">E{ep.number}</span>
                    <span className="episode-name">{ep.name}</span>
                    <span className="episode-meta">
                      {upcoming
                        ? `vanaf ${shortDate(ep.airDate!)}`
                        : seenDate !== undefined
                          ? `✓ ${seenDate ? shortDate(seenDate) : 'gezien'}`
                          : ep.runtime ? `${ep.runtime}m` : ''}
                    </span>
                  </button>
                </li>
              )
            })}
      </ul>
    </div>
  )
}

/** Voortgangsbalken per seizoen, op basis van de gelogde afleveringen. */
export function SeasonProgress({ tvId, history }: { tvId: number; history: Entry[] }) {
  const [seasons, setSeasons] = useState<SeasonInfo[] | null>(null)

  useEffect(() => {
    let cancelled = false
    loadSeasons(tvId).then((s) => !cancelled && setSeasons(s)).catch(() => {})
    return () => {
      cancelled = true
    }
  }, [tvId])

  if (!seasons) return null
  const wholeSeries = history.some((e) => e.season == null && e.episode == null)
  const regular = seasons.filter((s) => s.number > 0)
  const seenIn = (n: number) => new Set(history.filter((e) => e.season === n && e.episode != null).map((e) => e.episode)).size
  const fullSeasons = new Set(history.filter((e) => e.season != null && e.episode == null).map((e) => e.season))

  return (
    <div className="season-progress">
      {wholeSeries && <span className="muted small">Ooit helemaal gezien (zonder afleveringen gelogd)</span>}
      {regular.map((s, i) => {
        const done = fullSeasons.has(s.number) ? s.episodeCount : Math.min(seenIn(s.number), s.episodeCount)
        return (
          <div key={s.number} className="season-row" style={{ '--i': i } as CSSProperties}>
            <span className="season-label">S{s.number}</span>
            <span className="season-track"><span style={{ width: `${(done / s.episodeCount) * 100}%` }} /></span>
            <span className="season-count">{done}/{s.episodeCount}</span>
          </div>
        )
      })}
    </div>
  )
}
