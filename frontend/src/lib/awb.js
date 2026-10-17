// Air Waybills, stored by the backend. AWB numbers are issued by the server.
import { api } from './api'

// Suggestions on the AWB forms (office and customer portal).
export const COUNTRIES = [
  'Pakistan', 'United Kingdom', 'United States', 'United Arab Emirates', 'Saudi Arabia', 'Canada', 'Australia',
  'Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Turkey', 'Qatar', 'Oman', 'Bahrain', 'Kuwait', 'China',
  'Malaysia', 'Japan',
]
export const SERVICES = ['Direct UK DPD', 'DHL Express', 'FedEx Priority', 'UPS Express', 'Economy']

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
export const INVOICE_TYPES = ['Gift', 'Commercial', 'Sample', 'Personal effects']
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

export function createAwb(data) {
  return api('/awbs', {
    method: 'POST',
    body: {
      ...data,
      customerId: data.customerId || null,
      actualWeight: Number(data.actualWeight),
      declaredValue: numOrNull(data.declaredValue),
      pieces: data.pieces.map((p) => ({ length: numOrNull(p.length), width: numOrNull(p.width), height: numOrNull(p.height) })),
      items: filledItems(data.items ?? []),
    },
  })
}

// Replaces the customs invoice type and items; with items, the declared value becomes their total.
export const setCustoms = (number, { invoiceType, items }) =>
  api(`/awbs/${encodeURIComponent(number)}/customs`, { method: 'PUT', body: { invoiceType, items: filledItems(items) } })

export const voidAwb = (number, reason) => api(`/awbs/${encodeURIComponent(number)}/void`, { method: 'POST', body: { reason } })

// Undo a void; the AWB becomes Active again.
export const restoreAwb = (number) => api(`/awbs/${encodeURIComponent(number)}/restore`, { method: 'POST' })

// Its tracking history is removed with it.
export const deleteAwb = (number) => api(`/awbs/${encodeURIComponent(number)}`, { method: 'DELETE' })

// `page` = tracking page address from Settings; falls back to VITE_TRACKING_URL, then this site's /track.
export function trackingUrl(number, page) {
  const base = page || import.meta.env.VITE_TRACKING_URL || `${window.location.origin}/track`
  return `${base}?no=${encodeURIComponent(number)}`
}
