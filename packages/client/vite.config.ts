import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { readFileSync } from 'fs';

// Read version from package.json
const packageJson = JSON.parse(readFileSync(path.resolve(__dirname, '../../package.json'), 'utf-8'));
const appVersion = packageJson.version;

// Watches the root package.json and restarts the dev server when the version
// changes (e.g. after /ship), so __APP_VERSION__ updates without a manual restart.
function restartOnVersionChange(): Plugin {
  return {
    name: 'restart-on-version-change',
    configureServer(server) {
      const pkgPath = path.resolve(__dirname, '../../package.json');
      server.watcher.add(pkgPath);
      server.watcher.on('change', (changedPath) => {
        if (changedPath === pkgPath) {
          server.restart();
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    '__APP_VERSION__': JSON.stringify(appVersion),
  },
  plugins: [
    restartOnVersionChange(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Squickr Life',
        short_name: 'Squickr',
        description: 'Get your shit together quicker! Event-sourced bullet journal.',
        theme_color: '#2563eb',
        background_color: '#111827',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@squickr/domain': path.resolve(__dirname, '../domain/src/index.ts'),
      '@squickr/infrastructure': path.resolve(__dirname, '../infrastructure/src/index.ts'),
    },
  },
  server: {
    port: 3000,
    strictPort: true, // Don't auto-increment port if 3000 is in use
    open: true,
  },
});
