import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react' // Fixed: plugin-react instead of react-plugin
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), 
  ],
   optimizeDeps: {
    include: ['lucide-react', 'react', 'react-dom'],
  },
})

