import { defineConfig } from 'vite'
export default defineConfig({ base: './', build: { outDir: 'dist-embed', lib: { entry: 'src/library.js', formats: ['es'], fileName: () => 'editor.js', cssFileName: 'editor' } } })
