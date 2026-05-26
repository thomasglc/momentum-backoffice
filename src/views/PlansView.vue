<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlanStore } from '@/stores/plan'

const store = usePlanStore()
const router = useRouter()

onMounted(() => store.loadPlans())

const statusLabel: Record<string, string> = {
  draft: 'Brouillon',
  active: 'Actif',
  archived: 'Archivé',
}

const statusClasses: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  active: 'bg-emerald-100 text-emerald-700',
  archived: 'bg-slate-100 text-slate-400',
}
</script>

<template>
  <div>
    <h1 class="text-xl font-semibold text-slate-900 mb-6">Plans d'entraînement</h1>

    <div v-if="store.isLoading" class="text-slate-400 text-sm">Chargement…</div>
    <div v-else-if="store.error" class="text-red-500 text-sm">{{ store.error }}</div>

    <div v-else class="grid grid-cols-1 gap-3 max-w-2xl">
      <div
        v-for="plan in store.plans"
        :key="plan.id"
        @click="router.push(`/plans/${plan.id}`)"
        class="bg-white border border-slate-200 rounded-xl p-5 cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="font-semibold text-slate-900">{{ plan.title }}</h2>
            <p v-if="plan.description" class="text-sm text-slate-500 mt-0.5">{{ plan.description }}</p>
          </div>
          <span
            class="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full"
            :class="statusClasses[plan.status] ?? 'bg-slate-100 text-slate-600'"
          >
            {{ statusLabel[plan.status] ?? plan.status }}
          </span>
        </div>
        <div class="flex gap-4 mt-3 text-xs text-slate-400">
          <span>{{ plan.sport }}</span>
          <span>Niveau {{ plan.level }}</span>
          <span v-if="plan.start_date">Début {{ new Date(plan.start_date).toLocaleDateString('fr-FR') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
