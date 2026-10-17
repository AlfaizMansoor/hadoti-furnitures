import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, extname, basename } from 'path'
import { readdirSync } from 'fs'

// 🔑 Clean native scanner to find all 18 HTML files inside public/site
const siteDir = resolve(__dirname, 'public/site')
const htmlFiles: Record<string, string> = {}

try {
  const files = readdirSync(siteDir)
  files.forEach(file => {
    if (extname(file) === '.html') {
      const name = basename(file, '.html')
      htmlFiles[name] = resolve(siteDir, file)
    }
  })
} catch (err) {
  console.error("Error reading public/site directory:", err)
}

export default defineConfig({
  plugins: [react()],
  
  // Set project root directory
  root: 'public/site',
  base: '/hadoti-furnitures/', 
  
  build: {
    outDir: '../../dist', 
    emptyOutDir: true,
    
    // Automatically passes your 18 pages to the bundler engine
    rollupOptions: {
      input: htmlFiles
    }
  }
})

