import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // strictPort: fail instead of silently moving to 5174, which would
  // no longer match CLIENT_ORIGIN on the server and break CORS.
  server: { port: 5173, strictPort: true },
});
