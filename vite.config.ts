/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const API_ORIGIN = 'https://datahub.bordeaux-metropole.fr';

export default defineConfig({
  base: '/pont-chaban/',
  build: { target: 'es2022' },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Pont Chaban',
        short_name: 'Pont Chaban',
        description:
          "État du pont Chaban-Delmas à Bordeaux et fermetures à venir, d'après les prévisions officielles de Bordeaux Métropole.",
        lang: 'fr',
        start_url: '/pont-chaban/',
        scope: '/pont-chaban/',
        id: '/pont-chaban/',
        display: 'standalone',
        background_color: '#f7f0e4',
        theme_color: '#6b1e2e',
        categories: ['travel', 'utilities'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: '/pont-chaban/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === API_ORIGIN,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-bordeaux-metropole',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
});
