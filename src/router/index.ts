import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/:pathMatch(.*)*',
      redirect: { name: 'instax-creator' }
    },

    {
      path: '/creator',
      name: 'instax-creator',
      component: () =>
        import(/* webpackChunkName: "instax-creator" */ '@/views/InstaxCreatorPage.vue')
    }
  ]
})

export default router
