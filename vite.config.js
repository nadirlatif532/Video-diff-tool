import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Custom plugin: serve /ffmpeg/* files directly from the filesystem,
// bypassing Vite's module pipeline entirely. This is required because
// the FFmpeg web worker does a dynamic import() of ffmpeg-core.js at runtime,
// which Vite would otherwise intercept, try to transform, and reject since
// the file lives in /public.
function serveFFmpegWasm() {
  return {
    name: 'serve-ffmpeg-wasm',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? ''
        if (!url.startsWith('/ffmpeg/')) return next()

        const filePath = path.join(process.cwd(), 'public', url)
        if (!fs.existsSync(filePath)) return next()

        const ext = path.extname(filePath)
        const mime =
          ext === '.wasm' ? 'application/wasm' :
          ext === '.js'   ? 'text/javascript'  :
                            'application/octet-stream'

        res.setHeader('Content-Type', mime)
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
        fs.createReadStream(filePath).pipe(res)
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serveFFmpegWasm()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
