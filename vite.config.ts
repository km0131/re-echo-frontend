import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/** dist/_headers の __API_ORIGIN__ を API の origin に置き換える（CSP の connect-src・img-src 用） */
function headersPlugin(apiBase: string): Plugin {
  let outDir = 'dist'
  return {
    name: 'chosei-headers',
    apply: 'build',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir)
    },
    closeBundle() {
      const file = resolve(outDir, '_headers')
      const origin = /^https?:\/\//.test(apiBase) ? new URL(apiBase).origin : ''
      const text = readFileSync(file, 'utf8').replaceAll(' __API_ORIGIN__', origin ? ` ${origin}` : '')
      writeFileSync(file, text)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const target = env.VITE_PROXY_TARGET || 'http://localhost:8080'
  const proxy = { target, changeOrigin: true }
  return {
    plugins: [react(), headersPlugin(env.VITE_API_BASE_URL || '/api/v1')],
    server: {
      host: true,
      watch: { usePolling: env.VITE_USE_POLLING === 'true' },
      // /api（SSE を含む）、/media、/og を backend へ
      proxy: { '/api': proxy, '/media': proxy, '/og': proxy },
    },
  }
})
