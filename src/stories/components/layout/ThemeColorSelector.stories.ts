import type { Meta, StoryObj } from '@storybook/vue3';
import { action } from '@storybook/addon-actions'

import { userEvent, within } from '@storybook/testing-library';

import ThemeColorSelector from '../../../components/layout/ThemeColorSelector.vue';

/**
 * This component sets the theme color for the whole application. The color is set as 
 * a CSS variable ```--dynamic-bg-color`` and thereby updates the theme of the app. 
 * It also emits the selected color as an event and also saves the selection in local 
 * storage to use this selection on the next reload. Most components of the app 
 * (buttons, selectors, text, etc.) dynamically change based on this selection. 
 */
const meta = {
	title: 'Layout/Theme selector',
	component: ThemeColorSelector,

	tags: ['autodocs'],
} satisfies Meta<typeof ThemeColorSelector>;



export default meta;

type Story = StoryObj<typeof meta>;



export const Event: Story = {
	decorators: [
		() => ({
			template: '<story v-on:color-change="action"/>',
			methods: { action: action('color-change') }
		}),
	],

	play: async ({ canvasElement }) => {

		const canvas = within(canvasElement);

		const colors = ['orange', 'yellow', 'green', 'blue', 'pink', 'black', 'red'];

		for (let index = 0; index < colors.length; index++) {
			const colorElement = canvas.getByTestId(`${colors[index]}-color-item`);
			await userEvent.click(colorElement);

		}
	},


};

/**
 * Example of the immediate change of the (opaque) background by means of the CSS variable
 */
export const Theme: Story = {
	decorators: [
		() => ({
			template: '<div style="position: relative; "><div style="position: absolute; background-color: var(--dynamic-bg-color); height: 100%; width: 100%; top: 0px; left: 0px; opacity: .5; z-index: -1; border-radius: 10px"/> <story style="padding: 20px" /></div>'
		}),
	],
};



