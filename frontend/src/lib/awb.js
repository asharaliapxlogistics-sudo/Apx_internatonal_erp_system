// Air Waybills, stored by the backend. AWB numbers are issued by the server.
import { api, download } from './api'

// Suggestions on the AWB forms (office and customer portal).
export const COUNTRIES = [
  'Pakistan', 'United Kingdom', 'United States', 'United Arab Emirates', 'Saudi Arabia', 'Canada', 'Australia',
  'Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Turkey', 'Qatar', 'Oman', 'Bahrain', 'Kuwait', 'China',
  'Malaysia', 'Japan',
]
// APX service list (SERVICES.pdf, Oct 2026).
export const SERVICES = [
  'VIA UK UPS (SAVER)',
  'VIA UK DHL',
  'DHL KARACHI',
  'SINGAPORE FEDEX',
  'DIRECT AUSTRALIA',
  'DIRECT DUBAI',
  'VIA DUBAI FEDEX',
  'VIA DUBAI DHL',
  'VIA DUBAI UPS',
  'DUBAI ARAMEX',
  'DHL EUROPE VIA BELFAST (DUTY PAID)',
  'LOCAL DUBAI DUTY PAID',
  'DIRECT CANADA DUTY PAID',
  'DIRECT UK DPD',
  'VIA UK UPS (EXPEDITED)',
  'GCC DUTY PAID',
  'UPS EUROPE VIA BELFAST (DUTY PAID)',
  'USA DUTY PAID FEDEX',
  'DPD DUTY PAID GERMANY',
  'USA/CA SAVER VIA AMS',
  'USA UPS DUTY PAID E-COMMERCE',
  'USA DIRECT DUTY PAID UPS',
  'USA DUTY PAID FEDEX S.P ECO',
  'DIRECT USA DUTY PAID UPS ECONOMY',
  'DIRECT USA DUTY PAID FEDEX ECONOMY',
  'SKYNET',
]

// Volumetric weight per piece = L x W x H (cm) / 5000, rounded up to the next whole KG.
// Matches the existing APX AWBs (85x55x52 + 55x55x68 => 49 + 42 = 91 KG).
export const VOLUMETRIC_DIVISOR = 5000

export function pieceVolumetric({ length, width, height }) {
  const l = Number(length) || 0
  const w = Number(width) || 0
  const h = Number(height) || 0
  if (!l || !w || !h) return 0
  return Math.ceil((l * w * h) / VOLUMETRIC_DIVISOR)
}

export function calcWeights(pieces, actualWeight) {
  const volumetric = pieces.reduce((sum, p) => sum + pieceVolumetric(p), 0)
  const actual = Number(actualWeight) || 0
  return { actual, volumetric, chargeable: Math.max(actual, volumetric) }
}

export function formatDimensions(pieces) {
  return pieces
    .filter((p) => p.length && p.width && p.height)
    .map((p) => `${p.length} * ${p.width} * ${p.height}`)
    .join(', ')
}

export const kg = (n) => `${Number(n || 0).toFixed(3)} KG`

// Customs invoice printed with the AWB. Keep INVOICE_TYPES in step with backend/app/schemas/awb.py.
export const INVOICE_TYPES = ['Gift', 'Commercial']
export const UNITS = ['Piece(s)', 'Pair(s)', 'Set(s)', 'Dozen', 'KG']
export const emptyItem = { description: '', hsCode: '', unit: 'Piece(s)', quantity: '', unitPrice: '' }

export const itemTotal = (i) => (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0)
export const itemsTotal = (items) => items.reduce((sum, i) => sum + itemTotal(i), 0)

// Rows left completely empty are dropped; anything typed is sent and checked by the server.
const filledItems = (items) =>
  items
    .filter((i) => i.description.trim() || i.hsCode.trim() || i.quantity !== '' || i.unitPrice !== '')
    .map((i) => ({ ...i, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) }))

