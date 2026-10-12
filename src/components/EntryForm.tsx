import { useState, type FormEvent } from 'react'
import type { Entry } from '../types'
import { Poster } from './Poster'
import { StarRating } from './StarRating'
import { formatLongDate, today } from '../lib/dates'

interface Props {
  entry: Entry
  /** Datum om terug naar te zetten als "datum onbekend" wordt uitgevinkt */
  fallbackDate?: string
  isNew: boolean
  onSave: (entry: Entry) => void
  onDelete: (id: string) => void
  onBack?: () => void
}

const toOptionalInt = (v: string) => (v === '' ? undefined : Math.max(0, parseInt(v, 10)))

export function EntryForm({ entry, fallbackDate, isNew, onSave, onDelete, onBack }: Props) {
  const [draft, setDraft] = useState(entry)
  // Staat het al in de agenda, dan liggen datum/bios/aflevering vast; alleen rating en notitie zijn aan te passen
  const locked = !isNew && entry.date !== null
  const update = (patch: Partial<Entry>) => setDraft((d) => ({ ...d, ...patch }))
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSave({ ...draft, note: draft.note?.trim() || undefined })
  }

  return (
    <form className="entry-form" onSubmit={submit}>
      <div className="entry-form-head">
        <Poster path={draft.posterPath} title={draft.title} size="w185" />
        <div>
          <strong>{draft.title}</strong>
          <span className="muted small">
            {draft.mediaType === 'tv' ? 'Serie' : 'Film'}
            {draft.year && ` · ${draft.year}`}
          </span>
          {locked && entry.date && (
            <span className="locked-meta">
              {entry.cinema && <span className="cinema-tag">🎟️ Bios</span>}
              {formatLongDate(entry.date).replace(/^./, (c) => c.toUpperCase())}
              {entry.season != null && ` · S${entry.season}${entry.episode != null ? `E${entry.episode}` : ''}`}
            </span>
          )}
        </div>
      </div>

      {!locked && (
        <>
          <div className="field">
            <span>Gezien op</span>
            <div className="date-row">
              {draft.date !== null && (
                <input type="date" required value={draft.date} onChange={(e) => update({ date: e.target.value })} />
              )}
              <label className="check">
                <input type="checkbox" checked={draft.date === null}
                  onChange={(e) => update({ date: e.target.checked ? null : (fallbackDate ?? today()) })} />
                Datum onbekend
              </label>
            </div>
          </div>

          {draft.mediaType === 'tv' && (
            <div className="row">
              <label>
                Seizoen
                <input type="number" min={0} inputMode="numeric" value={draft.season ?? ''}
                  onChange={(e) => update({ season: toOptionalInt(e.target.value) })} />
              </label>
              <label>
                Aflevering
                <input type="number" min={0} inputMode="numeric" value={draft.episode ?? ''}
                  onChange={(e) => update({ episode: toOptionalInt(e.target.value) })} />
              </label>
            </div>
          )}

        </>
      )}

      <div className="field">
        <span>Rating</span>
        <StarRating value={draft.rating} onChange={(rating) => update({ rating })} size="lg" />
      </div>

      <label>
        Notitie
        <textarea rows={4} placeholder="Wat vond je ervan?" value={draft.note ?? ''}
          onChange={(e) => update({ note: e.target.value })} />
      </label>

      <div className="form-actions">
        {isNew && onBack && <button type="button" className="btn-text" onClick={onBack}>← Terug</button>}
        {!isNew && (
          <button type="button" className="btn-danger"
            onClick={() => confirm(`"${draft.title}" verwijderen?`) && onDelete(draft.id)}>
            Verwijderen
          </button>
        )}
        <button type="submit" className="btn-primary">Opslaan</button>
      </div>
    </form>
  )
}
