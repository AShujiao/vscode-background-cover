import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { viteSingleFile } from 'vite-plugin-singlefile';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import path from 'node:path';

export default defineConfig({
    plugins: [
        vue(),
        // Element Plus 按需引入：只打包模板中实际用到的组件及其样式。
        // dts 关闭，避免在仓库中生成 auto-imports.d.ts / components.d.ts。
        AutoImport({
            resolvers: [ElementPlusResolver()],
            dts: false
        }),
        Components({
            resolvers: [ElementPlusResolver()],
            dts: false
        }),
        viteSingleFile()
    ],
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
