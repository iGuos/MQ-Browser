import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface State {
  density: 'comfortable' | 'compact'
  sidebarWidth: number
  setDensity: (d: 'comfortable' | 'compact') => void
  setSidebarWidth: (w: number) => void
}

const MIN_SIDEBAR_PX = 220
const MAX_SIDEBAR_PX = 480
const DEFAULT_SIDEBAR_PX = 296 // ~ w-[18.5rem]

export const useUiPrefsStore = create<State>()(
  persist(
    (set) => ({
      density: 'comfortable',
      sidebarWidth: DEFAULT_SIDEBAR_PX,
      setDensity: (d) => set({ density: d }),
      setSidebarWidth: (w) =>
        set({ sidebarWidth: Math.max(MIN_SIDEBAR_PX, Math.min(MAX_SIDEBAR_PX, w)) }),
    }),
    {
      name: 'mq-browser/ui-prefs/v1',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
