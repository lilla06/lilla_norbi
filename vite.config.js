import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

export default defineConfig({
  base: '/lilla_norbi/',
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    watch: {
      // A .cursor mappa (pl. permissions.json) OneDrive alatt EBUSY hibát okozhat
      ignored: ['**/.cursor/**'],
    },
  },
})