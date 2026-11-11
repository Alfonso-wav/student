import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages sirve el repo en /<nombre-del-repo>/. Cámbialo con BASE si el repo se llama distinto.
const base = process.env.BASE ?? '/student/'
// En la app Android (Capacitor) no hay service worker: los archivos ya van dentro del APK.
const native = process.env.NATIVE === '1'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      disable: native,
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Student',
        short_name: 'Student',
        description: 'Estudio en vez de scroll: ingeniería de datos, seguridad y arquitectura.',
        lang: 'es',
        start_url: base + '#/feed',
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0c0d0c',
        theme_color: '#0c0d0c',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        // La app se precachea entera (~1 MB). Postgres WASM (~15 MB) no: se baja al arrancar el
        // primer lab y desde entonces queda en caché para usar los labs sin conexión.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['**/pglite-*', '**/initdb-*'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            // Vídeos (narración, tiempos de subtítulo e imágenes): se bajan al reproducir y quedan
            // para verlos sin conexión.
            // El nombre es un hash del texto, así que un archivo nunca cambia de contenido.
            urlPattern: /\/(audio|img)\/[0-9a-f]+\.(m4a|json|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'audio',
              expiration: { maxEntries: 1200 },
              cacheableResponse: { statuses: [200] },
              rangeRequests: true,
            },
          },
          {
            urlPattern: /\/assets\/(pglite|initdb)-.*\.(wasm|data)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'pglite',
              expiration: { maxEntries: 6 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  optimizeDeps: { exclude: ['@electric-sql/pglite'] },
  build: { target: 'es2022' },
})
