import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The FastAPI backend (uvicorn main:app --port 8000). Same-origin /api keeps the sign-in cookie working,
    // exactly as on Vercel, where /api is routed to the backend service.
    proxy: { '/api': 'http://localhost:8000' },
  },
})
