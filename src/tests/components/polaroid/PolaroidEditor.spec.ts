import { mount } from '@vue/test-utils'
import { describe, it, vi, expect, beforeEach } from 'vitest'
import { createVuetify } from 'vuetify'
import { nextTick } from 'vue'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

import PolaroidEditor from '@/components/polaroid/PolaroidEditor.vue'

describe('PolaroidEditor', () => {
  let wrapper: any

  beforeEach(() => {
    const vuetify = createVuetify({ components, directives })

    wrapper = mount(PolaroidEditor, {
      props: {
        config: {
          width: 800,
          height: 800
        },
        color: 'white',
        printerStatus: 1,
        save: false
      },
      global: {
        plugins: [vuetify]
      }
    })
  })

  // ...

  it('does not render the color selector component initially', () => {
    expect(wrapper.find('[data-testid="color-selector"]').exists()).toBe(false)
  })

  it('renders the color selector component when an image is loaded', async () => {
    wrapper.vm.image = 'data:image/png;base64,iVBORw0KGg...'
    await nextTick()
    expect(wrapper.find('[data-testid="color-selector"]').exists()).toBe(true)
  })
})
