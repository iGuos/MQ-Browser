import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const host = process.env.TAURI_DEV_HOST

// Demo mode: serve hand-written fixtures instead of calling the Rust backend,
// so the UI renders in a plain browser (e.g. for docs screenshots) with no real
// broker. Enable with `VITE_DEMO=1 pnpm dev:vite`. Off by default.
const demo = process.env.VITE_DEMO === '1'

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'shared'),
      ...(demo
        ? { '@tauri-apps/api/core': path.resolve(__dirname, 'src/lib/demoCore.ts') }
        : {}),
    },
  },
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1426,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1427,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
}))
