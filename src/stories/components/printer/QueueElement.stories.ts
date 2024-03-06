import type { Meta, StoryObj } from '@storybook/vue3';

import QueueElement from '../../../components/printer/QueueElement.vue';

/**
 * TBD
 */
const meta = {
	title: 'Printer/Queue',
	component: QueueElement,

	args: {
		element: {
			quantity: 0,
			base64: 'https://github.com/javl/InstaxBLE/blob/main/example-mini.jpg?raw=true',
			state: 0,
			progress: 0,
			abortController: null
		}
	},

	tags: ['autodocs'],
} satisfies Meta<typeof QueueElement>;

export default meta;


type Story = StoryObj<typeof meta>;


export const Primary: Story = {



};






