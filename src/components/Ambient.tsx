import { useEffect, useState } from 'react'

interface Props {
  image: string | null
}

interface Layer {
  id: number
  image: string
}

/**
 * Sterk vervaagde versie van de huidige poster/backdrop achter de hele app, zoals
 * "ambient mode" bij een tv. Nieuwe beelden faden over de vorige heen.
 */
export function Ambient({ image }: Props) {
  const [layers, setLayers] = useState<Layer[]>([])

  useEffect(() => {
    if (!image) return
    setLayers((prev) => (prev.at(-1)?.image === image ? prev : [...prev.slice(-1), { id: Date.now(), image }]))
  }, [image])

  return (
    <div className="ambient" aria-hidden>
      <div className="aurora">
        <span /><span /><span />
      </div>
      {layers.map((l) => (
        <div key={l.id} className="ambient-layer" style={{ backgroundImage: `url(${l.image})` }} />
      ))}
    </div>
  )
}
