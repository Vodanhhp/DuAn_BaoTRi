import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [],
      manifest: {
        name: 'Quản lý bảo trì',
        short_name: 'Bảo trì',
        description: 'Quản lý thiết bị, vật tư và kế hoạch bảo trì',
        theme_color: '#123b36',
        background_color: '#f4f7f6',
        display: 'standalone',
        start_url: '/',
        icons: []
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      }
    })
  ],
  server: { port: 5173 }
})
