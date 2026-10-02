<script setup lang="ts">
import { computed } from 'vue'
import { noteChips } from '@/utils/catalog'

// Note d'une ligne d'exercice ou de station, en pastilles comme dans l'application
const props = defineProps<{
  note: string | null | undefined
  /** Texte déjà affiché à côté (le nom de la ligne) : une pastille identique ne le répète pas */
  except?: string | null
}>()

const chips = computed(() => {
  const shown = props.except?.trim().toLowerCase()
  return noteChips(props.note).filter(chip => chip.toLowerCase() !== shown)
})
</script>

<template>
  <span v-if="chips.length" class="inline-flex flex-wrap gap-1">
    <span
      v-for="(chip, index) in chips"
      :key="index"
      class="px-1.5 py-0.5 rounded bg-slate-100 text-xs font-normal leading-4 text-slate-600"
    >{{ chip }}</span>
  </span>
</template>
