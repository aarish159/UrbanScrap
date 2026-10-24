import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Generates static fallback files for Render and other static web hosts:
 * 1. dist/404.html & dist/200.html: Standard SPA fallbacks
 * 2. dist/auth/callback/index.html: Physical route file so /auth/callback returns 200 OK immediately
 */
function renderSpaFallbackPlugin(): Plugin {
  return {
    name: 'render-spa-fallback-plugin',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist')
      const indexHtmlPath = path.join(distDir, 'index.html')

      if (fs.existsSync(indexHtmlPath)) {
        fs.copyFileSync(indexHtmlPath, path.join(distDir, '404.html'))
        fs.copyFileSync(indexHtmlPath, path.join(distDir, '200.html'))

        const routes = [
          path.join('auth', 'callback'),
          path.join('dealer', 'verify-gst'),
          'dealer',
          'admin',
          path.join('admin', 'dealers'),
          'prices',
          'book',
          'bookings',
          'reset-password',
        ]

        for (const route of routes) {
          const targetDir = path.join(distDir, route)
          fs.mkdirSync(targetDir, { recursive: true })
          fs.copyFileSync(indexHtmlPath, path.join(targetDir, 'index.html'))
        }
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    renderSpaFallbackPlugin(),
  ],
  server: {
    port: 3000,
    host: true,
  },
  preview: {
    port: 3000,
  },
})

