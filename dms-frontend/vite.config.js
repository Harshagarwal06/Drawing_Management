import process from 'node:process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { PRIVATE_REQUEST_PATTERN } from './src/pwa/cachePolicy.js'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      manifest: {
        id: '/',
        name: 'DrawVault — Unique Properties',
        short_name: 'DrawVault',
        description: 'Drawing and transmittal management for Unique Properties projects.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f8f9fc',
        theme_color: '#f8f9fc',
        categories: ['business', 'productivity'],
        icons: [
          { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        cacheId: 'drawvault-shell',
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
        globPatterns: ['**/*.{js,css,html,png,svg,woff2,webmanifest}'],
        globIgnores: [
          'manifest.webmanifest',
          'pwa/icon-192.png',
          'pwa/icon-512.png',
          'pwa/icon-maskable-512.png',
        ],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [PRIVATE_REQUEST_PATTERN],
        runtimeCaching: [
          {
            urlPattern: PRIVATE_REQUEST_PATTERN,
            handler: 'NetworkOnly',
            options: { cacheName: 'drawvault-private-network-only' },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
  server: {
    port: Number(process.env.PORT) || 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
