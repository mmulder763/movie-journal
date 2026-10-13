import { useId, type ReactNode, type SVGProps } from 'react'

/*
 * Eigen iconenset, één vaste stijl (duotone) voor alle iconen:
 * - hoofdvorm: lichte gradient-vulling + gradient-rand (class "accent-shape")
 * - secundaire lijnen: currentColor
 * - één klein massief detail in de gradient (class "accent")
 * 24×24, lijndikte 1.8, afgeronde hoeken.
 */

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number }

/** Elke instantie krijgt een eigen gradient-id; een gedeelde id breekt als het eerste icoon verborgen is. */
function Base({ size = 22, children, ...rest }: IconProps & { children: (accent: string) => ReactNode }) {
  const id = `icon-accent-${useId().replace(/:/g, '')}`
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest} className={`icon ${rest.className ?? ''}`}>
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

/** Vrienden: twee figuren, de voorste uitgelicht */
export function FriendsIcon(props: IconProps) {
  return (
    <Base {...props}>
      {(accent) => (
        <>
          <circle cx="16.5" cy="8" r="2.8" />
          <path d="M14 19.5c.3-2.9 1.6-4.6 3.6-4.6 2 0 3.1 1.6 3.4 4.6" />
          <circle cx="9" cy="8.5" r="3.4" {...shape(accent)} />
          <path d="M3 20c.4-3.6 2.6-5.8 6-5.8s5.6 2.2 6 5.8z" {...shape(accent)} />
        </>
      )}
    </Base>
  )
}

/* ---------- Algemene iconen (zelfde stijl) ---------- */

/** Klein helpertje: icoon met alleen een functie voor de vormen */
const make = (draw: (accent: string) => ReactNode) => (props: IconProps) => <Base size={18} {...props}>{draw}</Base>

export const CheckIcon = make((a) => (
  <>
    <circle cx="12" cy="12" r="9" {...shape(a)} />
    <path d="M8 12.3l2.6 2.6L16.2 9.3" />
  </>
))

export const CloseIcon = make(() => <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />)

/** Los vinkje (zonder cirkel) voor knoppen en lijsten */
export const CheckMark = make(() => <path d="M5 12.5l4.5 4.5L19 7.5" />)

export const PlusIcon = make((a) => (
  <>
    <path d="M12 5v14M5 12h14" />
    <circle cx="12" cy="12" r="1.8" {...detail(a)} />
  </>
))

export const BackIcon = make(() => <path d="M14.5 6l-6 6 6 6" />)
export const ChevronIcon = make(() => <path d="M9.5 6l6 6-6 6" />)

export const BookmarkIcon = make((a) => (
  <>
    <path d="M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v15.5L12 16.5l-6.5 4V5A1.5 1.5 0 0 1 7 3.5z" {...shape(a)} />
    <circle cx="12" cy="9" r="1.8" {...detail(a)} />
  </>
))

export const CalendarIcon = make((a) => (
  <>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" {...shape(a)} />
    <path d="M8 3.2v3.6M16 3.2v3.6M3.5 10h17" />
    <rect x="13" y="13.2" width="4.2" height="4.2" rx="1.1" {...detail(a)} />
  </>
))

export const SendIcon = make((a) => (
  <>
    <path d="M20.5 3.5L3.5 10.5l7 2.5 2.5 7z" {...shape(a)} />
    <path d="M20.5 3.5L10.5 13" />
    <circle cx="10.5" cy="13" r="1.4" {...detail(a)} />
  </>
))

export const TicketIcon = make((a) => (
  <>
    <path d="M3.5 8a2 2 0 0 0 0 4v0a2 2 0 0 0 0 4V18a1.5 1.5 0 0 0 1.5 1.5h14A1.5 1.5 0 0 0 20.5 18v-2a2 2 0 0 0 0-4 2 2 0 0 0 0-4V6A1.5 1.5 0 0 0 19 4.5H5A1.5 1.5 0 0 0 3.5 6z" {...shape(a)} />
    <path d="M14.5 5v2.5M14.5 10.5v3M14.5 16.5V19" />
  </>
))

export const FilmIcon = make((a) => (
  <>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" {...shape(a)} />
    <path d="M7 4.5v15M17 4.5v15M3.5 9h3.5M3.5 15h3.5M17 9h3.5M17 15h3.5" />
    <path d="M10.6 9.8v4.4l3.6-2.2z" {...detail(a)} />
  </>
))

export const TvIcon = make((a) => (
  <>
    <rect x="3" y="6" width="18" height="12.5" rx="2.5" {...shape(a)} />
    <path d="M8.5 21h7M9 2.8l3 3.2 3-3.2" />
    <circle cx="17.5" cy="15" r="1.3" {...detail(a)} />
  </>
))

export const BellIcon = make((a) => (
  <>
    <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" {...shape(a)} />
    <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    <circle cx="12" cy="3.6" r="1.3" {...detail(a)} />
  </>
))

export const DiceIcon = make((a) => (
  <>
    <rect x="4" y="4" width="16" height="16" rx="4" {...shape(a)} />
    <circle cx="9" cy="9" r="1.4" {...detail(a)} />
    <circle cx="15" cy="15" r="1.4" {...detail(a)} />
    <circle cx="15" cy="9" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="9" cy="15" r="1.1" fill="currentColor" stroke="none" />
  </>
))

export const LinkIcon = make((a) => (
  <>
    <path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1" />
    <path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1" {...shape(a)} fillOpacity={0} />
  </>
))

