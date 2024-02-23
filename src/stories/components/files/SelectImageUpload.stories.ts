import type { Meta, StoryObj } from '@storybook/vue3';
import { action } from '@storybook/addon-actions'
import { userEvent, within } from '@storybook/testing-library';

import SelectImageUpload from '../../../components/files/SelectImageUpload.vue';

/**
 * TBD
 */
const meta = {
  title: 'Files/Select image',
  component: SelectImageUpload,

  tags: ['autodocs'],
} satisfies Meta<typeof SelectImageUpload>;

export default meta;


type Story = StoryObj<typeof meta>;



 export const Upload: Story = {
	decorators: [
	  () => ({
		template: '<div style="width: 300px; height: 300px; position: relative; border-radius: 10px; overflow: hidden"><story v-on:selected="action"/></div>',
		methods: { action: action('selected') }
	  }),
	],

	play: async ({ canvasElement }) => {

		const canvas = within(canvasElement);

		const area = canvas.getByTestId('upload-area')

		await userEvent.hover(area)

		await userEvent.click(area)

	  },
  };


  export const Submit: Story = {
	decorators: [
	  () => ({
		template: '<div style="width: 300px; height: 300px; position: relative; background-color: red; border-radius: 10px; overflow: hidden"><story v-on:selected="action"/></div>',
		methods: { action: action('selected') }
	  }),
	],

	play: async ({ canvasElement }) => {

		const canvas = within(canvasElement);

		const file = new File(['(⌐□_□)'], 'test.png', { type: 'image/png' });

		const inputElement = canvas.getByTestId('input-file')
		userEvent.upload(inputElement, file)

	  },
  };

