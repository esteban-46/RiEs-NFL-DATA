import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// base './' para que el build funcione desde cualquier ruta; en desarrollo /api va a Uvicorn
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8000' } },
})
