// Shipment tracking: status updates recorded against each Air Waybill, stored by the backend.
// Every non-void AWB is a shipment; its "Booked" event comes from the AWB itself.
import { api } from './api'

// Shipment journey in order. `group` drives the dashboard cards and list filters.
// Keep in step with backend/app/services/tracking.py.
export const STATUSES = [
  { name: 'Booked', group: 'booked', tone: 'bg-slate-100 text-slate-700' },
  { name: 'Picked up', group: 'booked', tone: 'bg-slate-100 text-slate-700' },
  { name: 'At APX hub', group: 'booked', tone: 'bg-brand-50 text-brand-600' },
  { name: 'Departed origin', group: 'transit', tone: 'bg-sky-50 text-sky-700' },
  { name: 'In transit', group: 'transit', tone: 'bg-sky-50 text-sky-700' },
  { name: 'Arrived destination', group: 'transit', tone: 'bg-sky-50 text-sky-700' },
  { name: 'Customs hold', group: 'customs', tone: 'bg-amber-50 text-amber-700' },
  { name: 'Customs cleared', group: 'transit', tone: 'bg-sky-50 text-sky-700' },
  { name: 'Out for delivery', group: 'transit', tone: 'bg-indigo-50 text-indigo-700' },
  { name: 'Delivered', group: 'delivered', tone: 'bg-emerald-50 text-emerald-700' },
  { name: 'Exception', group: 'exception', tone: 'bg-red-50 text-accent-600' },
  { name: 'Returned', group: 'exception', tone: 'bg-red-50 text-accent-600' },
]

export const STATUS_GROUPS = [
  ['booked', 'Booked'],
  ['transit', 'In transit'],
  ['customs', 'Customs hold'],
  ['delivered', 'Delivered'],
  ['exception', 'Exceptions'],
]

const byName = Object.fromEntries(STATUSES.map((s) => [s.name, s]))
export const statusInfo = (name) => byName[name] ?? STATUSES[0]

export const CARRIERS = ['DPD', 'DHL', 'FedEx', 'UPS', 'Royal Mail', 'Aramex', 'TCS']

// The delivery partner a shipment's service goes with (e.g. "DIRECT UK DPD" → DPD), until staff pick one.
// Services that name no partner (e.g. "DIRECT DUBAI") give ''.
export function carrierFor(shipment) {
  if (shipment.carrier) return shipment.carrier
  // Whole words only, padded with spaces: "VIA UK UPS (SAVER)" → " via uk ups saver ".
  const words = ` ${(shipment.awb.service || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `
  return CARRIERS.find((c) => words.includes(` ${c.toLowerCase()} `)) ?? ''
}

// The carrier's own tracking page for a number, where we know it.
const CARRIER_LINKS = {
  dpd: (n) => `https://www.dpd.co.uk/apps/tracking/?reference=${n}`,
  dhl: (n) => `https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id=${n}`,
  fedex: (n) => `https://www.fedex.com/fedextrack/?trknbr=${n}`,
  ups: (n) => `https://www.ups.com/track?tracknum=${n}`,
  'royal mail': (n) => `https://www.royalmail.com/track-your-item#/tracking-results/${n}`,
  aramex: (n) => `https://www.aramex.com/track/results?ShipmentNumber=${n}`,
}
export function carrierLink(carrier, number) {
  const link = CARRIER_LINKS[(carrier || '').trim().toLowerCase()]
  return link && number ? link(encodeURIComponent(number.trim())) : ''
}

// Local date-time as YYYY-MM-DDTHH:mm (the value format of <input type="datetime-local">).
export function localDateTime(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function formatDateTime(local) {
  return new Date(local).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const awbPath = (number) => `/shipments/${encodeURIComponent(number)}`

export function listShipments({ customerId } = {}) {
  return api(`/shipments${customerId ? `?customerId=${encodeURIComponent(customerId)}` : ''}`)
}

export const getShipment = (number) => api(awbPath(number))

// Adds the same status update to one or more AWBs; the server rejects the whole batch if any is unknown or void.
export const addEvent = (numbers, { status, at, location, remarks }) =>
  api('/shipments/events', { method: 'POST', body: { numbers, status, at, location, remarks } })

export const deleteEvent = (number, eventId) => api(`${awbPath(number)}/events/${encodeURIComponent(eventId)}`, { method: 'DELETE' })

export const setCarrierTracking = (number, { carrier, carrierTracking }) =>
  api(`${awbPath(number)}/carrier`, { method: 'PUT', body: { carrier, carrierTracking } })
