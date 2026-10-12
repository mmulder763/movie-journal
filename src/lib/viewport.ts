/**
 * iOS (vooral als PWA) verkleint de pagina niet als het toetsenbord opent; vaste
 * elementen onderin blijven dan achter het toetsenbord. Daarom houden we het
 * zichtbare deel bij in CSS-variabelen (--vv-top/--vv-height) en zetten we een
 * class zolang het toetsenbord open is.
 */
export function trackVisualViewport() {
  const vv = window.visualViewport
  if (!vv) return
  const root = document.documentElement
  const update = () => {
    root.style.setProperty('--vv-top', `${vv.offsetTop}px`)
    root.style.setProperty('--vv-height', `${vv.height}px`)
    root.classList.toggle('keyboard-open', vv.height < window.innerHeight * 0.8)
  }
  vv.addEventListener('resize', update)
  vv.addEventListener('scroll', update)
  update()

  // Focus in een veld: zorg dat het in beeld komt zodra het toetsenbord er is
  document.addEventListener('focusin', (e) => {
    const el = e.target as HTMLElement
    if (!el.matches('input, textarea')) return
    setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)
  })
}
