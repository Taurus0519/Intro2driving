import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const basePath = (process.env.VITE_BASE_PATH || '/intro2driving-system').replace(/\/+$/, '') || '/';

export default defineConfig({
  plugins: [
    react({ include: /\.[jt]sx?$/ }),
  ],
  base: `${basePath}/`,
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: false,
  },
})
