import type { Meta, StoryObj } from '@storybook/vue3';
import { action } from '@storybook/addon-actions'

import DropImageUpload from '../../../components/files/DropImageUpload.vue';

/**
 * This component provides the drag-and-drop functionality for uploading image files. 
 * This interactive component provides visual feedback when a user drags files over it, 
 * supporting a user-friendly file upload experience. The component emits an event with 
 * the dropped file when a user drops an image file onto it, allowing for further 
 * handling of the uploaded file.
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
			template: '<div style="width: 300px; height: 400px; position: relative;  border-radius: 10px; overflow: hidden"><story v-on:dropped="action"/></div>',
			methods: { action: action('dropped') }
		}),
	],


};



