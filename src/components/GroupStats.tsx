import { useMemo, type CSSProperties } from 'react'
import type { Entry, WatchItem } from '../types'
import type { Profile } from '../lib/supabase'
import type { Friend } from '../lib/social'
import { titleKey } from '../lib/titles'
import { Avatar } from './FriendsView'
import { Poster } from './Poster'

interface Person {
  profile: Profile
  entries: Entry[]
  isMe: boolean
}

interface Props {
  me: Profile
  myEntries: Entry[]
  friends: Friend[]
  /** Jaartal ("2026") of "all" */
  period: string
  onOpenTitle: (item: WatchItem) => void
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined)

/** Statistieken over je hele groep: ranglijst, populairste en best beoordeelde titels. */
export function GroupStats({ me, myEntries, friends, period, onOpenTitle }: Props) {
  const people = useMemo<Person[]>(() => {
    const inPeriod = (es: Entry[]) => (period === 'all' ? es : es.filter((e) => e.date?.startsWith(period)))
    return [
      { profile: me, entries: inPeriod(myEntries), isMe: true },
      ...friends.map((f) => ({ profile: f as Profile, entries: inPeriod(f.journal.entries), isMe: false })),
    ]
  }, [me, myEntries, friends, period])

  const ranking = useMemo(
    () =>
      people
        .map((p) => {
          const titles = new Map(p.entries.map((e) => [titleKey(e), e.mediaType]))
          const movies = [...titles.values()].filter((t) => t === 'movie').length
          return { ...p, count: p.entries.length, movies, series: titles.size - movies, rating: avg(p.entries.flatMap((e) => (e.rating ? [e.rating] : []))) }
        })
        .sort((a, b) => b.count - a.count),
    [people],
  )
  const max = Math.max(1, ...ranking.map((r) => r.count))

  // Per titel: wie zag het en welke ratings
  const byTitle = useMemo(() => {
    const map = new Map<string, { item: WatchItem; viewers: Profile[]; ratings: number[] }>()
    for (const p of people) {
      for (const e of p.entries) {
        const key = titleKey(e)
        const cur = map.get(key) ?? {
          item: { tmdbId: e.tmdbId, mediaType: e.mediaType, title: e.title, posterPath: e.posterPath, backdropPath: e.backdropPath, year: e.year, addedAt: 0 },
          viewers: [],
          ratings: [],
        }
        if (!cur.viewers.some((v) => v.id === p.profile.id)) cur.viewers.push(p.profile)
        if (e.rating) cur.ratings.push(e.rating)
        map.set(key, cur)
      }
    }
    return [...map.values()]
  }, [people])

  const popular = useMemo(
    () => byTitle.filter((t) => t.viewers.length > 1).sort((a, b) => b.viewers.length - a.viewers.length || b.ratings.length - a.ratings.length).slice(0, 8),
    [byTitle],
  )
  const topRated = useMemo(
    () =>
      byTitle
        .filter((t) => t.ratings.length > 0)
        .map((t) => ({ ...t, score: avg(t.ratings)! }))
        .sort((a, b) => b.score - a.score || b.ratings.length - a.ratings.length)
        .slice(0, 8),
    [byTitle],
  )

  return (
    <>
      <article className="stats-card wide">
        <header><h3>Je groep</h3><span className="muted small">kijkmomenten {period === 'all' ? 'in totaal' : `in ${period}`}</span></header>
        <ul className="group-ranking">
          {ranking.map((r, i) => (
            <li key={r.profile.id} className={r.isMe ? 'me' : ''} style={{ '--i': i } as CSSProperties}>
              <span className="rank">{i + 1}</span>
              <Avatar profile={r.profile} size={34} />
              <span className="group-name">
                <strong>{r.isMe ? 'Jij' : r.profile.display_name}</strong>
                <span className="muted small">{r.movies} films · {r.series} series{r.rating != null && ` · ★ ${r.rating.toFixed(1)}`}</span>
              </span>
              <span className="bar-track group-bar"><span className="bar-fill" style={{ width: `${(r.count / max) * 100}%`, background: r.isMe ? '#1aa58f' : '#8a6cf0' }} /></span>
              <span className="bar-value">{r.count}</span>
            </li>
          ))}
        </ul>
      </article>

      <article className="stats-card wide">
        <header><h3>Populair in je groep</h3><span className="muted small">door meerdere mensen gezien</span></header>
        {popular.length === 0 ? (
          <p className="muted small">Nog geen titels die meerdere mensen zagen{period !== 'all' && ` in ${period}`}.</p>
        ) : (
          <TitleRow items={popular.map((t) => ({ ...t, sub: `${t.viewers.length} mensen` }))} onOpen={onOpenTitle} />
        )}
      </article>

      <article className="stats-card wide">
        <header><h3>Hoogst beoordeeld in je groep</h3><span className="muted small">gemiddelde van iedereen</span></header>
        {topRated.length === 0 ? (
          <p className="muted small">Nog geen ratings{period !== 'all' && ` in ${period}`}.</p>
        ) : (
          <TitleRow items={topRated.map((t) => ({ ...t, sub: `★ ${t.score.toFixed(1)} · ${t.ratings.length}×` }))} onOpen={onOpenTitle} />
        )}
      </article>
    </>
  )
}

function TitleRow({ items, onOpen }: { items: { item: WatchItem; viewers: Profile[]; sub: string }[]; onOpen: (item: WatchItem) => void }) {
  return (
    <ul className="group-titles">
      {items.map(({ item, viewers, sub }, i) => (
        <li key={titleKey(item)} style={{ '--i': i } as CSSProperties}>
          <button onClick={() => onOpen(item)}>
            <Poster path={item.posterPath} title={item.title} size="w185" />
            <span className="group-title-name">{item.title}</span>
            <span className="muted small">{sub}</span>
            <span className="avatar-stack">
              {viewers.slice(0, 4).map((v) => <Avatar key={v.id} profile={v} size={22} />)}
              {viewers.length > 4 && <span className="avatar-more">+{viewers.length - 4}</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
