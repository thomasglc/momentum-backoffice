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
    { path: '/', redirect: '/suivi' },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/suivi',
      name: 'tracking',
      component: () => import('@/views/TrackingView.vue'),
    },
    {
      path: '/plans',
      name: 'plans',
      component: () => import('@/views/PlansView.vue'),
    },
    {
      path: '/athletes',
      name: 'athletes',
      component: () => import('@/views/AthletesView.vue'),
    },
    {
      // profileId et non id : la barre latérale réserve « id » aux pages d'un plan
      path: '/athletes/:profileId',
      name: 'athlete',
      component: () => import('@/views/AthleteDetailView.vue'),
    },
    {
      path: '/catalogue',
      name: 'catalog',
      component: () => import('@/views/CatalogView.vue'),
    },
    {
      path: '/plans/:id',
      name: 'plan',
      component: () => import('@/views/PlanView.vue'),
    },
    {
      path: '/plans/:id/overview',
      name: 'plan-overview',
      component: () => import('@/views/PlanOverviewView.vue'),
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
