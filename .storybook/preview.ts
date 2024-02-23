import type { Preview } from '@storybook/vue3'

import "../src/assets/fonts/biro/stylesheet.css";
import "../src/assets/fonts/keedy/stylesheet.css"
import "../src/assets/fonts/rubik/stylesheet.css"
import '../src/style.css';


const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    }
  }
}

export default preview
