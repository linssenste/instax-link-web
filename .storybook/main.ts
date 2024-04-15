import type { StorybookConfig } from '@storybook/vue3-vite'

const config: StorybookConfig = {
	stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
	addons: [
		'@storybook/addon-links',
		'@storybook/addon-essentials',
		'@storybook/addon-interactions',
		'storybook-addon-vue-slots',
		'@storybook/addon-a11y'
	],
	framework: {
		name: '@storybook/vue3-vite',
		options: {}
	},
	docs: {
		autodocs: 'tag'
	}
}


export default config
