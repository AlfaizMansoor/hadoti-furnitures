import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, extname, basename } from 'path'
import { globSync } from 'glob'

// 🔑 Automatically find all 18 HTML pages inside public/site
const htmlFiles = globSync('public/site/**/*.html').reduce((entries, file) => {
  // Turn "public/site/about.html" into an entry key name like "about"
  const name = basename(file, extname(file))
  entries[name] = resolve(__dirname, file)
  return entries
}, {})

export default defineConfig({
  plugins: [react()],
  
  // Set project root directory
  root: 'public/site',
  base: '/hadoti-furnitures/', 
  
  build: {
    outDir: '../../dist', 
    emptyOutDir: true,
    
    // Pass the automatically generated list of 18 pages to the compiler
    rollupOptions: {
      input: htmlFiles
    }
  }
})

