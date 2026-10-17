import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths()
  ],
  // 🔑 CRITICAL: This ensures your generated CSS/JS prefixes load /hadoti-furnitures/ correctly
  base: '/hadoti-furnitures/', 
  build: {
    outDir: 'dist', // Standard static production directory output
  }
})
