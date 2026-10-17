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

export const CARRIERS = ['DPD', 'DHL', 'FedEx', 'UPS', 'Royal Mail', 'Aramex', 'Skynet', 'USPS', 'TCS']

// The delivery partner a shipment's service goes with (e.g. "DIRECT UK DPD" → DPD), until staff pick one.
// Services that name no partner (e.g. "DIRECT DUBAI") give ''.
export function carrierFor(shipment) {
  if (shipment.carrier) return shipment.carrier
  // Whole words only, padded with spaces: "VIA UK UPS (SAVER)" → " via uk ups saver ".
  const words = ` ${(shipment.awb.service || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `
  return CARRIERS.find((c) => words.includes(` ${c.toLowerCase()} `)) ?? ''
}

// The carrier's own tracking page for a number, where we know it, as { name, url }.
// DPD has one site per country, picked from the service ("DPD DUTY PAID GERMANY" → DPD Germany, otherwise DPD UK).
const CARRIER_SITES = {
  dpd: ['DPD UK', (n) => `https://track.dpd.co.uk/search?reference=${n}`],
  'dpd germany': ['DPD Germany', (n) => `https://tracking.dpd.de/status/en_US/parcel/${n}`],
  skynet: ['Skynet', (n) => `https://www.snwwe.com/pk-en/track-shipment?AWB=${n}`],
  usps: ['USPS', (n) => `https://tools.usps.com/tracking/${n}`],
  dhl: ['DHL', (n) => `https://www.dhl.com/gb-en/home/tracking.html?submit=1&tracking-id=${n}`],
  fedex: ['FedEx', (n) => `https://www.fedex.com/fedextrack/?trknbr=${n}`],
  ups: ['UPS', (n) => `https://www.ups.com/track?loc=en_GB&tracknum=${n}`],
  'royal mail': ['Royal Mail', (n) => `https://www.royalmail.com/track-your-item#/tracking-results/${n}`],
  aramex: ['Aramex', (n) => `https://www.aramex.com/track/results?ShipmentNumber=${n}`],
}
export function carrierLink(carrier, number, service = '') {
  let key = (carrier || '').trim().toLowerCase()
  if (key === 'dpd' && /\bgermany\b/i.test(service || '')) key = 'dpd germany'
  const site = CARRIER_SITES[key]
  return site && number ? { name: site[0], url: site[1](encodeURIComponent(number.trim())) } : null
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
