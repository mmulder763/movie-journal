const pad = (n: number) => String(n).padStart(2, '0')

/** Date → 'YYYY-MM-DD' in lokale tijd (geen UTC-verschuiving). */
export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const fromISODate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const today = () => toISODate(new Date())

/** Alle dagen voor een maandraster, beginnend op maandag (6 weken). */
export function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7 // maandag = 0
  return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - offset + i))
}

export const WEEKDAYS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']

export const formatMonth = (year: number, month: number) =>
  new Date(year, month, 1).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })

export const formatLongDate = (iso: string) =>
  fromISODate(iso).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
