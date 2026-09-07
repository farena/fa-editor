import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// El repositorio en GitHub, que es tambien el subdirectorio bajo el que Pages
// publica el lab: https://farena.github.io/fa-editor/
const REPO = 'fa-editor'

// Una sola config para los tres modos:
//   npm run dev        -> sirve el lab (lab/index.html)
//   npm run build      -> compila la libreria a dist/
//   npm run build:lab  -> compila el lab a dist-lab/, para GitHub Pages
export default defineConfig(({ command, mode }) => {
  const lab = command === 'serve' || mode === 'lab'

  return {
    root: lab ? 'lab' : undefined,
    // Pages sirve el lab bajo /<repo>/, no en la raiz del dominio.
    base: mode === 'lab' ? `/${REPO}/` : '/',
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    server: {
      port: 9092
    },
    css: {
      // Sin esto sass usa la API vieja y avisa de la deprecacion en cada build.
      preprocessorOptions: {
        scss: { api: 'modern-compiler' }
      }
    },
    build:
      mode === 'lab'
        ? {
            // Absoluto: un outDir relativo se resolveria dentro de lab/.
            outDir: fileURLToPath(new URL('./dist-lab', import.meta.url)),
            // outDir queda fuera del root, asi que hay que autorizar el borrado.
            emptyOutDir: true
          }
        : {
            lib: {
              entry: fileURLToPath(new URL('./src/index.js', import.meta.url)),
              name: 'FaEditor',
              formats: ['es', 'umd'],
              fileName: (format) => (format === 'es' ? 'fa-editor.js' : 'fa-editor.umd.cjs')
            },
            rollupOptions: {
              // Vue lo pone la aplicacion que consume el paquete.
              external: ['vue'],
              output: {
                globals: { vue: 'Vue' },
                // El componente se exporta como default y como nombrado (son el mismo
                // objeto). Sin esto rollup avisa que en UMD haria falta `.default`.
                exports: 'named'
              }
            }
          }
  }
})
