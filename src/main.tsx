import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import Root from './Root'
import { trackVisualViewport } from './lib/viewport'
import '@fontsource/bebas-neue'
import '@fontsource-variable/dm-sans'
import './styles.css'

registerSW({ immediate: true })
trackVisualViewport()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
