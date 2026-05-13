import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import UnoCSS from 'unocss/vite'
import { presetUno, presetIcons, transformerDirectives } from 'unocss'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    UnoCSS({
      presets: [presetUno({ dark: 'class' }), presetIcons()],
      transformers: [transformerDirectives()],
      theme: {
        colors: {
          primary: 'rgb(var(--color-primary) / <alpha-value>)'
        }
      }
    })
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
