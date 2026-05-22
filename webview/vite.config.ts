import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'node:path';

export default defineConfig({
    plugins: [vue(), viteSingleFile()],
    build: {
        outDir: path.resolve(__dirname, '../webview-dist'),
        emptyOutDir: true,
        cssCodeSplit: false,
        assetsInlineLimit: 100_000_000,
        chunkSizeWarningLimit: 100_000_000,
        rollupOptions: {
            output: {
                inlineDynamicImports: true
            }
        }
    }
});
