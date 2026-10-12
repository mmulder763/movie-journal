import { useCallback, useMemo, useRef, useState } from 'react'
import type { Entry } from './types'
import { exportJournal, parseImport, useJournal, type SyncStatus } from './lib/storage'
import { summarizeTitles, titleKey } from './lib/titles'
import { fromISODate, today } from './lib/dates'
import { emptyJournal } from './lib/journal'
import type { Backend } from './lib/backends'
import { Calendar } from './components/Calendar'
import { DayPanel } from './components/DayPanel'
import { EntryDialog, entryFromResult } from './components/EntryDialog'
import { ListView } from './components/ListView'
import { TitleSheet } from './components/TitleSheet'
import { NowShowing } from './components/NowShowing'
import { SwipeDeck, type SwipeAction } from './components/SwipeDeck'
import { Intro } from './components/Intro'
import { WatchlistView } from './components/WatchlistView'
import { WatchItemSheet } from './components/WatchItemSheet'
import { AgendaIcon, ListIcon, StatsIcon, SwipeIcon } from './components/Icons'
import { StatsView } from './components/StatsView'
import { ShareDialog } from './components/ShareDialog'
import { Ambient } from './components/Ambient'
import { Toast, type ToastMessage } from './components/Toast'
import { backdropUrl, fetchCinemaDate, posterUrl } from './lib/tmdb'
import { formatLongDate } from './lib/dates'
import type { SearchResult, TitleSummary, WatchItem } from './types'

type Tab = 'agenda' | 'list' | 'swipe' | 'stats'
type DialogState = { initial: Entry | null; isNew: boolean } | null

const TABS: [Tab, string, typeof AgendaIcon][] = [
  ['agenda', 'Agenda', AgendaIcon],
  ['list', 'Lijst', ListIcon],
  ['swipe', 'Swipe', SwipeIcon],
  ['stats', 'Stats', StatsIcon],
]

interface AppProps {
  backend: Backend
  onOpenSettings: () => void
}

