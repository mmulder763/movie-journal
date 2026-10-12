import { useEffect } from 'react'

export interface ToastMessage {
  id: number
  text: string
}

export function Toast({ toast, onDone }: { toast: ToastMessage | null; onDone: () => void }) {
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(onDone, 3200)
    return () => clearTimeout(timer)
  }, [toast, onDone])

  return toast ? (
    <div className="toast" key={toast.id} role="status">
      {toast.text}
    </div>
  ) : null
}
