import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginVueA11y from 'eslint-plugin-vuejs-accessibility'

export default defineConfigWithVueTs(
	{
		name: 'app/files',
		files: ['**/*.{js,mjs,ts,mts,vue}']
	},
	{
		name: 'app/ignores',
		ignores: ['dist/**', 'coverage/**', 'public/**']
	},

	pluginVue.configs['flat/essential'],
	pluginVueA11y.configs['flat/recommended'],
	vueTsConfigs.recommended,

	{
		name: 'app/rules',
		rules: {
			'vue/require-default-prop': 'off',
			'@typescript-eslint/no-explicit-any': 'error'
		}
	},
	{
		// test doubles stand in for third party objects, where the shape is not
		// worth restating
		name: 'app/tests',
		files: ['src/**/__tests__/**'],
		rules: {
			'@typescript-eslint/no-explicit-any': 'off'
		}
	}
)
