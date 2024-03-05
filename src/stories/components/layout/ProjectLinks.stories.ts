import type { Meta, StoryObj } from '@storybook/vue3';
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


export const Primary: Story = {

}

export const References: Story = {
	play: async ({ canvasElement }) => {

		const canvas = within(canvasElement);

		await userEvent.hover(canvas.getByTestId("github-link"));
		await userEvent.click(canvas.getByTestId("github-link"));

		await userEvent.hover(canvas.getByTestId("storybook-link"));
		await userEvent.click(canvas.getByTestId("storybook-link"));

		await userEvent.hover(canvas.getByTestId("bmc-link"));
		await userEvent.click(canvas.getByTestId("bmc-link"));

	}

}







