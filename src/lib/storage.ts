import { useCallback, useEffect, useRef, useState } from 'react'
import type { Journal, Op } from '../types'
import { applyOp, emptyJournal, normalizeJournal } from './journal'
import type { Backend } from './backends'

const CACHE_KEY = 'movie-journal:cache:v2'
const QUEUE_KEY = 'movie-journal:pending-ops:v1'
const LEGACY_KEY = 'movie-journal:entries:v1'

export type SyncStatus = { state: 'syncing' | 'synced' } | { state: 'offline'; error: string }

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function loadCache(): Journal {
  try {
    return normalizeJournal(readJson<unknown>(CACHE_KEY, emptyJournal()))
  } catch (err) {
    console.error('Lokale cache onleesbaar, begin leeg', err)
    return emptyJournal()
  }
}

/** Oude entries (v0.1, alleen localStorage) eenmalig meenemen naar de server. */
function legacyOps(): Op[] {
  const legacy = readJson<unknown[] | null>(LEGACY_KEY, null)
  if (!legacy) return []
  localStorage.removeItem(LEGACY_KEY)
  try {
    return normalizeJournal(legacy).entries.map((entry) => ({ type: 'upsert', entry }))
  } catch {
    return []
  }
}

// Snel opeenvolgende wijzigingen (bv. swipen) bundelen tot één sync, en dus één database-update
const SYNC_DEBOUNCE_MS = 1200
// Wijzigingen van andere apparaten ophalen zolang de app open en zichtbaar is
const POLL_MS = 60_000

/**
 * Het journal, gesynchroniseerd met de backend (dev-server of Supabase).
 * Wijzigingen worden direct lokaal toegepast en in een wachtrij gezet; als de backend
 * onbereikbaar is blijven ze bewaard en gaan ze bij de volgende sync alsnog mee.
 */
export function useJournal(backend: Backend) {
  const [journal, setJournal] = useState<Journal>(loadCache)
  const [status, setStatus] = useState<SyncStatus>({ state: 'syncing' })
  const queue = useRef<Op[]>([...readJson<Op[]>(QUEUE_KEY, []), ...legacyOps()])
  const inFlight = useRef<Promise<void> | null>(null)

  useEffect(() => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(journal))
  }, [journal])

  const resyncRequested = useRef(false)

  const sync = useCallback((): Promise<void> => {
    // Nooit twee syncs tegelijk; de lopende sync doet daarna nog een ronde
    if (inFlight.current) {
      resyncRequested.current = true
      return inFlight.current
    }

    const run = async () => {
      setStatus({ state: 'syncing' })
      do {
        resyncRequested.current = false
        try {
          let server: Journal
          const ops = queue.current
          if (ops.length > 0) {
            server = await backend.apply(ops)
            queue.current = queue.current.slice(ops.length)
            localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.current))
          } else {
            server = await backend.load()
          }
          // Ops die tijdens het request zijn toegevoegd opnieuw toepassen op de serverstand
          setJournal(queue.current.reduce(applyOp, normalizeJournal(server)))
        } catch (err) {
          setStatus({ state: 'offline', error: (err as Error).message })
          return
        }
      } while (resyncRequested.current || queue.current.length > 0)
      setStatus({ state: 'synced' })
    }

    inFlight.current = run().finally(() => (inFlight.current = null))
    return inFlight.current
  }, [backend])

  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined)
  const dispatch = useCallback(
    (op: Op) => {
      setJournal((j) => applyOp(j, op))
      queue.current = [...queue.current, op]
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.current))
      clearTimeout(debounce.current)
      setStatus({ state: 'syncing' })
      debounce.current = setTimeout(() => void sync(), SYNC_DEBOUNCE_MS)
    },
    [sync],
  )

  useEffect(() => {
    void sync()
    const onVisible = () => (document.visibilityState === 'visible' || queue.current.length > 0) && void sync()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    // Dev-server meldt wijzigingen aan data/journal.json (ook van andere apparaten)
    const onRemote = () => void sync()
    import.meta.hot?.on('journal:changed', onRemote)
    const poll = setInterval(() => document.visibilityState === 'visible' && void sync(), POLL_MS)
    // Wachtende wijzigingen niet kwijtraken bij wegklikken/afsluiten
    const flush = () => queue.current.length > 0 && void sync()
    window.addEventListener('pagehide', flush)
    return () => {
      clearInterval(poll)
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
      import.meta.hot?.off('journal:changed', onRemote)
    }
  }, [sync])

  return { journal, status, dispatch, sync }
}

export function exportJournal(journal: Journal) {
  const blob = new Blob([JSON.stringify(journal, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `movie-journal-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

export async function parseImport(file: File): Promise<Journal> {
  return normalizeJournal(JSON.parse(await file.text()))
}
