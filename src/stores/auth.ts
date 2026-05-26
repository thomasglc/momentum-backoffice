import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDirectus } from '@/composables/useDirectus'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('auth_token'))
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => !!token.value)

  const directus = useDirectus()

  async function login(email: string, password: string) {
    isLoading.value = true
    error.value = null
    try {
      await directus.login(email, password)
      const t = await directus.getToken()
      token.value = t
      if (t) localStorage.setItem('auth_token', t)
    } catch (err) {
      error.value = 'Identifiants incorrects'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function logout() {
    try {
      await directus.logout()
    } finally {
      token.value = null
      localStorage.removeItem('auth_token')
    }
  }

  return { token, isLoading, error, isAuthenticated, login, logout }
})
