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
 * TBW
 */
 export const Default: Story = {
	decorators: [
	  () => ({
		template: '<story v-on:type-change="action"/>',
		methods: { action: action('type-change') }
	  }),
	],

  };


