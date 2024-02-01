import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach } from 'vitest'

import SelectImageUpload from '../../../components/upload/SelectImageUpload.vue'

describe('Drag & Drop area', () => {
  let wrapper 

const defaultConfig = {
	theme: 'red',
	width: 800,
	height: 800,

	connection: false, 
	connect: null,
	disconnect: null,
}
  beforeEach(() => {
    wrapper = mount(SelectImageUpload, {props: {
		config: defaultConfig
	}});
  })


  it('renders component itself', () => {
    expect(wrapper.exists()).toBe(true);
  })


})
