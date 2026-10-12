import { posterUrl } from './tmdb'

export interface ShareCardInput {
  eyebrow: string
  title: string
  /** TMDB poster-paden, in volgorde van tonen */
  posters: (string | null)[]
  stats: { value: string; label: string }[]
}

const W = 1080
const H = 1920
const MINT = '#3ee8a0'
const TEAL = '#14b8a6'
const VIOLET = '#8b6cff'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous' // TMDB stuurt CORS-headers, anders zou toBlob() falen
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Afbeelding laden mislukt: ${src}`))
    img.src = src
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** Tekent `img` als "cover" in het vak (zoals object-fit: cover). */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height)
  const sw = w / scale
  const sh = h / scale
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h)
}

const hueGradient = (ctx: CanvasRenderingContext2D, x0: number, x1: number) => {
  const g = ctx.createLinearGradient(x0, 0, x1, 0)
  g.addColorStop(0, MINT)
  g.addColorStop(0.5, TEAL)
  g.addColorStop(1, VIOLET)
  return g
}

/** Story-afbeelding (1080×1920) van een periode: posters + kerncijfers. */
export async function renderShareCard(input: ShareCardInput): Promise<Blob> {
  await Promise.all([
    document.fonts.load('160px "Bebas Neue"'),
    document.fonts.load('700 32px "DM Sans Variable"'),
  ])

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  const sources = input.posters.map((p) => posterUrl(p, 'w342')).filter((s): s is string => !!s)
  const loaded = await Promise.allSettled(sources.map(loadImage))
  const images = loaded.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))

  // Achtergrond: donker, vervaagde eerste poster, aurora-vlekken en een vignet
  ctx.fillStyle = '#050807'
  ctx.fillRect(0, 0, W, H)
  if (images[0]) {
    ctx.save()
    ctx.filter = 'blur(70px) saturate(1.7) brightness(0.75)'
    ctx.globalAlpha = 0.7
    drawCover(ctx, images[0], -200, -200, W + 400, H + 400)
    ctx.restore()
  }
  for (const [x, y, r, color] of [[150, 220, 650, MINT], [980, 1050, 600, TEAL], [300, 1850, 700, VIOLET]] as const) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, color + '66')
    g.addColorStop(1, color + '00')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }
  const vignette = ctx.createLinearGradient(0, 0, 0, H)
  vignette.addColorStop(0, 'rgba(5,8,7,0.35)')
  vignette.addColorStop(0.5, 'rgba(5,8,7,0.15)')
  vignette.addColorStop(1, 'rgba(5,8,7,0.85)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, W, H)

  // Kop: logo + naam
  try {
    const logo = await loadImage(`${import.meta.env.BASE_URL}icon-192.png`)
    ctx.drawImage(logo, 80, 90, 88, 88)
  } catch { /* zonder logo is ook prima */ }
  ctx.font = '64px "Bebas Neue"'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#eef5f1'
  ctx.fillText('MOVIE', 192, 136)
  const movieW = ctx.measureText('MOVIE ').width
  ctx.fillStyle = hueGradient(ctx, 192 + movieW, 192 + movieW + 230)
  ctx.fillText('JOURNAL', 192 + movieW, 136)

  // Titel
  ctx.textBaseline = 'alphabetic'
  ctx.font = '700 30px "DM Sans Variable"'
  ctx.fillStyle = MINT
  ctx.letterSpacing = '6px'
  ctx.fillText(input.eyebrow.toUpperCase(), 84, 320)
  ctx.letterSpacing = '0px'
  ctx.font = '170px "Bebas Neue"'
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 30
  ctx.fillText(input.title.toUpperCase(), 76, 470, W - 150)
  ctx.shadowBlur = 0

  // Postergrid: zo groot mogelijk binnen het vak, max. 12 posters
  const area = { x: 80, y: 540, w: W - 160, h: 1030 }
  const count = Math.min(images.length, 12)
  if (count > 0) {
    const gap = 24
    let best = { cols: 1, pw: 0 }
    for (let cols = 1; cols <= 4; cols++) {
      const rows = Math.ceil(count / cols)
      const pw = Math.min((area.w - gap * (cols - 1)) / cols, ((area.h - gap * (rows - 1)) / rows) * (2 / 3))
      if (pw > best.pw) best = { cols, pw }
    }
    const { cols, pw } = best
    const ph = pw * 1.5
    const rows = Math.ceil(count / cols)
    const gridH = rows * ph + (rows - 1) * gap
    const startY = area.y + (area.h - gridH) / 2
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols)
      const inRow = Math.min(cols, count - row * cols)
      const rowW = inRow * pw + (inRow - 1) * gap
      const x = area.x + (area.w - rowW) / 2 + (i % cols) * (pw + gap)
      const y = startY + row * (ph + gap)
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.6)'
      ctx.shadowBlur = 40
      ctx.shadowOffsetY = 18
      roundRect(ctx, x, y, pw, ph, 18)
      ctx.fillStyle = '#0e1412'
      ctx.fill()
      ctx.restore()
      ctx.save()
      roundRect(ctx, x, y, pw, ph, 18)
      ctx.clip()
      drawCover(ctx, images[i], x, y, pw, ph)
      ctx.restore()
      if (i === count - 1 && images.length > count) {
        ctx.save()
        roundRect(ctx, x, y, pw, ph, 18)
        ctx.fillStyle = 'rgba(5,8,7,0.7)'
        ctx.fill()
        ctx.font = `${Math.round(pw / 3)}px "Bebas Neue"`
        ctx.fillStyle = '#fff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(`+${images.length - count + 1}`, x + pw / 2, y + ph / 2)
        ctx.restore()
      }
    }
  }

  // Kerncijfers
  const stats = input.stats.slice(0, 3)
  const colW = (W - 160) / stats.length
  stats.forEach((s, i) => {
    const x = 80 + i * colW
    ctx.font = '110px "Bebas Neue"'
    ctx.fillStyle = hueGradient(ctx, x, x + ctx.measureText(s.value).width)
    ctx.fillText(s.value, x, 1730)
    ctx.font = '600 28px "DM Sans Variable"'
    ctx.fillStyle = 'rgba(238,245,241,0.7)'
    ctx.letterSpacing = '3px'
    ctx.fillText(s.label.toUpperCase(), x + 4, 1780)
    ctx.letterSpacing = '0px'
  })

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Afbeelding maken mislukt'))), 'image/png'),
  )
}
