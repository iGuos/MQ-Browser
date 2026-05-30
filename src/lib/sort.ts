import { useCallback, useMemo, useState } from 'react'

export type SortDir = 'asc' | 'desc'

export interface SortState<K extends string> {
  key: K | null
  dir: SortDir
}

/** Three-state click cycle: none → asc → desc → none. */
export function nextSort<K extends string>(prev: SortState<K>, key: K): SortState<K> {
  if (prev.key !== key) return { key, dir: 'asc' }
  if (prev.dir === 'asc') return { key, dir: 'desc' }
  return { key: null, dir: 'asc' }
}

/**
 * Generic, type-aware comparator.
 * Nulls / undefined sort last regardless of direction.
 */
export function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1

  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return a === b ? 0 : a ? -1 : 1
  }
  // Fallback to string comparison with locale-aware ordering for non-ASCII
  // (queue names with Chinese characters etc. sort naturally).
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

interface UseSortableOpts<T, K extends string> {
  /** Provide custom value extraction when the key isn't a direct field. */
  getValue?: (row: T, key: K) => unknown
  initial?: SortState<K>
}

export function useSortable<T, K extends string>(rows: T[], opts: UseSortableOpts<T, K> = {}) {
  const { getValue, initial } = opts
  const [sort, setSort] = useState<SortState<K>>(initial ?? { key: null, dir: 'asc' })

  const sorted = useMemo(() => {
    if (sort.key === null) return rows
    const copy = [...rows]
    copy.sort((a, b) => {
      const va = getValue ? getValue(a, sort.key as K) : (a as Record<string, unknown>)[sort.key as string]
      const vb = getValue ? getValue(b, sort.key as K) : (b as Record<string, unknown>)[sort.key as string]
      const cmp = compareValues(va, vb)
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [rows, sort, getValue])

  const toggle = useCallback(
    (key: K) => setSort((s) => nextSort(s, key)),
    [],
  )

  return { sorted, sort, toggle }
}
