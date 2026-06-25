<script setup lang="ts">
import type { WaitingListEntry } from '@/types'

defineProps<{ entries: WaitingListEntry[] }>()
const emit = defineEmits<{ delete: [entry: WaitingListEntry] }>()

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
</script>

<template>
  <table class="w-full text-sm">
    <thead>
      <tr class="border-b border-slate-200">
        <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
        <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Date d'inscription</th>
        <th class="px-4 py-3" />
      </tr>
    </thead>
    <tbody class="divide-y divide-slate-100">
      <tr v-if="entries.length === 0">
        <td colspan="3" class="px-4 py-8 text-center text-sm text-slate-400">
          Aucune personne en file d'attente
        </td>
      </tr>
      <tr
        v-for="entry in entries"
        :key="entry.id"
        class="hover:bg-slate-50 transition-colors"
      >
        <td class="px-4 py-3 text-slate-900">{{ entry.email }}</td>
        <td class="px-4 py-3 text-slate-500">{{ formatDate(entry.date_created) }}</td>
        <td class="px-4 py-3 text-right">
          <button
            @click="emit('delete', entry)"
            class="text-xs text-red-500 hover:text-red-700 hover:underline transition-colors"
          >
            Supprimer
          </button>
        </td>
      </tr>
    </tbody>
  </table>
</template>
