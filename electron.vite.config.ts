import {resolve} from 'path';
import {defineConfig, externalizeDepsPlugin} from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The source lives in "scripts", split into ui (the window), common (shared + the app side) and preload.
export default defineConfig({
    main: {
        plugins: [externalizeDepsPlugin()],
        build: {
            rollupOptions: {
                input: {mainindex: resolve(__dirname, 'scripts/ui/mainindex.ts')}
            }
        }
    },
    preload: {
        plugins: [externalizeDepsPlugin({exclude: ['yaml']})],
        build: {
            rollupOptions: {
                input: {preloadindex: resolve(__dirname, 'scripts/preload/preloadindex.ts')}
            }
        }
    },
    renderer: {
        root: resolve(__dirname, 'scripts/ui'),
        plugins: [react(), tailwindcss()],
        build: {
            rollupOptions: {
                input: {index: resolve(__dirname, 'scripts/ui/index.html')}
            }
        }
    }
});
