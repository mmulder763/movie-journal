import { useEffect, type ComponentType } from 'react'
import { CheckIcon, type IconProps } from './Icons'

export interface ToastMessage {
  id: number
  text: string
  /** Icoon vóór de tekst (standaard een vinkje) */
  Icon?: ComponentType<IconProps>
}

export function Toast({ toast, onDone }: { toast: ToastMessage | null; onDone: () => void }) {
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(onDone, 3200)
    return () => clearTimeout(timer)
  }, [toast, onDone])

  if (!toast) return null
  const Icon = toast.Icon ?? CheckIcon
  return (
    <div className="toast" key={toast.id} role="status">
      <Icon size={18} />
      <span>{toast.text}</span>
    </div>
  )
}
