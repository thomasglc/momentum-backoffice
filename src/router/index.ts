import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/plans' },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/plans',
      name: 'plans',
      component: () => import('@/views/PlansView.vue'),
    },
    {
      path: '/plans/:id',
      name: 'plan',
      component: () => import('@/views/PlanView.vue'),
    },
    {
      path: '/plans/:id/weeks/:weekId',
      name: 'week',
      component: () => import('@/views/WeekView.vue'),
    },
    {
      path: '/plans/:id/sessions/:sessionId',
      name: 'session',
      component: () => import('@/views/SessionView.vue'),
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.isAuthenticated) {
    return { name: 'login' }
  }
})

export default router
