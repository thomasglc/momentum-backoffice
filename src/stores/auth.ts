import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useDirectus, AUTH_STORAGE_KEY } from '@/composables/useDirectus'

export const useAuthStore = defineStore('auth', () => {
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const isAuthenticated = ref(localStorage.getItem(AUTH_STORAGE_KEY) !== null)

  const directus = useDirectus()

  async function login(email: string, password: string) {
    isLoading.value = true
    error.value = null
    try {
      await directus.login(email, password)
      isAuthenticated.value = true
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
      isAuthenticated.value = false
    }
  }

  return { isLoading, error, isAuthenticated, login, logout }
})
