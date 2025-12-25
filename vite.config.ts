import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from "vite-plugin-singlefile"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    // Relative base ensures the app works in any subdirectory (public IP deployment friendly)
    base: './', 
    plugins: [
        react(), 
        viteSingleFile()
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY || 'AIzaSyAiE2yGMxcaXhy1DQc-3dVGKbJhvAjmN7w'),
    },
    server: {
      host: '0.0.0.0', // Allows access from network IP
      port: 5173,
      watch: {
          ignored: ['**/public/database.json']
      },
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        }
      }
    },
    build: {
        target: "esnext",
        assetsInlineLimit: 100000000, 
        chunkSizeWarningLimit: 100000000,
        cssCodeSplit: false, 
        reportCompressedSize: false,
        rollupOptions: {
            output: {
                inlineDynamicImports: true, 
            },
        },
    }
  }
})