export const ChatIcon = make((a) => (
  <>
    <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V17A2.5 2.5 0 0 1 4 14.5z" {...shape(a)} />
    <path d="M8.5 9.5h7M8.5 12.5h4.5" />
  </>
))

export const UndoIcon = make((a) => (
  <>
    <path d="M4.5 9.5h10a5 5 0 0 1 0 10H9" />
    <path d="M8 6l-3.5 3.5L8 13" />
    <circle cx="9" cy="19.5" r="1.4" {...detail(a)} />
  </>
))

export const TrashIcon = make((a) => (
  <>
    <path d="M6 7h12l-1 12.5a1.5 1.5 0 0 1-1.5 1.4h-7A1.5 1.5 0 0 1 7 19.5z" {...shape(a)} />
    <path d="M4 7h16M9.5 7V4.5h5V7M10 11v6M14 11v6" />
  </>
))

export const CameraIcon = make((a) => (
  <>
    <path d="M3.5 8.5A2 2 0 0 1 5.5 6.5H8l1.5-2h5L16 6.5h2.5a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" {...shape(a)} />
    <circle cx="12" cy="13" r="3.5" />
  </>
))

export const ShareIcon = make((a) => (
  <>
    <path d="M12 3.5v11M8 7.5l4-4 4 4" />
    <path d="M6 11H5a1.5 1.5 0 0 0-1.5 1.5V19A1.5 1.5 0 0 0 5 20.5h14a1.5 1.5 0 0 0 1.5-1.5v-6.5A1.5 1.5 0 0 0 19 11h-1" {...shape(a)} />
  </>
))

export const ExternalIcon = make(() => (
  <>
    <path d="M13 4.5h6.5V11M19.5 4.5L11 13" />
    <path d="M17 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 4 18.5v-10A1.5 1.5 0 0 1 5.5 7H10" />
  </>
))

export const EyeIcon = make((a) => (
  <>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" {...shape(a)} />
    <circle cx="12" cy="12" r="3" />
    <circle cx="12" cy="12" r="1.2" {...detail(a)} />
  </>
))

export const UsersIcon = FriendsIcon

/* Reacties */
export const FlameIcon = make((a) => (
  <>
    <path d="M12 21c-4 0-6.5-2.7-6.5-6.3 0-3.4 2.4-5.4 3.6-8.7.9 2 2.3 2.8 2.3 2.8S12 6 13.6 3c2.6 2.8 4.9 6.6 4.9 11.4 0 3.8-2.5 6.6-6.5 6.6z" {...shape(a)} />
    <path d="M12 21c-1.8 0-3-1.2-3-3 0-1.9 1.6-2.9 2.2-4.6.7 1 1.8 1.6 1.8 1.6S14 14 14.5 12.8c.9 1.3 1.5 2.7 1.5 4.6 0 2-1.6 3.6-4 3.6z" {...detail(a)} />
  </>
))

export const HeartIcon = make((a) => (
  <>
    <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z" {...shape(a)} />
    <circle cx="8.5" cy="9.5" r="1.2" {...detail(a)} />
  </>
))

export const LaughIcon = make((a) => (
  <>
    <circle cx="12" cy="12" r="9" {...shape(a)} />
    <path d="M8 9.5l1.5 1-1.5 1M16 9.5l-1.5 1 1.5 1" />
    <path d="M7.5 14h9a4.5 4.5 0 0 1-9 0z" {...detail(a)} />
  </>
))

export const ShockIcon = make((a) => (
  <>
    <circle cx="12" cy="12" r="9" {...shape(a)} />
    <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
    <ellipse cx="12" cy="15.5" rx="2" ry="2.6" {...detail(a)} />
  </>
))

export const SleepIcon = make((a) => (
  <>
    <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" {...shape(a)} />
    <path d="M14.5 4h3.5l-3.5 4h3.5" />
  </>
))

/* Scores */
export const FreshIcon = make((a) => (
  <>
    <circle cx="12" cy="13.5" r="7.5" {...shape(a)} />
    <path d="M12 6c-.5-1.5-1.8-2.4-3.5-2.5M12 6c1-1.3 2.6-1.8 4-1.4M12 6v2" />
    <circle cx="9.5" cy="11.5" r="1.3" {...detail(a)} />
  </>
))

export const RottenIcon = make((a) => (
  <>
    <path d="M12 4l1.6 4.2 4.4-1.6-1.8 4.3 4.3 1.6-4.3 1.8 1.6 4.4-4.2-1.7L12 21l-1.6-4-4.2 1.7 1.6-4.4-4.3-1.8 4.3-1.6-1.8-4.3 4.4 1.6z" {...shape(a)} />
  </>
))

/** Reactie-sleutels (zoals opgeslagen) → icoon + label */
export const REACTIONS: { key: string; label: string; Icon: (p: IconProps) => ReactNode }[] = [
  { key: '🔥', label: 'Vuur', Icon: FlameIcon },
  { key: '😍', label: 'Liefde', Icon: HeartIcon },
  { key: '😂', label: 'Lachen', Icon: LaughIcon },
  { key: '😱', label: 'Schrik', Icon: ShockIcon },
  { key: '😴', label: 'Saai', Icon: SleepIcon },
  { key: '👀', label: 'Benieuwd', Icon: EyeIcon },
]
export const reactionFor = (key: string | null) => REACTIONS.find((r) => r.key === key)
