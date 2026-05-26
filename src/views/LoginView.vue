<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const password = ref('')

async function handleSubmit() {
  await auth.login(email.value, password.value)
  router.push('/plans')
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex items-center justify-center">
    <div class="bg-white border border-slate-200 shadow-sm rounded-xl p-8 w-full max-w-sm">
      <div class="mb-8">
        <h1 class="text-2xl font-semibold text-slate-900">Momentum</h1>
        <p class="text-sm text-slate-500 mt-1">Back office coach Hyrox</p>
      </div>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input
            v-model="email"
            type="email"
            required
            class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="coach@example.com"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Mot de passe</label>
          <input
            v-model="password"
            type="password"
            required
            class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <p v-if="auth.error" class="text-sm text-red-500">{{ auth.error }}</p>

        <button
          type="submit"
          :disabled="auth.isLoading"
          class="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
        >
          {{ auth.isLoading ? 'Connexion…' : 'Se connecter' }}
        </button>
      </form>
    </div>
  </div>
</template>
