import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import fs from 'node:fs/promises'

function devSpaFallback() {
  return {
    name: 'dev-spa-fallback',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url ? req.url.split('?')[0] : '';
        const isHtmlNav = req.headers.accept && req.headers.accept.includes('text/html');

        if (!isHtmlNav) {
          return next();
        }

        // Landing page
        if (rawUrl === '/' || rawUrl === '/index.html' || rawUrl === '/landing') {
          try {
            const filePath = resolve(import.meta.dirname, 'index.html');
            let html = await fs.readFile(filePath, 'utf-8');
            html = await server.transformIndexHtml(req.url, html);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html');
            return res.end(html);
          } catch (e) {
            return next(e);
          }
        }

        // Studio app
        if (
          !rawUrl.startsWith('/@') &&
          !rawUrl.startsWith('/src') &&
          !rawUrl.startsWith('/node_modules') &&
          !/\.[a-zA-Z0-9]+$/.test(rawUrl) &&
          (rawUrl === '/app' || rawUrl === '/app/' || rawUrl.startsWith('/app/') || rawUrl === '/profile' || rawUrl.startsWith('/profile/'))
        ) {
          try {
            const filePath = resolve(import.meta.dirname, 'app.html');
            let html = await fs.readFile(filePath, 'utf-8');
            html = await server.transformIndexHtml(req.url, html);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html');
            return res.end(html);
          } catch (e) {
            return next(e);
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
    devSpaFallback()
  ],
  build: {
    rollupOptions: {
      input: {
        landing: resolve(import.meta.dirname, 'index.html'),
        app: resolve(import.meta.dirname, 'app.html')
      }
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/static': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      }
    }
  }
})
