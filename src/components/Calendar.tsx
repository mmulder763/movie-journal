import { useEffect, useRef, type CSSProperties } from 'react'
import type { Entry } from '../types'
import { WEEKDAYS, formatMonth, monthGrid, toISODate, today } from '../lib/dates'
import { Poster } from './Poster'

interface Props {
  year: number
  month: number
  entriesByDate: Map<string, Entry[]>
  selected: string
  onSelect: (date: string) => void
  onMonthChange: (delta: number) => void
  onToday: () => void
  onShare?: () => void
}

export function Calendar({ year, month, entriesByDate, selected, onSelect, onMonthChange, onToday, onShare }: Props) {
  const todayIso = today()
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthCount = [...entriesByDate].reduce((n, [date, list]) => (date.startsWith(monthPrefix) ? n + list.length : n), 0)

  // Schuifrichting van de maand-animatie
  const monthIndex = year * 12 + month
  const previous = useRef(monthIndex)
  const direction = monthIndex < previous.current ? 'from-left' : 'from-right'
  useEffect(() => {
    previous.current = monthIndex
  }, [monthIndex])

  return (
    <section className="calendar">
      <header className="calendar-header">
        <button className="icon-btn" onClick={() => onMonthChange(-1)} aria-label="Vorige maand">‹</button>
        <div className="calendar-title" key={monthIndex}>
          <h2>{formatMonth(year, month)}</h2>
          <span className="muted small">{monthCount === 0 ? 'Nog niets gekeken' : `${monthCount}× gekeken`}</span>
        </div>
        <button className="icon-btn" onClick={() => onMonthChange(1)} aria-label="Volgende maand">›</button>
        <button className="btn-ghost" onClick={onToday}>Vandaag</button>
        {onShare && monthCount > 0 && (
          <button className="icon-btn share-btn" onClick={onShare} aria-label="Deel deze maand" title="Deel deze maand">↗</button>
        )}
      </header>

      <div className="calendar-weekdays">
        {WEEKDAYS.map((d) => (
          <div key={d} className="weekday">{d}</div>
        ))}
      </div>

      <div className={`calendar-grid ${direction}`} key={monthIndex}>
        {monthGrid(year, month).map((day, i) => {
          const iso = toISODate(day)
          const dayEntries = entriesByDate.get(iso) ?? []
          const classes = [
            'day',
            day.getMonth() !== month && 'outside',
            iso === todayIso && 'today',
            iso === selected && 'selected',
            dayEntries.length > 0 && 'has-entries',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <button key={iso} className={classes} onClick={() => onSelect(iso)} style={{ '--i': i } as CSSProperties}>
              {dayEntries.length > 0 && (
                <Poster path={dayEntries[0].posterPath} title={dayEntries[0].title} size="w185" className="day-poster" />
              )}
              <span className="day-number">{day.getDate()}</span>
              {dayEntries.length > 1 && <span className="day-count">+{dayEntries.length - 1}</span>}
              {dayEntries.some((e) => e.cinema) && <span className="day-cinema" aria-label="Bioscoop">🎟️</span>}
            </button>
          )
        })}
      </div>
    </section>
  )
}
