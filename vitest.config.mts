import { fileURLToPath } from 'node:url'
import { mergeConfig } from 'vite'
import { configDefaults, defineConfig } from 'vitest/config'
import viteConfig from './vite.config.mts'

// All test configuration lives here. vite.config.mts is the build config only:
// when both files declare a `test` block this one wins, which quietly strands
// whatever the other one says.
export default mergeConfig(
	viteConfig,
	defineConfig({
		test: {
			globals: true,
			environment: 'jsdom',
			exclude: [...configDefaults.exclude, 'e2e/*'],
			root: fileURLToPath(new URL('./', import.meta.url)),
			coverage: {
				provider: 'istanbul',
				all: false,
				reporter: ['text', 'lcov'],
				reportsDirectory: './coverage',
				exclude: [
					'**/*.spec.ts',
					'**/__tests__/**',
					'**/*.d.ts',
					'src/main.ts',
					'dist/**',
					'public/**'
				]
			}
		}
	})
)
