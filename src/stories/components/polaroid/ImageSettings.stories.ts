import type { Meta, StoryObj } from '@storybook/vue3';

import ImageSettings from '../../../components/polaroid/ImageSettings.vue';
import { InstaxFilmVariant } from '../../../interfaces/PrinterStateConfig';

/**
 * TBD
 */
const meta = {
	title: 'Polaroid/Settings',
	component: ImageSettings,

	args: {
		config: {
			type: InstaxFilmVariant.SQUARE,
			connection: false,
			connect: null,
			disconnect: null,
			status: null
		},
		queueLength: 0,
	},


	tags: ['autodocs'],
} satisfies Meta<typeof ImageSettings>;

export default meta;


type Story = StoryObj<typeof meta>;



export const Primary: Story = {


};







