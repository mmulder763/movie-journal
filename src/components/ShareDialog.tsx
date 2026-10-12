import { useEffect, useMemo, useState } from 'react'
import type { Entry } from '../types'
import { renderShareCard } from '../lib/shareCard'
import { summarizeTitles } from '../lib/titles'
import { useWatchTime } from '../lib/watchTime'
import { Modal } from './Modal'

interface Props {
  eyebrow: string
  title: string
  entries: Entry[]
  onClose: () => void
}

/** Maakt een deelbare story-afbeelding van een periode en biedt delen/opslaan aan. */
export function ShareDialog({ eyebrow, title, entries, onClose }: Props) {
  const titles = useMemo(() => summarizeTitles(entries), [entries])
  const watchTime = useWatchTime(titles)
  const ready = watchTime.loaded + watchTime.failed >= watchTime.total
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    // Best beoordeelde titels eerst, daarna de meest recente
    const ordered = [...titles].sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0) || (b.lastDate ?? '').localeCompare(a.lastDate ?? ''))
    const movies = titles.filter((t) => t.mediaType === 'movie').length
    const series = titles.length - movies
    renderShareCard({
      eyebrow,
      title,
      posters: ordered.map((t) => t.posterPath),
      stats: [
        { value: String(movies), label: movies === 1 ? 'film' : 'films' },
        { value: String(series), label: 'series' },
        { value: String(Math.round(watchTime.minutes / 60)), label: 'uur gekeken' },
      ],
    })
      .then((blob) => !cancelled && setImage({ blob, url: URL.createObjectURL(blob) }))
      .catch((err) => !cancelled && setError((err as Error).message))
    return () => {
      cancelled = true
    }
  }, [ready, titles, eyebrow, title, watchTime.minutes])

  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url) }, [image])

  const fileName = `movie-journal-${title.toLowerCase().replace(/\s+/g, '-')}.png`
  const file = image && new File([image.blob], fileName, { type: 'image/png' })
  const canShare = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

  const share = async () => {
    if (!file) return
    try {
      await navigator.share({ files: [file], title: `Movie Journal · ${title}` })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError((err as Error).message)
    }
  }

  const download = () => {
    if (!image) return
    const a = document.createElement('a')
    a.href = image.url
    a.download = fileName
    a.click()
  }

  return (
    <Modal title="Deelkaart" onClose={onClose}>
      <div className="share-dialog">
        {entries.length === 0 ? (
          <p className="empty">Niets om te delen in deze periode.</p>
        ) : image ? (
          <img className="share-preview" src={image.url} alt={`Deelkaart ${title}`} />
        ) : (
          <div className="share-preview share-loading">
            <div className="reel-spinner" />
            <span className="muted small">{error ?? (ready ? 'Kaart tekenen…' : `Speelduren ophalen… ${watchTime.loaded}/${watchTime.total}`)}</span>
          </div>
        )}
        {error && image && <p className="error small">{error}</p>}
        <div className="form-actions">
          <button className="btn-ghost" onClick={download} disabled={!image}>Opslaan</button>
          {canShare && <button className="btn-primary" onClick={share}>Delen</button>}
        </div>
      </div>
    </Modal>
  )
}
