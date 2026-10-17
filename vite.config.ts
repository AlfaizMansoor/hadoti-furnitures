import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  
  // 🔑 FIX 1: Tell Vite that your source files live in public/site
  root: 'public/site',
  
  // 🔑 FIX 2: Prefix paths correctly for GitHub Pages routing
  base: '/hadoti-furnitures/', 
  
  build: {
    // Tells Vite to output 'dist' relative to your main workspace root directory
    outDir: '../../dist', 
    emptyOutDir: true
  }
})

