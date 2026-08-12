import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: Number(env.VITE_PORT) || 5173,
      // Le front appelle `/api/...` : Vite relaie vers Express en dev, ce qui
      // evite toute config CORS et garde les memes URLs qu'en production.
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      rollupOptions: {
        output: {
          /*
           * React et le routeur dans leur propre fichier.
           *
           * Ils ne changent qu'aux montees de version, alors que le code de
           * l'application change a chaque deploiement. Separes, le navigateur
           * garde la partie stable en cache : une correction sur un ecran ne
           * fait plus retelecharger 150 Ko de bibliotheque.
           */
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            if (/node_modules[/\\](react|react-dom|react-router|scheduler)/.test(id)) {
              return 'react'
            }
            return undefined
          },
        },
      },
    },
  }
})
