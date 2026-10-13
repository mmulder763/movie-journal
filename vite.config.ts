import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { journalApi } from './server/journalApi.ts'

// GitHub Pages serveert de site onder /movie-journal/; lokaal gewoon vanaf /
const base = process.env.GITHUB_PAGES ? '/movie-journal/' : '/'

export default defineConfig({
  base,
  // Bereikbaar op het lokale netwerk (bv. telefoon op dezelfde wifi)
  server: { host: true },
  preview: { host: true },
  plugins: [
    react(),
    journalApi(process.env.JOURNAL_FILE),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Movie Journal',
        short_name: 'Journal',
        description: 'Houd bij welke films en series je wanneer hebt gezien.',
        lang: 'nl',
        theme_color: '#050807',
        background_color: '#050807',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        // Pushmeldingen (public/push-sw.js)
        importScripts: ['push-sw.js'],
        runtimeCaching: [
          {
            // Posters blijven offline beschikbaar
            urlPattern: ({ url }) => url.origin === 'https://image.tmdb.org',
            handler: 'CacheFirst',
            options: {
              cacheName: 'tmdb-images',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
