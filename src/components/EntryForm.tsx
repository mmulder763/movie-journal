import { useState, type FormEvent } from 'react'
import { BackIcon, TicketIcon } from './Icons'
import type { Entry } from '../types'
import { Poster } from './Poster'
import { StarRating } from './StarRating'
import { formatLongDate, today } from '../lib/dates'
import { EpisodePicker, type EpisodeSelection } from './EpisodePicker'

interface Props {
  entry: Entry
  isNew: boolean
  /** Eerdere kijkmomenten van dezelfde titel (voor de afleveringskiezer) */
  history?: Entry[]
  /** Eén entry, of bij een serie één entry per aangevinkte aflevering */
  onSave: (entries: Entry[]) => void
  onDelete: (id: string) => void
  onBack?: () => void
}

/** Standaard het seizoen van deze entry, anders het laatst gekeken seizoen, anders 1 */
function initialSeason(entry: Entry, history: Entry[]) {
  if (entry.season != null) return entry.season
  const seasons = history.flatMap((e) => (e.season != null && e.season > 0 ? [e.season] : []))
  return seasons.length ? Math.max(...seasons) : 1
}

export function EntryForm({ entry, isNew, history = [], onSave, onDelete, onBack }: Props) {
  const [draft, setDraft] = useState(entry)
  // Staat het al in de agenda, dan liggen datum/bios/aflevering vast; alleen rating en notitie zijn aan te passen
  const locked = !isNew && entry.date !== null
  const update = (patch: Partial<Entry>) => setDraft((d) => ({ ...d, ...patch }))
  const isSeries = draft.mediaType === 'tv'
  const [selection, setSelection] = useState<EpisodeSelection>(() => ({
    season: initialSeason(entry, history),
    episodes: entry.episode != null ? [entry.episode] : [],
  }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const base = { ...draft, note: draft.note?.trim() || undefined }
    if (!isSeries || locked) return onSave([base])
    // Geen aflevering aangevinkt: de serie als geheel (zoals bij swipen)
    if (selection.episodes.length === 0) return onSave([{ ...base, season: undefined, episode: undefined }])
    onSave(
      selection.episodes.map((episode, i) => ({
        ...base,
        // Bij bewerken houdt de eerste aflevering het bestaande id
        id: i === 0 ? base.id : crypto.randomUUID(),
        season: selection.season,
        episode,
        createdAt: base.createdAt + i,
      })),
    )
  }

  const saveLabel = !isSeries || locked
    ? 'Opslaan'
    : selection.episodes.length > 1
      ? `${selection.episodes.length} afleveringen opslaan`
      : selection.episodes.length === 1
        ? `S${selection.season}E${selection.episodes[0]} opslaan`
        : 'Opslaan (hele serie)'

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
              {entry.cinema && <span className="cinema-tag"><TicketIcon size={12} /> Bios</span>}
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
            {/* Leeg = datum onbekend (bv. bij een swipe zonder bioscoopdatum); nieuwe items krijgen altijd een datum */}
            <input type="date" required={isNew} value={draft.date ?? ''} max={today()}
              onChange={(e) => update({ date: e.target.value || null })} />
            {draft.date === null && <span className="muted small">Nog geen datum: vul hem in als je weet wanneer je het zag.</span>}
          </div>

          {isSeries && (
            <div className="field">
              <span>{isNew ? 'Welke afleveringen?' : 'Aflevering'}</span>
              <EpisodePicker tvId={draft.tmdbId} history={history.filter((h) => h.id !== entry.id)}
                value={selection} onChange={setSelection} multiple={isNew} />
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
        {isNew && onBack && <button type="button" className="btn-text with-icon" onClick={onBack}><BackIcon size={16} /> Terug</button>}
        {!isNew && (
          <button type="button" className="btn-danger"
            onClick={() => confirm(`"${draft.title}" verwijderen?`) && onDelete(draft.id)}>
            Verwijderen
          </button>
        )}
        <button type="submit" className="btn-primary">{saveLabel}</button>
      </div>
    </form>
  )
}
