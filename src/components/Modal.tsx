import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { backdropUrl } from '../lib/tmdb'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  /** Optionele TMDB backdrop als header-achtergrond */
  backdrop?: string | null
}

// Open modals, bovenste laatst: Escape sluit alleen de bovenste (detailscherm boven een vriendprofiel)
const stack: symbol[] = []

export function Modal({ title, onClose, children, backdrop }: Props) {
  // Laatste onClose bewaren, zodat de modal zich maar één keer (bij openen) op de stapel zet
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const id = Symbol('modal')
    stack.push(id)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && stack[stack.length - 1] === id && closeRef.current()
    window.addEventListener('keydown', onKey)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      stack.splice(stack.indexOf(id), 1)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [])

  const bg = backdropUrl(backdrop)

  // Via een portal in <body>: een ouder met backdrop-filter of transform zou position: fixed anders insluiten
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        {bg && <div className="modal-hero" style={{ backgroundImage: `url(${bg})` }} />}
        <header className="modal-header">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Sluiten">✕</button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  )
}
