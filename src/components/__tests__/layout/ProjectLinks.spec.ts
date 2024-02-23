import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach } from 'vitest'

import ProjectLinks from '../../../components/layout/ProjectLinks.vue'

describe('Project related links', () => {
  let wrapper 

  beforeEach(() => {
    wrapper = mount(ProjectLinks);
  })


  it('renders links itself', () => {
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
  


  it('renders Buy-me-a-coffee (BMC) link with correct href attribute', () => {
	const githubLink = wrapper.find('[data-testid="bmc-link"]');
	expect(githubLink.exists()).toBe(true);
	expect(githubLink.attributes('href')).toBe('https://www.buymeacoffee.com/linssenste');
  });


  it('BMC link opens in a new tab', () => {
	const githubLink = wrapper.find('[data-testid="bmc-link"]');
	expect(githubLink.exists()).toBe(true);
	expect(githubLink.attributes('target')).toBe('_blank');
  });

  


})
