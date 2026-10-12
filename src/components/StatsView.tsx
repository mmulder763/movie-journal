import { useMemo, useState, type CSSProperties } from 'react'
import type { Entry } from '../types'
import { summarizeTitles } from '../lib/titles'
import { useWatchTime } from '../lib/watchTime'
import { useTitleMeta } from '../lib/titleMeta'
import { useCountUp } from '../lib/motion'
import { profileUrl } from '../lib/tmdb'
import { fromISODate } from '../lib/dates'
import { BarList, ColumnChart, Legend } from './Charts'
import { ShareDialog } from './ShareDialog'

// Gevalideerd tegen de donkere achtergrond (dataviz-validator: alle checks PASS)
const FILM = '#1aa58f'
const SERIE = '#8a6cf0'

const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const WEEKDAYS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']

interface Props {
  entries: Entry[]
}

export function StatsView({ entries }: Props) {
  const years = useMemo(
    () => [...new Set(entries.flatMap((e) => (e.date ? [e.date.slice(0, 4)] : [])))].sort().reverse(),
    [entries],
  )
  const [period, setPeriod] = useState<string>(() => String(new Date().getFullYear()))
  const [sharing, setSharing] = useState(false)
  const activePeriod = period === 'all' || years.includes(period) ? period : 'all'

  const scoped = useMemo(
    () => (activePeriod === 'all' ? entries : entries.filter((e) => e.date?.startsWith(activePeriod))),
    [entries, activePeriod],
  )
  const titles = useMemo(() => summarizeTitles(scoped), [scoped])
  const watchTime = useWatchTime(titles)
  const meta = useTitleMeta(titles)

  const movies = titles.filter((t) => t.mediaType === 'movie').length
  const ratings = scoped.flatMap((e) => (e.rating ? [e.rating] : []))
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : undefined

  // Per maand (gekozen jaar) of per jaar (alles), gestapeld film/serie
  const timeline = useMemo(() => {
    const dated = scoped.filter((e): e is Entry & { date: string } => !!e.date)
    const buckets = activePeriod === 'all' ? [...years].reverse() : MONTHS.map((_, i) => String(i))
    return buckets.map((b) => {
      const inBucket = dated.filter((e) => (activePeriod === 'all' ? e.date.startsWith(b) : fromISODate(e.date).getMonth() === Number(b)))
      const film = inBucket.filter((e) => e.mediaType === 'movie').length
      return {
        label: activePeriod === 'all' ? b : MONTHS[Number(b)],
        segments: [
          { name: 'Films', value: film, color: FILM },
          { name: 'Series', value: inBucket.length - film, color: SERIE },
        ],
      }
    })
  }, [scoped, activePeriod, years])

  const weekdays = useMemo(() => {
    const counts = Array(7).fill(0) as number[]
    for (const e of scoped) if (e.date) counts[(fromISODate(e.date).getDay() + 6) % 7]++
    return WEEKDAYS.map((label, i) => ({ label, segments: [{ name: 'Kijkmomenten', value: counts[i], color: FILM }] }))
  }, [scoped])

  const ratingColumns = [1, 2, 3, 4, 5].map((n) => ({
    label: '★'.repeat(n),
    segments: [{ name: 'Keer', value: ratings.filter((r) => r === n).length, color: FILM }],
  }))

  const { genres, creators, cast, metaLoaded } = useMemo(() => {
    const genreCount = new Map<string, number>()
    const creatorCount = new Map<string, number>()
    const castCount = new Map<number, { name: string; profilePath: string | null; count: number }>()
    let loaded = 0
    for (const t of titles) {
      const m = meta[t.key]
      if (!m) continue
      loaded++
      for (const g of m.genres) genreCount.set(g, (genreCount.get(g) ?? 0) + 1)
      for (const c of m.creators) creatorCount.set(c, (creatorCount.get(c) ?? 0) + 1)
      for (const c of m.cast) {
        const cur = castCount.get(c.id)
        castCount.set(c.id, { name: c.name, profilePath: c.profilePath, count: (cur?.count ?? 0) + 1 })
      }
    }
    const top = (m: Map<string, number>, n: number) =>
      [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([label, value]) => ({ label, value }))
    return {
      genres: top(genreCount, 8),
      creators: top(creatorCount, 5),
      cast: [...castCount.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 10),
      metaLoaded: loaded,
    }
  }, [titles, meta])

  const periodLabel = activePeriod === 'all' ? 'Alles' : activePeriod

  return (
    <section className="stats-view">
      <div className="stats-top">
        <div className="chips">
          {years.map((y) => (
            <button key={y} className={`chip ${activePeriod === y ? 'active' : ''}`} onClick={() => setPeriod(y)}>{y}</button>
          ))}
          <button className={`chip ${activePeriod === 'all' ? 'active' : ''}`} onClick={() => setPeriod('all')}>Alles</button>
        </div>
        <button className="btn-primary" onClick={() => setSharing(true)} disabled={scoped.length === 0}>↗ Deel</button>
      </div>

      {scoped.length === 0 ? (
        <p className="empty">Nog geen kijkmomenten in deze periode.</p>
      ) : (
        <>
          <div className="stat-tiles">
            <Tile value={Math.round(watchTime.minutes / 60)} label="Uur gekeken" />
            <Tile value={scoped.length} label="Kijkmomenten" />
            <Tile value={movies} label="Films" color={FILM} />
            <Tile value={titles.length - movies} label="Series" color={SERIE} />
            <Tile value={scoped.filter((e) => e.cinema).length} label="Bioscoopbezoeken" />
            <Tile value={avgRating} decimals={1} prefix="★ " label="Gem. rating" />
          </div>

          <div className="stats-grid">
            <article className="stats-card wide">
              <header>
                <h3>{activePeriod === 'all' ? 'Per jaar' : `Per maand in ${activePeriod}`}</h3>
                <Legend items={[{ name: 'Films', color: FILM }, { name: 'Series', color: SERIE }]} />
              </header>
              <ColumnChart columns={timeline} caption="Kijkmomenten per periode" />
              {activePeriod === 'all' && scoped.some((e) => !e.date) && (
                <p className="muted small">{scoped.filter((e) => !e.date).length} kijkmomenten zonder datum tellen hier niet mee.</p>
              )}
            </article>

            <article className="stats-card">
              <header><h3>Genres</h3></header>
              {genres.length ? <BarList rows={genres} caption="Titels per genre" color={FILM} /> : <Loading loaded={metaLoaded} total={titles.length} />}
            </article>

            <article className="stats-card">
              <header><h3>Je ratings</h3></header>
              {ratings.length ? <ColumnChart columns={ratingColumns} caption="Aantal keer per rating" height={130} /> : <p className="muted small">Nog geen ratings gegeven.</p>}
            </article>

            <article className="stats-card">
              <header><h3>Wanneer kijk je?</h3></header>
              <ColumnChart columns={weekdays} caption="Kijkmomenten per weekdag" height={130} />
            </article>

            <article className="stats-card">
              <header><h3>Regie &amp; makers</h3></header>
              {creators.length ? <BarList rows={creators} caption="Titels per regisseur of maker" color={SERIE} /> : <Loading loaded={metaLoaded} total={titles.length} />}
            </article>

            <article className="stats-card wide">
              <header><h3>Acteurs die je het vaakst zag</h3></header>
              {cast.length ? (
                <ul className="cast-row stats-cast">
                  {cast.map((c, i) => {
                    const img = profileUrl(c.profilePath)
                    return (
                      <li key={c.name} style={{ '--i': i } as CSSProperties}>
                        {img ? <img src={img} alt="" loading="lazy" /> : <span className="cast-empty">{c.name[0]}</span>}
                        <strong>{c.name}</strong>
                        <span>{c.count}× gezien</span>
                      </li>
                    )
                  })}
                </ul>
              ) : <Loading loaded={metaLoaded} total={titles.length} />}
            </article>
          </div>
        </>
      )}

      {sharing && (
        <ShareDialog
          eyebrow={activePeriod === 'all' ? 'Mijn filmgeschiedenis' : 'Mijn filmjaar'}
          title={periodLabel}
          entries={scoped}
          onClose={() => setSharing(false)}
        />
      )}
    </section>
  )
}

function Tile({ value, label, decimals = 0, prefix = '', color }: { value?: number; label: string; decimals?: number; prefix?: string; color?: string }) {
  const shown = useCountUp(value ?? 0)
  return (
    <div className="stat">
      <strong style={color ? { color } : undefined}>{value == null ? '–' : `${prefix}${shown.toFixed(decimals)}`}</strong>
      <span>{label}</span>
    </div>
  )
}

function Loading({ loaded, total }: { loaded: number; total: number }) {
  return <p className="muted small">{loaded < total ? `Gegevens ophalen… ${loaded}/${total}` : 'Geen gegevens beschikbaar.'}</p>
}
