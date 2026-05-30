import { save } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { toast } from '@/stores/toastStore'

/** Quote a value for CSV, escaping `"` and wrapping when needed. */
function csvField(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** Serialize an array of records to a CSV string. */
export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: Array<{ key: keyof T; label: string }>,
): string {
  const header = columns.map((c) => csvField(c.label)).join(',')
  const body = rows
    .map((row) => columns.map((c) => csvField(row[c.key])).join(','))
    .join('\n')
  return `${header}\n${body}`
}

/** Prompt the user for a save path and write CSV content. */
export async function exportCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: Array<{ key: keyof T; label: string }>,
  defaultName = 'export.csv',
): Promise<void> {
  if (rows.length === 0) {
    toast.info('Nothing to export')
    return
  }
  try {
    const path = await save({
      defaultPath: defaultName,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    })
    if (!path) return
    const content = toCsv(rows, columns)
    await invoke('write_text_file', { path, contents: content })
    toast.success(`Exported ${rows.length} row(s)`)
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e))
  }
}
