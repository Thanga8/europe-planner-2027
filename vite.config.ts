import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: true,
    port: 5174,
    allowedHosts: true, // Allows any tunnel host like *.loca.lt, ngrok, cloudflare
  },
  preview: {
    host: true,
    port: 5174,
    allowedHosts: true,
  },
})
