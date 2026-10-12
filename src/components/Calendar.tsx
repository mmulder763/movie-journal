import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
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
  /** Inhoud van het menuutje dat bij een aangeklikte dag verschijnt */
  renderDayMenu?: (date: string, close: () => void) => ReactNode
}

const MENU_WIDTH = 280
/** Ongeveer de hoogte van het menu met watchlist-rij, om boven/onder te kiezen */
const MENU_HEIGHT_ESTIMATE = 230

export function Calendar({ year, month, entriesByDate, selected, onSelect, onMonthChange, onToday, onShare, renderDayMenu }: Props) {
  const todayIso = today()
  const root = useRef<HTMLElement>(null)
  const [menu, setMenu] = useState<{ date: string; top: number; left: number; above: boolean } | null>(null)
  const closeMenu = () => setMenu(null)

  // Menu sluiten bij klikken buiten het menu, Escape of maandwissel
  useEffect(() => {
    if (!menu) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeMenu()
    const onDown = (e: PointerEvent) => !(e.target as HTMLElement).closest('.day-menu, .day') && closeMenu()
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [menu])
  useEffect(closeMenu, [year, month])

  const openMenu = (iso: string, e: MouseEvent<HTMLButtonElement>) => {
    onSelect(iso)
    if (!renderDayMenu || !root.current) return
    if (menu?.date === iso) return closeMenu()
    const box = root.current.getBoundingClientRect()
    const cell = e.currentTarget.getBoundingClientRect()
    // Onder de dag als daar genoeg zichtbare ruimte is (boven de tabbar), anders erboven; horizontaal binnen de kalender
    const bottomLimit = window.innerHeight - (window.innerWidth < 900 ? 110 : 16)
    const above = cell.bottom + MENU_HEIGHT_ESTIMATE > bottomLimit && cell.top - MENU_HEIGHT_ESTIMATE > 0
    const left = Math.min(Math.max(cell.left - box.left + cell.width / 2 - MENU_WIDTH / 2, 8), box.width - MENU_WIDTH - 8)
    const top = above ? cell.top - box.top - 8 : cell.bottom - box.top + 8
    setMenu({ date: iso, top, left, above })
    // Past het menu toch niet helemaal, dan het menu in beeld scrollen
    requestAnimationFrame(() => {
      const el = root.current?.querySelector('.day-menu')
      if (!el) return
      const r = el.getBoundingClientRect()
      if (r.bottom > bottomLimit) window.scrollBy({ top: r.bottom - bottomLimit + 12, behavior: 'smooth' })
      else if (r.top < 8) window.scrollBy({ top: r.top - 12, behavior: 'smooth' })
    })
  }
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
    <section className="calendar" ref={root}>
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
            <button key={iso} className={classes} onClick={(e) => openMenu(iso, e)} style={{ '--i': i } as CSSProperties}>
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

      {menu && renderDayMenu && (
        <div className={`day-menu ${menu.above ? 'above' : ''}`} style={{ top: menu.top, left: menu.left, width: MENU_WIDTH }}>
          {renderDayMenu(menu.date, closeMenu)}
        </div>
      )}
    </section>
  )
}
