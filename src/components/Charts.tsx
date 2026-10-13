import type { CSSProperties } from 'react'

export interface Segment {
  name: string
  value: number
  color: string
}

export interface Column {
  label: string
  segments: Segment[]
}

/** Verticale (gestapelde) staafgrafiek met tooltip bij hover/tap en een tabel voor screenreaders. */
export function ColumnChart({ columns, caption, height = 170 }: { columns: Column[]; caption: string; height?: number }) {
  const max = Math.max(1, ...columns.map((c) => c.segments.reduce((n, s) => n + s.value, 0)))
  // Bij veel kolommen niet elk label tonen (wel in de tooltip): ongeveer 8 labels, altijd de laatste
  const step = Math.ceil(columns.length / 8)
  const shortLabel = (label: string) => (/^\d{4}$/.test(label) && columns.length > 8 ? `'${label.slice(2)}` : label)
  return (
    <figure className="chart">
      <div className="columns" style={{ height } as CSSProperties} aria-hidden>
        {columns.map((c, i) => {
          const total = c.segments.reduce((n, s) => n + s.value, 0)
          return (
            <div key={c.label} className="column" tabIndex={0} style={{ '--i': i } as CSSProperties}>
              <div className="column-stack" style={{ height: `${(total / max) * 100}%` }}>
                {c.segments.filter((s) => s.value > 0).map((s) => (
                  <span key={s.name} className="column-seg" style={{ flexGrow: s.value, background: s.color }} />
                ))}
              </div>
              <span className="column-label">{(i % step === 0 || i === columns.length - 1) && shortLabel(c.label)}</span>
              {total > 0 && (
                <span className="chart-tip">
                  <strong>{c.label}: {total}</strong>
                  {c.segments.length > 1 && c.segments.map((s) => (
                    <span key={s.name}><i style={{ background: s.color }} />{s.name} {s.value}</span>
                  ))}
                </span>
              )}
            </div>
          )
        })}
      </div>
      <DataTable caption={caption} rows={columns.map((c) => [c.label, ...c.segments.map((s) => `${s.name}: ${s.value}`)])} />
    </figure>
  )
}

export interface BarRow {
  label: string
  value: number
  /** Optioneel klein plaatje (bv. profielfoto) */
  image?: string | null
}

/** Horizontale staven met label en waarde ernaast. */
export function BarList({ rows, caption, color, unit = '' }: { rows: BarRow[]; caption: string; color: string; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <figure className="chart">
      <ul className="bar-list" aria-hidden>
        {rows.map((r, i) => (
          <li key={r.label} style={{ '--i': i } as CSSProperties} title={`${r.label}: ${r.value}${unit}`}>
            <span className="bar-label">{r.label}</span>
            <span className="bar-track">
              <span className="bar-fill" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
            </span>
            <span className="bar-value">{r.value}{unit}</span>
          </li>
        ))}
      </ul>
      <DataTable caption={caption} rows={rows.map((r) => [r.label, `${r.value}${unit}`])} />
    </figure>
  )
}

export function Legend({ items }: { items: { name: string; color: string }[] }) {
  return (
    <div className="legend">
      {items.map((i) => (
        <span key={i.name}><i style={{ background: i.color }} />{i.name}</span>
      ))}
    </div>
  )
}

function DataTable({ caption, rows }: { caption: string; rows: string[][] }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <tbody>{rows.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
    </table>
  )
}
