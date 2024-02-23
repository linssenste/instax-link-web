import type { Meta, StoryObj } from '@storybook/vue3';
import { action } from '@storybook/addon-actions'

import DropImageUpload from '../../../components/files/DropImageUpload.vue';

/**
 * TBD
 */
const meta = {
  title: 'Files/Drag & Drop',
  component: DropImageUpload,

  tags: ['autodocs'],
} satisfies Meta<typeof DropImageUpload>;

export default meta;


type Story = StoryObj<typeof meta>;



 export const Upload: Story = {
	decorators: [
	  () => ({
		template: '<div style="width: 300px; height: 300px; position: relative;  border-radius: 10px; overflow: hidden"><story v-on:dropped="action"/></div>',
		methods: { action: action('dropped') }
	  }),
	],


  };



