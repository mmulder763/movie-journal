import { useState } from 'react'
import type { Entry, SearchResult, WatchItem } from '../types'
import { Modal } from './Modal'
import { SearchStep } from './SearchStep'
import { EntryForm } from './EntryForm'

interface Props {
  /** Entry om te tonen; null start met zoeken */
  initial: Entry | null
  /** false = bestaande entry bewerken */
  isNew: boolean
  date: string
  /** Eerdere kijkmomenten van dezelfde titel */
  history?: Entry[]
  onSave: (entries: Entry[]) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export function entryFromResult(r: SearchResult | Entry | WatchItem, date: string | null): Entry {
  return {
    id: crypto.randomUUID(),
    date,
    tmdbId: r.tmdbId,
    mediaType: r.mediaType,
    title: r.title,
    posterPath: r.posterPath,
    backdropPath: r.backdropPath,
    year: r.year,
    createdAt: Date.now(),
  }
}

export function EntryDialog({ initial, isNew, date, history = [], onSave, onDelete, onClose }: Props) {
  const [draft, setDraft] = useState<Entry | null>(initial)
  const startedWithSearch = initial === null

  return (
    <Modal title={isNew ? 'Toevoegen' : 'Bewerken'} onClose={onClose} backdrop={draft?.backdropPath}>
      {draft ? (
        <EntryForm
          entry={draft}
          fallbackDate={date}
          history={history.filter((h) => h.tmdbId === draft.tmdbId && h.mediaType === draft.mediaType)}
          isNew={isNew}
          onSave={onSave}
          onDelete={onDelete}
          onBack={startedWithSearch ? () => setDraft(null) : undefined}
        />
      ) : (
        <SearchStep onPick={(r) => setDraft(entryFromResult(r, date))} />
      )}
    </Modal>
  )
}