export default function App({ backend, onOpenSettings }: AppProps) {
  const { journal, status, dispatch, sync } = useJournal(backend)
  const { entries } = journal
  const [tab, setTab] = useState<Tab>('agenda')
  const [selected, setSelected] = useState(today)
  const [view, setView] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [dialog, setDialog] = useState<DialogState>(null)
  const [openTitle, setOpenTitle] = useState<string | null>(null)
  const importInput = useRef<HTMLInputElement>(null)
  /** titleKey → entry-id van de laatste "gezien"-swipe, voor undo */
  const swipedEntries = useRef(new Map<string, string>())
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const notify = useCallback((text: string) => setToast({ id: Date.now(), text }), [])
  const clearToast = useCallback(() => setToast(null), [])
  const [marqueeTitle, setMarqueeTitle] = useState<TitleSummary>()
  const [swipeTop, setSwipeTop] = useState<SearchResult>()

  const entriesByDate = useMemo(() => {
    const map = new Map<string, Entry[]>()
    for (const e of [...entries].sort((a, b) => a.createdAt - b.createdAt)) {
      if (e.date) map.set(e.date, [...(map.get(e.date) ?? []), e])
    }
    return map
  }, [entries])

  const titles = useMemo(() => summarizeTitles(entries), [entries])
  const monthEntries = useMemo(() => {
    const prefix = `${view.year}-${String(view.month + 1).padStart(2, '0')}`
    return entries.filter((e) => e.date?.startsWith(prefix))
  }, [entries, view])
  const journalKeys = useMemo(() => new Set(entries.map(titleKey)), [entries])
  const skippedKeys = useMemo(() => new Set(journal.skipped), [journal.skipped])
  const watchlistKeys = useMemo(() => new Set(journal.watchlist.map(titleKey)), [journal.watchlist])
  const [listMode, setListMode] = useState<'seen' | 'watchlist'>('seen')
  const [openWatchItem, setOpenWatchItem] = useState<WatchItem | null>(null)
  const [sharingMonth, setSharingMonth] = useState(false)
  /** titleKey → watchlist-item dat door een swipe is weggehaald, zodat undo het terugzet */
  const removedFromWatchlist = useRef(new Map<string, WatchItem>())

  /** Gezien = niet meer op de watchlist */
  const leaveWatchlist = useCallback(
    (key: string) => {
      const item = journal.watchlist.find((w) => titleKey(w) === key)
      if (!item) return
      removedFromWatchlist.current.set(key, item)
      dispatch({ type: 'watchlist-remove', key })
    },
    [journal.watchlist, dispatch],
  )

  const addToWatchlist = useCallback(
    (r: SearchResult) => {
      dispatch({
        type: 'watchlist-add',
        item: { tmdbId: r.tmdbId, mediaType: r.mediaType, title: r.title, posterPath: r.posterPath, backdropPath: r.backdropPath, year: r.year, addedAt: Date.now() },
      })
      notify(`🔖 ${r.title} op je watchlist`)
    },
    [dispatch, notify],
  )
  const openTitleSummary = titles.find((t) => t.key === openTitle)

  // Ambient-achtergrond volgt wat er op dat moment centraal staat
  const ambientSource = openTitleSummary ?? (tab === 'swipe' ? swipeTop : marqueeTitle ?? titles[0])
  const ambientImage = ambientSource
    ? (tab === 'swipe' && !openTitleSummary
        ? posterUrl(ambientSource.posterPath, 'w342')
        : backdropUrl(ambientSource.backdropPath) ?? posterUrl(ambientSource.posterPath, 'w342'))
    : null

  const changeMonth = (delta: number) =>
    setView(({ year, month }) => {
      const d = new Date(year, month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })

  const goToDate = (iso: string) => {
    const d = fromISODate(iso)
    setSelected(iso)
    setView({ year: d.getFullYear(), month: d.getMonth() })
  }

  const handleSave = (saved: Entry[]) => {
    for (const entry of saved) dispatch({ type: 'upsert', entry })
    if (saved[0]) {
      leaveWatchlist(titleKey(saved[0]))
      if (saved[0].date) goToDate(saved[0].date)
    }
    if (saved.length > 1) notify(`📺 ${saved.length} afleveringen van ${saved[0].title} opgeslagen`)
    setDialog(null)
  }

  const handleDelete = (id: string) => {
    dispatch({ type: 'delete', id })
    setDialog(null)
  }

  const handleSwipe = useCallback(
    ({ card, verdict }: SwipeAction) => {
      if (verdict === 'skip') return dispatch({ type: 'skip', key: titleKey(card) })
      if (verdict === 'watchlist') return addToWatchlist(card)
      const entry = entryFromResult(card, null)
      const key = titleKey(card)
      swipedEntries.current.set(key, entry.id)
      dispatch({ type: 'upsert', entry })
      // Via zoeken kan een eerder weggeswipete titel alsnog "gezien" worden
      if (skippedKeys.has(key)) dispatch({ type: 'unskip', key })
      leaveWatchlist(key)
      // Series hebben geen bioscooprelease; die blijven zonder datum
      if (card.mediaType !== 'movie') return

      // Elke "ja" op de NL-bioscoopdatum plotten; niet meer toepassen als de swipe inmiddels ongedaan is gemaakt
      fetchCinemaDate(card.tmdbId)
        .then((date) => {
          if (swipedEntries.current.get(key) !== entry.id || !date) return
          dispatch({ type: 'upsert', entry: { ...entry, date } })
          notify(`📅 ${card.title} geplot op ${formatLongDate(date)}`)
        })
        .catch((err) => notify(`Bioscoopdatum ophalen mislukt: ${(err as Error).message}`))
    },
    [dispatch, notify, skippedKeys, addToWatchlist, leaveWatchlist],
  )

  const handleUndoSwipe = ({ card, verdict }: SwipeAction) => {
    const key = titleKey(card)
    if (verdict === 'skip') return dispatch({ type: 'unskip', key })
    if (verdict === 'watchlist') return dispatch({ type: 'watchlist-remove', key })
    const restore = removedFromWatchlist.current.get(key)
    if (restore) dispatch({ type: 'watchlist-add', item: restore })
    removedFromWatchlist.current.delete(key)
    const id = swipedEntries.current.get(key)
    if (id) dispatch({ type: 'delete', id })
    swipedEntries.current.delete(key)
  }

  /** Tijdelijk voor de testfase: alles leeg, op alle apparaten */
  const handleReset = () => {
    const total = entries.length + journal.skipped.length + journal.watchlist.length
    if (!confirm(`Alles wissen? ${entries.length} items, ${journal.watchlist.length} watchlist-titels en ${journal.skipped.length} weggeswipete titels verdwijnen op al je apparaten.`)) return
    dispatch({ type: 'replace', journal: emptyJournal() })
    swipedEntries.current.clear()
    notify(total ? '🧹 Journal gereset' : 'Journal was al leeg')
  }

  const handleImport = async (file: File | undefined) => {
    if (!file) return
    try {
      const imported = await parseImport(file)
      if (confirm(`${imported.entries.length} items importeren? Dit vervangt je huidige journal (${entries.length} items).`)) {
        dispatch({ type: 'replace', journal: imported })
      }
    } catch (err) {
      alert((err as Error).message)
    } finally {
      if (importInput.current) importInput.current.value = ''
    }
  }

  return (
    <div className="app">
      <Ambient image={ambientImage} />
      <Intro />
      <Toast toast={toast} onDone={clearToast} />

      <header className="app-header">
        <h1 className="logo">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" />
          <span>Movie <em>Journal</em></span>
        </h1>
        <nav className="tabs tabs-top">
          {TABS.map(([value, label, Icon]) => (
            <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>
              <Icon className="tab-icon" size={18} />
              {label}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <SyncBadge status={status} onRetry={sync} backendLabel={backend.label} />
          <button className="icon-btn settings-btn" onClick={onOpenSettings} aria-label="Instellingen" title="Opslag & koppeling">⚙︎</button>
          <button className="btn-text hide-mobile" onClick={() => exportJournal(journal)}>Export</button>
          <button className="btn-text hide-mobile" onClick={() => importInput.current?.click()}>Import</button>
          <input ref={importInput} type="file" accept="application/json" hidden
            onChange={(e) => handleImport(e.target.files?.[0])} />
        </div>
      </header>

      <main className="tab-page" key={tab}>
        {tab === 'agenda' && (
          <>
            <NowShowing titles={titles} onOpen={setOpenTitle} onAdd={() => setDialog({ initial: null, isNew: true })}
              onSlideChange={setMarqueeTitle} />
            <div className="layout">
              <Calendar
                year={view.year}
                month={view.month}
                entriesByDate={entriesByDate}
                selected={selected}
                onSelect={setSelected}
                onMonthChange={changeMonth}
                onToday={() => goToDate(today())}
                onShare={() => setSharingMonth(true)}
              />
              <DayPanel
                date={selected}
                entries={entriesByDate.get(selected) ?? []}
                onAdd={() => setDialog({ initial: null, isNew: true })}
                onEdit={(entry) => setDialog({ initial: entry, isNew: false })}
              />
            </div>
          </>
        )}
        {tab === 'list' && (
          <>
            <div className="segmented list-switch">
              <button className={listMode === 'seen' ? 'active' : ''} onClick={() => setListMode('seen')}>
                Gezien <span className="chip-count">{titles.length}</span>
              </button>
              <button className={listMode === 'watchlist' ? 'active' : ''} onClick={() => setListMode('watchlist')}>
                🔖 Watchlist <span className="chip-count">{journal.watchlist.length}</span>
              </button>
            </div>
            {listMode === 'seen' ? (
              <ListView titles={titles} onOpen={setOpenTitle} />
            ) : (
              <WatchlistView items={journal.watchlist} seenKeys={journalKeys} onAdd={addToWatchlist} onOpen={setOpenWatchItem} />
            )}
            <div className="list-footer">
              <button className="btn-text" onClick={() => exportJournal(journal)}>Export</button>
              <button className="btn-text" onClick={() => importInput.current?.click()}>Import</button>
              <button className="btn-text btn-reset" onClick={handleReset}>Reset (test)</button>
            </div>
          </>
        )}
        {tab === 'stats' && <StatsView entries={entries} />}
        {tab === 'swipe' && <SwipeDeck journalKeys={journalKeys} skippedKeys={skippedKeys} watchlistKeys={watchlistKeys} onSwipe={handleSwipe} onUndo={handleUndoSwipe} onTopChange={setSwipeTop} />}
      </main>

      <nav className="tabs tabs-bottom">
        {TABS.map(([value, label, Icon]) => (
          <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>
            <Icon className="tab-icon" />
            {label}
          </button>
        ))}
      </nav>

      {openTitleSummary && (
        <TitleSheet
          title={openTitleSummary}
          onClose={() => setOpenTitle(null)}
          onEdit={(entry) => {
            setOpenTitle(null)
            setDialog({ initial: entry, isNew: false })
          }}
          onGoToDate={(date) => {
            goToDate(date)
            setOpenTitle(null)
            setTab('agenda')
          }}
          onWatchAgain={() => {
            const latest = openTitleSummary.watches[0]
            const draft = entryFromResult(latest, today())
            // Bij series alvast de volgende aflevering invullen
            if (latest.mediaType === 'tv' && latest.season != null) {
              draft.season = latest.season
              draft.episode = latest.episode != null ? latest.episode + 1 : undefined
            }
            setOpenTitle(null)
            setDialog({ initial: draft, isNew: true })
          }}
        />
      )}

      {sharingMonth && (
        <ShareDialog
          eyebrow="Mijn maand"
          title={new Date(view.year, view.month, 1).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}
          entries={monthEntries}
          onClose={() => setSharingMonth(false)}
        />
      )}

      {openWatchItem && (
        <WatchItemSheet
          item={openWatchItem}
          onClose={() => setOpenWatchItem(null)}
          onRemove={() => {
            dispatch({ type: 'watchlist-remove', key: titleKey(openWatchItem) })
            setOpenWatchItem(null)
          }}
          onSeen={() => {
            const draft = entryFromResult(openWatchItem, today())
            setOpenWatchItem(null)
            setDialog({ initial: draft, isNew: true })
          }}
        />
      )}

      {dialog && (
        <EntryDialog
          initial={dialog.initial}
          isNew={dialog.isNew}
          date={selected}
          history={entries}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}

function SyncBadge({ status, onRetry, backendLabel }: { status: SyncStatus; onRetry: () => void; backendLabel: string }) {
  const label = status.state === 'synced' ? 'Synced' : status.state === 'syncing' ? 'Syncen…' : 'Offline'
  return (
    <button
      className={`sync-badge ${status.state}`}
      onClick={onRetry}
      title={status.state === 'offline' ? `Niet gesynchroniseerd: ${status.error}. Wijzigingen worden bewaard en later verstuurd.` : `Gesynchroniseerd met ${backendLabel}`}
    >
      <span className="sync-dot" />
      {label}
    </button>
  )
}
