import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const mapsApiKey =
    env.VITE_GOOGLE_MAPS_API_KEY ||
    env.GOOGLE_MAPS_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    '';

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    define: {
      'process.env.GOOGLE_MAPS_API_KEY': JSON.stringify(mapsApiKey),
    },
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
  };
})
