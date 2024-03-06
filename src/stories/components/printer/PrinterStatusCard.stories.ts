import type { Meta, StoryObj } from '@storybook/vue3';

import PrinterStatusCard from '../../../components/printer/PrinterStatusCard.vue';
import { InstaxFilmVariant } from '../../../interfaces/PrinterStateConfig';

/**
 * TBD
 */
const meta = {
	title: 'Printer/PrinterStatusCard',
	component: PrinterStatusCard,

	args: {
		config: {
			type: InstaxFilmVariant.SQUARE,

			connection: true,
			connect: null,
			disconnect: null,

			status: {
				type: InstaxFilmVariant.SQUARE,
				polaroidCount: 8,
				battery: {
					level: 75,
					charging: false
				}
			}
		}
	},

	tags: ['autodocs'],
} satisfies Meta<typeof PrinterStatusCard>;

export default meta;


type Story = StoryObj<typeof meta>;


export const Primary: Story = {



};






