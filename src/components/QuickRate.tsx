import { useState } from 'react'
import { CheckIcon } from './Icons'
import { Poster } from './Poster'
import { StarRating } from './StarRating'

interface Props {
  title: string
  posterPath: string | null
  onSave: (rating: number | undefined, note: string | undefined) => void
  onSkip: () => void
}

/** Na "gezien" swipen: snel een rating en notitie toevoegen (of overslaan). */
export function QuickRate({ title, posterPath, onSave, onSkip }: Props) {
  const [rating, setRating] = useState<number>()
  const [note, setNote] = useState('')

  return (
    <div className="quick-rate" role="dialog" aria-label={`${title} beoordelen`}>
      <div className="quick-rate-head">
        <Poster path={posterPath} title={title} size="w92" />
        <div>
          <span className="eyebrow with-icon"><CheckIcon size={14} /> Gezien</span>
          <strong>{title}</strong>
        </div>
      </div>
      <StarRating value={rating} onChange={setRating} size="lg" />
      <textarea rows={2} placeholder="Notitie (optioneel)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="quick-rate-actions">
        <button className="btn-text" onClick={onSkip}>Overslaan</button>
        <button className="btn-primary" onClick={() => onSave(rating, note.trim() || undefined)} disabled={!rating && !note.trim()}>
          Opslaan
        </button>
      </div>
    </div>
  )
}