// Problems in the item rows, keyed `item.<n>`, for the forms.
export function itemErrors(items) {
  const errors = {}
  items.forEach((i, n) => {
    const touched = i.description.trim() || i.hsCode.trim() || i.quantity !== '' || i.unitPrice !== ''
    if (!touched) return
    if (!i.description.trim()) errors[`item.${n}`] = `Item ${n + 1}: enter the description.`
    else if (!(Number(i.quantity) > 0)) errors[`item.${n}`] = `Item ${n + 1}: quantity must be more than 0.`
    else if (i.unitPrice === '' || !(Number(i.unitPrice) >= 0)) errors[`item.${n}`] = `Item ${n + 1}: enter the unit price (USD).`
  })
  return errors
}

// Empty form inputs become null; numbers typed as text become numbers.
const numOrNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v))

export function listAwbs({ customerId } = {}) {
  return api(`/awbs${customerId ? `?customerId=${encodeURIComponent(customerId)}` : ''}`)
}

export const getAwb = (number) => api(`/awbs/${encodeURIComponent(number)}`)

const awbBody = (data) => ({
  ...data,
  customerId: data.customerId || null,
  actualWeight: Number(data.actualWeight),
  declaredValue: numOrNull(data.declaredValue),
  pieces: data.pieces.map((p) => ({ length: numOrNull(p.length), width: numOrNull(p.width), height: numOrNull(p.height) })),
  items: filledItems(data.items ?? []),
})

export const createAwb = (data) => api('/awbs', { method: 'POST', body: awbBody(data) })

// Edit a saved AWB; its number, date and tracking history stay.
export const updateAwb = (number, data) =>
  api(`/awbs/${encodeURIComponent(number)}`, { method: 'PUT', body: awbBody(data) })

// Replaces the customs invoice type and items; with items, the declared value becomes their total.
export const setCustoms = (number, { invoiceType, items }) =>
  api(`/awbs/${encodeURIComponent(number)}/customs`, { method: 'PUT', body: { invoiceType, items: filledItems(items) } })

export const voidAwb = (number, reason) => api(`/awbs/${encodeURIComponent(number)}/void`, { method: 'POST', body: { reason } })

// Undo a void; the AWB becomes Active again.
export const restoreAwb = (number) => api(`/awbs/${encodeURIComponent(number)}/restore`, { method: 'POST' })

// Its tracking history is removed with it.
export const deleteAwb = (number) => api(`/awbs/${encodeURIComponent(number)}`, { method: 'DELETE' })

// Excel import: read the sheet first (nothing saved), then save the checked rows as AWBs.
export function previewImport(file) {
  const form = new FormData()
  form.append('file', file)
  return api('/awb-import/preview', { method: 'POST', body: form })
}
export const commitImport = (fileName, rows) => api('/awb-import/commit', { method: 'POST', body: { fileName, rows } })

// Imported sheets start from July 2026; keep in step with FIRST_DAY in backend/app/routers/awb_import.py.
export const IMPORT_FIRST_DAY = '2026-07-01'

function importParams({ q = '', from, to, customerId } = {}) {
  const params = new URLSearchParams()
  if (q.trim()) params.set('q', q.trim())
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  if (customerId) params.set('customerId', customerId)
  return params
}

export const listImported = (filters) => api(`/awb-import/awbs?${importParams(filters)}`)

// Deletes an imported sheet's AWBs (and their tracking history). AWBs made on the form are never deleted.
export const deleteImported = (numbers) => api('/awb-import/delete', { method: 'POST', body: { numbers } })

// Same filters as the list; one Excel tab per imported sheet.
export const exportImported = (filters, fileName) => download(`/awb-import/export?${importParams(filters)}`, fileName)

// `page` = tracking page address from Settings; falls back to VITE_TRACKING_URL, then this site's /track.
export function trackingUrl(number, page) {
  const base = page || import.meta.env.VITE_TRACKING_URL || `${window.location.origin}/track`
  return `${base}?no=${encodeURIComponent(number)}`
}
