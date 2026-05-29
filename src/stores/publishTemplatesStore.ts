import { create } from 'zustand'
import type { PublishTemplate } from '@shared/types'
import { api } from '@/lib/tauri'

interface State {
  templates: PublishTemplate[]
  ready: boolean
  hydrate: () => Promise<void>
  save: (tpl: PublishTemplate) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const usePublishTemplatesStore = create<State>((set, get) => ({
  templates: [],
  ready: false,

  hydrate: async () => {
    try {
      const list = await api.listPublishTemplates()
      set({ templates: list ?? [], ready: true })
    } catch (e) {
      console.error('[publishTemplatesStore] hydrate failed', e)
      set({ templates: [], ready: true })
    }
  },

  save: async (tpl) => {
    const existing = get().templates
    const idx = existing.findIndex((x) => x.id === tpl.id)
    const next = idx >= 0 ? existing.map((x, i) => (i === idx ? tpl : x)) : [tpl, ...existing]
    await api.savePublishTemplates(next)
    set({ templates: next })
  },

  remove: async (id) => {
    const next = get().templates.filter((x) => x.id !== id)
    await api.savePublishTemplates(next)
    set({ templates: next })
  },
}))
