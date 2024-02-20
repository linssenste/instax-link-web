import type { Meta, StoryObj } from '@storybook/vue3';
import { action } from '@storybook/addon-actions'

import { userEvent, within } from '@storybook/testing-library';

import ProjectLinks from '../../../components/layout/ProjectLinks.vue';

/**
 * This component sets the theme color for the whole application. The color is set as a CSS variable ```--dynamic-bg-color`` and thereby updates the theme of the app. It also emits the selected color as an event and also saves the selection in local storage to use this selection on the next reload. Most components of the app (buttons, selectors, text, etc.) dynamically change based on this selection. 
 */
const meta = {
	title: 'Layout/Project information',
	component: ProjectLinks,

	tags: ['autodocs'],
} satisfies Meta<typeof ProjectLinks>;



export default meta;

type Story = StoryObj<typeof meta>;


export const Event: Story = {
	decorators: [
		() => ({
			template: '<story v-on:color-change="action"/>',
			methods: { action: action('color-change') }
		}),
	],
}




