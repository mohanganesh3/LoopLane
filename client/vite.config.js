import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Some libraries (recharts, map-gl) may expect process.env or global
    'process.env': {},
    global: 'globalThis',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'react-redux': path.resolve(__dirname, 'node_modules/react-redux'),
    },
    dedupe: ['react', 'react-dom', 'react-redux'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-is', 'react-redux', 'redux-persist'],
    exclude: ['fsevents']
  }
})
