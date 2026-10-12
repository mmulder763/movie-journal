import { useId, type ReactNode, type SVGProps } from 'react'

/*
 * Eigen iconenset, één vaste stijl (duotone) voor alle iconen:
 * - hoofdvorm: lichte gradient-vulling + gradient-rand (class "accent-shape")
 * - secundaire lijnen: currentColor
 * - één klein massief detail in de gradient (class "accent")
 * 24×24, lijndikte 1.8, afgeronde hoeken.
 */

type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number }

/** Elke instantie krijgt een eigen gradient-id; een gedeelde id breekt als het eerste icoon verborgen is. */
function Base({ size = 22, children, ...rest }: IconProps & { children: (accent: string) => ReactNode }) {
  const id = `icon-accent-${useId().replace(/:/g, '')}`
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3ee8a0" />
          <stop offset="0.55" stopColor="#14b8a6" />
          <stop offset="1" stopColor="#8b6cff" />
        </linearGradient>
      </defs>
      {children(`url(#${id})`)}
    </svg>
  )
}

/** Hoofdvorm-props, gelijk voor elk icoon */
const shape = (accent: string) => ({ className: 'accent-shape', stroke: accent, fill: accent, fillOpacity: 0.22 })
const detail = (accent: string) => ({ className: 'accent', fill: accent, stroke: 'none' })

/** Agenda: kalenderblad met een gemarkeerde dag */
export function AgendaIcon(props: IconProps) {
  return (
    <Base {...props}>
      {(accent) => (
        <>
          <rect x="3.5" y="5" width="17" height="15.5" rx="3" {...shape(accent)} />
          <path d="M8 3.2v3.6M16 3.2v3.6" />
          <path d="M3.5 10h17" />
          <rect x="13" y="13.2" width="4.2" height="4.2" rx="1.1" {...detail(accent)} />
        </>
      )}
    </Base>
  )
}

/** Mijn lijst: waaier van posters */
export function ListIcon(props: IconProps) {
  return (
    <Base {...props}>
      {(accent) => (
        <>
          <path d="M6.6 6.6 4.2 7a1.5 1.5 0 0 0-1.2 1.7l1.4 8.6a1.5 1.5 0 0 0 1.7 1.2l1.9-.3" />
          <path d="M17.4 6.6l2.4.4a1.5 1.5 0 0 1 1.2 1.7l-1.4 8.6a1.5 1.5 0 0 1-1.7 1.2l-1.9-.3" />
          <rect x="7.5" y="3.5" width="9" height="17" rx="2.2" {...shape(accent)} />
          <path d="M10.8 9.6v4.8l4-2.4z" {...detail(accent)} />
        </>
      )}
    </Base>
  )
}

/** Swipe: kaart die wegvliegt met een bewegingsboog */
export function SwipeIcon(props: IconProps) {
  return (
    <Base {...props}>
      {(accent) => (
        <>
          <rect x="3.5" y="5.5" width="9" height="13.5" rx="2.2" />
          <rect x="10.4" y="3.6" width="9" height="13.5" rx="2.2" transform="rotate(14 14.9 10.35)" {...shape(accent)} />
          <path d="M4.5 21.6c3.2.9 6.8.7 9.8-.8" />
          <path d="M12.6 19.6l1.8 1.1-1.2 1.8" />
          <circle cx="15.4" cy="10.2" r="1.9" {...detail(accent)} />
        </>
      )}
    </Base>
  )
}

/** Statistieken: staafjes met een uitgelichte hoogste staaf */
export function StatsIcon(props: IconProps) {
  return (
    <Base {...props}>
      {(accent) => (
        <>
          <rect x="3.5" y="12" width="4.5" height="8.5" rx="1.4" />
          <rect x="9.75" y="4" width="4.5" height="16.5" rx="1.4" {...shape(accent)} />
          <rect x="16" y="8.5" width="4.5" height="12" rx="1.4" />
          <circle cx="12" cy="7.5" r="1.3" {...detail(accent)} />
        </>
      )}
    </Base>
  )
}
