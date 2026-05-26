<script setup lang="ts">
import { ref } from 'vue'

const toasts = ref<{ id: number; message: string; type: 'success' | 'error' }[]>([])
let counter = 0

function show(message: string, type: 'success' | 'error' = 'success') {
  const id = ++counter
  toasts.value.push({ id, message, type })
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }, 3000)
}

defineExpose({ show })
</script>

<template>
  <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
    <Transition
      v-for="toast in toasts"
      :key="toast.id"
      enter-from-class="opacity-0 translate-y-2"
      enter-active-class="transition duration-200"
      leave-to-class="opacity-0 translate-y-2"
      leave-active-class="transition duration-200"
    >
      <div
        class="px-4 py-3 rounded-lg shadow-md text-sm font-medium text-white"
        :class="toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'"
      >
        {{ toast.message }}
      </div>
    </Transition>
  </div>
</template>
