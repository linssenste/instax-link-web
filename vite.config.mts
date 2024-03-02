import { fileURLToPath, URL } from 'node:url'
import { configDefaults } from 'vitest/config'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import eslintPlugin from 'vite-plugin-eslint';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [vue(), eslintPlugin({
		exclude: ['/virtual:/**', 'node_modules/**', '/sb-preview/**'],
	})],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url))
		}
	},

	test: {
		exclude: [...configDefaults.exclude, 'packages/template/*'],
		globals: true,
		environment: 'happy-dom',
		coverage: {
			all: false,
			provider: 'c8',
			reporter: ['json', 'text', 'lcov', 'html'],
			exclude: [
				'**/*.spec.ts',
				'src/router.ts',
				'main.cjs',
				'preview.cjs',
				'.storybook',
				'dist/**',
				'public/**',
				'src/plugins/**',
				'src/stories/**',
				'src/main.ts',
				'src/vite-env.d.ts',
				'src/App.vue',
				'vite.config.ts',
				'vitest.config.ts'
			]
		},
	}
})
