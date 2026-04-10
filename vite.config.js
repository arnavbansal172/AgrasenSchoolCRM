import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: false }, // Disable PWA in dev to avoid caching issues
      workbox: {
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024, // 30MB (for face-api.js models)
      },
      manifest: {
        name: 'SAVM ERP — School Management',
        short_name: 'SAVM ERP',
        description: 'Shri Agrasen Vidya Mandir — Staff Portal',
        theme_color: '#4f46e5',
        background_color: '#1e1b4b',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],

  // ── DEVELOPMENT SERVER ─────────────────────────────────────────────────
  server: {
    host: '0.0.0.0',   // Allow LAN access from phones during development
    port: 5173,
    proxy: {
      // During development, proxy API calls to the backend server
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },

  // ── PRODUCTION BUILD ───────────────────────────────────────────────────
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('face-api.js')) return 'face-api';
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) return 'react-vendor';
        },
      },
    },
  },
})

