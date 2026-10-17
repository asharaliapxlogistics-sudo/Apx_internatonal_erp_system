// Management reports (admins only). The backend works out every figure.
import { api } from './api'

export function getReport(kind, { from, to, customerId } = {}) {
  const qs = new URLSearchParams(Object.entries({ from, to, customerId }).filter(([, v]) => v)).toString()
  return api(`/reports/${kind}${qs ? `?${qs}` : ''}`)
}

// Saves rows as a CSV file (opens in Excel). columns: [{ key, label }], or a function for key.
export function downloadCsv(filename, columns, rows) {
  const cell = (v) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [
    columns.map((c) => cell(c.label)).join(','),
    ...rows.map((r) => columns.map((c) => cell(typeof c.key === 'function' ? c.key(r) : r[c.key])).join(',')),
  ]
  // The BOM makes Excel read the file as UTF-8.
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
