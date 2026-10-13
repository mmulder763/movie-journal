import { useMemo, useState, type CSSProperties } from 'react'
import { ShareIcon } from './Icons'
import type { Entry } from '../types'
import { summarizeTitles } from '../lib/titles'
import { useWatchTime, type WatchTime } from '../lib/watchTime'
import { useTitleMeta } from '../lib/titleMeta'
import { useCountUp } from '../lib/motion'
import { profileUrl } from '../lib/tmdb'
import { fromISODate } from '../lib/dates'
import { BarList, ColumnChart, Legend } from './Charts'
import { ShareDialog } from './ShareDialog'
import { GroupStats } from './GroupStats'
import { Avatar } from './FriendsView'
import type { Profile } from '../lib/supabase'
import type { Friend } from '../lib/social'
import type { WatchItem } from '../types'

// Gevalideerd tegen de donkere achtergrond (dataviz-validator: alle checks PASS)
const FILM = '#1aa58f'
const SERIE = '#8a6cf0'

const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const WEEKDAYS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']

interface Props {
  entries: Entry[]
  /** Voor de groepsstatistieken (alleen met accounts) */
  me?: Profile | null
  friends?: Friend[]
  onOpenTitle?: (item: WatchItem) => void
}

export function StatsView({ entries: myEntries, me, friends = [], onOpenTitle }: Props) {
  // Wiens statistieken: jijzelf ('me') of een vriend (profiel-id)
  const [person, setPerson] = useState<string>('me')
  const selectedFriend = friends.find((f) => f.id === person)
  const entries = selectedFriend ? selectedFriend.journal.entries : myEntries
  const isMine = !selectedFriend
  const years = useMemo(
    () => [...new Set(entries.flatMap((e) => (e.date ? [e.date.slice(0, 4)] : [])))].sort().reverse(),
    [entries],
  )
  // Standaard alles: titels zonder datum (bv. via swipen) tellen alleen daar mee
  const [period, setPeriod] = useState<string>('all')
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

  // Kolommen per halve ster, maar alleen halve stappen tonen als die ook gebruikt worden
  const usesHalves = ratings.some((r) => r % 1 !== 0)
  const ratingSteps = usesHalves ? [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] : [1, 2, 3, 4, 5]
  const ratingColumns = ratingSteps.map((n) => ({
    label: String(n).replace('.', ','),
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
      {me && friends.length > 0 && (
        <div className="chips person-chips">
          <button className={`chip ${isMine ? 'active' : ''}`} onClick={() => setPerson('me')}>
            <Avatar profile={me} size={22} /> Jij
          </button>
          {friends.map((f) => (
            <button key={f.id} className={`chip ${person === f.id ? 'active' : ''}`} onClick={() => setPerson(f.id)}>
              <Avatar profile={f} size={22} /> {f.display_name.split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      <div className="stats-top">
        <div className="chips">
          {years.map((y) => (
            <button key={y} className={`chip ${activePeriod === y ? 'active' : ''}`} onClick={() => setPeriod(y)}>{y}</button>
          ))}
          <button className={`chip ${activePeriod === 'all' ? 'active' : ''}`} onClick={() => setPeriod('all')}>Alles</button>
        </div>
        {isMine && <button className="btn-primary with-icon" onClick={() => setSharing(true)} disabled={scoped.length === 0}><ShareIcon size={16} /> Deel</button>}
      </div>

      {scoped.length === 0 ? (
        <p className="empty">Nog geen kijkmomenten in deze periode.</p>
      ) : (
        <>
          <WatchTimeHero time={watchTime} />
          {activePeriod !== 'all' && entries.some((e) => !e.date) && (
            <p className="muted small stats-note">
              {new Set(entries.filter((e) => !e.date).map((e) => `${e.mediaType}-${e.tmdbId}`)).size} titels zonder datum (zoals geswipete series) tellen alleen mee bij <button className="link-btn" onClick={() => setPeriod('all')}>Alles</button>.
            </p>
          )}
          <div className="stat-tiles">
            <Tile value={scoped.length} label="Kijkmomenten" />
            <Tile value={movies} label="Films" color={FILM} />
            <Tile value={titles.length - movies} label="Series" color={SERIE} />
            <Tile value={avgRating} decimals={1} label="Gem. rating" />
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

            {isMine && me && friends.length > 0 && onOpenTitle && (
              <GroupStats me={me} myEntries={entries} friends={friends} period={activePeriod} onOpenTitle={onOpenTitle} />
            )}

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

function WatchTimeHero({ time }: { time: WatchTime }) {
  const hours = useCountUp(time.minutes / 60, 1400)
  const days = Math.floor(time.minutes / 1440)
  const restHours = Math.floor((time.minutes % 1440) / 60)
  const pending = time.total - time.loaded - time.failed

  return (
    <div className="watch-time">
      <span className="eyebrow">Totale kijktijd</span>
      <div className="watch-time-main">
        <strong>{Math.round(hours).toLocaleString('nl-NL')}</strong>
        <span>uur</span>
      </div>
      <span className="muted small">
        {time.minutes === 0 && pending === 0
          ? 'Nog niets om op te tellen'
          : days > 0
            ? `≈ ${days} ${days === 1 ? 'dag' : 'dagen'} en ${restHours} uur van je leven aan films en series`
            : `${Math.floor(time.minutes / 60)} uur en ${Math.round(time.minutes % 60)} minuten aan films en series`}
      </span>
      {pending > 0 && (
        <div className="watch-time-progress" aria-label="Speelduren ophalen">
          <span style={{ width: `${(time.loaded / time.total) * 100}%` }} />
          <em>Speelduren ophalen… {time.loaded}/{time.total}</em>
        </div>
      )}
      {time.failed > 0 && pending === 0 && (
        <span className="muted small">{time.failed} titel(s) zonder bekende speelduur niet meegeteld</span>
      )}
    </div>
  )
}
