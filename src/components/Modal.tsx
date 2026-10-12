import { useEffect, type ReactNode } from 'react'
import { backdropUrl } from '../lib/tmdb'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  /** Optionele TMDB backdrop als header-achtergrond */
  backdrop?: string | null
}

export function Modal({ title, onClose, children, backdrop }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  const bg = backdropUrl(backdrop)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        {bg && <div className="modal-hero" style={{ backgroundImage: `url(${bg})` }} />}
        <header className="modal-header">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Sluiten">✕</button>
        </header>
        {children}
      </div>
    </div>
  )
}
