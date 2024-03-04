import type { Meta, StoryObj } from '@storybook/vue3';

import StatusAlerts from '../../../components/printer/StatusAlerts.vue';
import { InstaxFilmVariant } from '../../../interfaces/PrinterStateConfig';

/**
 * TBD
 */
const meta = {
	title: 'Printer/Alerts',
	component: StatusAlerts,

	args: {
		status: {

			type: InstaxFilmVariant.SQUARE,

			battery: {
				charging: false,
				level: 0
			},
			polaroidCount: 0
		}
	},



	tags: ['autodocs'],
} satisfies Meta<typeof StatusAlerts>;

export default meta;


type Story = StoryObj<typeof meta>;


export const Primary: Story = {


	args: {
		status: {

			type: InstaxFilmVariant.SQUARE,

			battery: {
				charging: false,
				level: 0
			},
			polaroidCount: 0
		}
	},
};

export const Polaroids: Story = {


	args: {
		status: {

			type: InstaxFilmVariant.SQUARE,

			battery: {
				charging: false,
				level: 50
			},
			polaroidCount: 0
		}
	},
};


export const Battery: Story = {


	args: {
		status: {

			type: InstaxFilmVariant.SQUARE,

			battery: {
				charging: false,
				level: 0
			},
			polaroidCount: 5
		}
	},
};






