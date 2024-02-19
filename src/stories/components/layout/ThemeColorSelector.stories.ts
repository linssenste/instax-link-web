import type { Meta, StoryObj } from '@storybook/vue3';
import { action } from '@storybook/addon-actions'

import { expect } from '@storybook/jest';

import { userEvent, within } from '@storybook/testing-library';

import ThemeColorSelector from '../../../components/layout/ThemeColorSelector.vue';

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories
const meta = {
  title: 'Layout/Theme selector',
  component: ThemeColorSelector,

  tags: ['autodocs'],
} satisfies Meta<typeof ThemeColorSelector>;

export default meta;


type Story = StoryObj<typeof meta>;


/**
 * This component sets the theme color for the whole application. The color is set as a CSS variable ```--dynamic-bg-color`` and thereby updates the theme of the app. It also emits the selected color as an event and also saves the selection in local storage to use this selection on the next reload. Most components of the app (buttons, selectors, text, etc.) dynamically change based on this selection. 
 */
 export const Event: Story = {
	decorators: [
	  () => ({
		template: '<story v-on:color-change="action"/>',
		methods: { action: action('color-change') }
	  }),
	],
  };


  export const Theme: Story = {
	decorators: [
	  () => ({
		template: '<div style="position: relative; "><div style="position: absolute; background-color: var(--dynamic-bg-color); height: 100%; width: 100%; top: 0px; left: 0px; opacity: .5; z-index: -1; border-radius: 10px"/> <story style="padding: 20px" /></div>'
	  }),
	],
  };



