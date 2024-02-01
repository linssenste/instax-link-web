import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach } from 'vitest'


// component
import ProjectLinks from '../../../components/layout/ProjectLinks.vue'

describe('Project info links', () => {
  let wrapper 

  beforeEach(() => {
    wrapper = mount(ProjectLinks);
  })


  it('renders component itself', () => {
    expect(wrapper.exists()).toBe(true);
  })




  it('renders Github link with correct href attribute', () => {
	const githubLink = wrapper.find('[data-testid="github-link"]');
	expect(githubLink.exists()).toBe(true);
	expect(githubLink.attributes('href')).toBe('https://github.com/linssenste/instax-link-web');
  });

  it('Github link opens in a new tab', () => {
	const githubLink = wrapper.find('[data-testid="github-link"]');
	expect(githubLink.exists()).toBe(true);
	expect(githubLink.attributes('target')).toBe('_blank');
  });
  
})
