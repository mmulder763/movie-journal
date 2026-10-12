import type { CSSProperties } from 'react'
import type { WatchItem } from '../types'
import { formatLongDate } from '../lib/dates'
import { Poster } from './Poster'

interface Props {
  date: string
  count: number
  watchlist: WatchItem[]
  onAdd: () => void
  onView: () => void
  onPick: (item: WatchItem) => void
}

/** Menuutje bij een aangeklikte dag: toevoegen, dag bekijken of iets van je watchlist op deze dag zetten. */
export function DayMenu({ date, count, watchlist, onAdd, onView, onPick }: Props) {
  return (
    <>
      <span className="day-menu-date">{formatLongDate(date).replace(/^./, (c) => c.toUpperCase())}</span>
      <button className="day-menu-action primary" onClick={onAdd}>
        <span>＋</span> Film of serie toevoegen
      </button>
      {count > 0 && (
        <button className="day-menu-action" onClick={onView}>
          <span>👁</span> Bekijk dag <em>{count}</em>
        </button>
      )}
      {watchlist.length > 0 && (
        <>
          <span className="day-menu-label">Van je watchlist</span>
          <ul className="day-menu-watchlist">
            {watchlist.slice(0, 8).map((w, i) => (
              <li key={`${w.mediaType}-${w.tmdbId}`} style={{ '--i': i } as CSSProperties}>
                <button onClick={() => onPick(w)} title={`${w.title} op deze dag zetten`}>
                  <Poster path={w.posterPath} title={w.title} size="w92" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
