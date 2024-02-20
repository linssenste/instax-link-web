import type { Meta, StoryObj } from '@storybook/vue3';
import { action } from '@storybook/addon-actions'
import { userEvent, within } from '@storybook/testing-library';

import PolaroidSizeSelector from '../../../components/layout/PolaroidSizeSelector.vue';

/**
 * Selector component to choose between three different types (or sizes) of Polaroid: Mini (600x800), Square (800x800) or Wide (1260x840). The color of the selected type is bound to the CSS variable ``--dynamic-bg-color`` to match the variable style of the application.
 */
const meta = {
  title: 'Layout/Type selector',
  component: PolaroidSizeSelector,

  tags: ['autodocs'],
} satisfies Meta<typeof PolaroidSizeSelector>;

export default meta;


type Story = StoryObj<typeof meta>;



 export const Event: Story = {
	decorators: [
	  () => ({
		template: '<story v-on:type-change="action"/>',
		methods: { action: action('type-change') }
	  }),
	],

	play: async ({ canvasElement }) => {

		const canvas = within(canvasElement);
	
		const sizeSelectorMini = canvas.getByTestId('polaroid-selector-mini');
		const sizeSelectorSquare = canvas.getByTestId('polaroid-selector-square');
		const sizeSelectorWide = canvas.getByTestId('polaroid-selector-large');


		// select mini
		await userEvent.click(sizeSelectorMini);
		await userEvent.click(sizeSelectorSquare);
		await userEvent.click(sizeSelectorWide);


	  },
  };


