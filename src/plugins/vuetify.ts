// Styles
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
// import '@/styles/scss/vuetify.scss';
// Vuetify
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { aliases, mdi } from 'vuetify/iconsets/mdi'
import { md3 } from 'vuetify/blueprints'
const myCustomLightTheme = {
  dark: false,
  options: {
    customProperties: true
  },
  colors: {
    background: '#FFFFFF',
    surface: '#FFFFFF',
    primary: '#303030',
    secondary: 'blue',
    error: '#B00020',
    info: '#2196F3',
    success: '#4CAF50',
    warning: '#FB8C00',

    pink: '#E16FBC',
    red: '#BB2D1B',
    orange: '#EE8740',
    yellow: '#F8DA5F',
    green: '#53857D',
    indigo: '#68C0C0',
    purple: '#665BC0',
    black: '#161616',
    white: '#FEFEFE'
  }
}

import { VBtn } from 'vuetify/components'

export default createVuetify(
  {
    components,
    directives,
    display: {
      mobileBreakpoint: 'sm'
    },

    blueprint: 'md3',
    defaults: {
      VBtn: {
        color: 'primary',
        variant: 'flat',
        rounded: 'pill'
      },
      global: {
        ripple: false
      }
    },
    icons: {
      defaultSet: 'mdi',
      aliases,
      sets: {
        mdi
      }
    },
    theme: {
      themes: {
        myCustomLightTheme,
        light: {
          dark: false,
          colors: {
            primary: '#F9F0F3', // #E53935
            secondary: '#A0A0A0', // #FFCDD2
            grey: '#F5F5F5'
          }
        }
      }
    }
  }
  // https://vuetifyjs.com/en/introduction/why-vuetify/#feature-guides
)
