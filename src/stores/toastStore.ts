import { create } from 'zustand'

export type ToastKind = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  kind: ToastKind
  title?: string
  message: string
  /** Milliseconds before auto-dismiss. 0 = sticky until dismissed. */
  durationMs: number
}

interface State {
  toasts: Toast[]
  push: (toast: Omit<Toast, 'id'> & { id?: string }) => string
  dismiss: (id: string) => void
  clear: () => void
}

export const useToastStore = create<State>((set, get) => ({
  toasts: [],
  push: (toast) => {
    const id = toast.id ?? crypto.randomUUID()
    const next: Toast = {
      id,
      kind: toast.kind,
      title: toast.title,
      message: toast.message,
      durationMs: toast.durationMs ?? 4_000,
    }
    set((s) => ({ toasts: [...s.toasts, next] }))
    if (next.durationMs > 0) {
      setTimeout(() => get().dismiss(id), next.durationMs)
    }
    return id
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  clear: () => set({ toasts: [] }),
}))

// Convenience helpers ---------------------------------------------------------

export const toast = {
  success: (message: string, title?: string) =>
    useToastStore.getState().push({ kind: 'success', message, title, durationMs: 3500 }),
  error: (message: string, title?: string) =>
    useToastStore.getState().push({ kind: 'error', message, title, durationMs: 0 }),
  info: (message: string, title?: string) =>
    useToastStore.getState().push({ kind: 'info', message, title, durationMs: 3500 }),
  warning: (message: string, title?: string) =>
    useToastStore.getState().push({ kind: 'warning', message, title, durationMs: 5000 }),
}
