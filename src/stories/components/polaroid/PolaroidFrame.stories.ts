import type { Meta, StoryObj } from '@storybook/vue3';

import PolaroidFrame from '../../../components/polaroid/PolaroidFrame.vue';
import { InstaxFilmVariant } from '../../../interfaces/PrinterStateConfig';

/**
 * TBD
 */
const meta = {
	title: 'Polaroid/Frame',
	component: PolaroidFrame,

	args: {
		type: InstaxFilmVariant.SQUARE
	},
	argTypes: {
		type: { options: [InstaxFilmVariant.MINI, InstaxFilmVariant.SQUARE, InstaxFilmVariant.LARGE], control: { type: "select" } },
	},

	parameters: {
		slots: {
			"polaroid-text": {
				description: 'Text area of Polaroid themed frame',
				template: ``,
			},

			"polaroid-area": {
				description: 'Image part of Polaroid-themed frame (behind it)',
				template: ``,
			},
		},
	},

	tags: ['autodocs'],
} satisfies Meta<typeof PolaroidFrame>;

export default meta;


type Story = StoryObj<typeof meta>;



export const Empty: Story = {
	args: {
		type: InstaxFilmVariant.SQUARE
	},


};

export const Image: Story = {
	parameters: {
		slots: {

			"polaroid-text": {
				template: `<span class="polaroid-caption">Hallo</span>`,
			},
			"polaroid-area": {
				template: `<img style="width: 100%" src="https://images.unsplash.com/photo-1579158951805-53f80485ed44?q=80&w=2960&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"/>`,
			},
		},
	},
};






