import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
var __dirname = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
    main: {
        build: {
            outDir: 'dist/main'
        }
    },
    preload: {
        build: {
            outDir: 'dist/preload',
            lib: {
                entry: 'src/preload/index.ts',
                formats: ['cjs'],
                fileName: function () { return 'index.cjs'; }
            },
            rollupOptions: {
                external: ['electron']
            }
        }
    },
    renderer: {
        build: {
            outDir: 'dist/renderer',
            rollupOptions: {
                input: {
                    main: path.resolve(__dirname, 'src/renderer/index.html')
                }
            }
        },
        plugins: [react()]
    }
});
