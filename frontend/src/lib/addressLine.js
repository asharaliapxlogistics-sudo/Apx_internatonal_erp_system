// Reads an address a customer sent ("Today's addresses") into AWB fields. Customers paste it as they
// have it: one line with commas, an order page copied line by line, or a row from their Excel sheet
// (tabs between cells), often with the order number, weight, product and courier mixed in, e.g.
//   "Hamza Qureshi, Flat 3, 17 Cheetham Hill Road, Manchester M8 8LW, United Kingdom, +44 7700 900311"
//   "11/11/2026<tab>CORINE MACK\n2317 SONOMA VALLEY DR\nCHARLOTTE\nNC\n28214-7710\nUnited States\n
//    +1 314-282-9402 ext. 05180\n3676242<tab>Leather Coat<tab>0.900 USPS"
// It is a best guess: staff check the filled fields before saving the AWB.
import { COUNTRIES } from './awb'

// Other ways customers write a country -> the name used on AWBs.
const COUNTRY_ALIASES = {
  uk: 'United Kingdom', 'u.k.': 'United Kingdom', 'great britain': 'United Kingdom', england: 'United Kingdom',
  scotland: 'United Kingdom', wales: 'United Kingdom', 'northern ireland': 'United Kingdom',
  usa: 'United States', us: 'United States', 'u.s.a.': 'United States', 'u.s.': 'United States', america: 'United States',
  'united states of america': 'United States',
  uae: 'United Arab Emirates', 'u.a.e.': 'United Arab Emirates',
  ksa: 'Saudi Arabia', saudia: 'Saudi Arabia', saudi: 'Saudi Arabia',
  pk: 'Pakistan', holland: 'Netherlands', 'the netherlands': 'Netherlands', turkiye: 'Turkey', 'türkiye': 'Turkey',
  deutschland: 'Germany',
}
// Cities that tell the country when the customer left it out ("..., Dubai, +971 ...").
const CITY_COUNTRY = {
  dubai: 'United Arab Emirates', 'abu dhabi': 'United Arab Emirates', sharjah: 'United Arab Emirates',
  london: 'United Kingdom', manchester: 'United Kingdom', birmingham: 'United Kingdom',
  karachi: 'Pakistan', lahore: 'Pakistan', islamabad: 'Pakistan', riyadh: 'Saudi Arabia', jeddah: 'Saudi Arabia', doha: 'Qatar',
}
const US_STATES = new Set(
  'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC PR'.split(' '),
)
const CA_PROVINCES = new Set('AB BC MB NB NL NS NT NU ON PE QC SK YT'.split(' '))
const isRegion = (s) => US_STATES.has(s.toUpperCase()) || CA_PROVINCES.has(s.toUpperCase())

const US_ZIP = /^\d{5}(?:-\d{4})?$/
const CA_POSTAL = /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/i
const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i
const NUM_ZIP = /^\d{4,6}$/
const POSTAL_SRC = String.raw`\d{5}(?:-\d{4})?|[A-Z]\d[A-Z] ?\d[A-Z]\d|[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}|\d{4,6}`

const CARRIER = String.raw`DHL|FedEx|Fed Ex|USPS|UPS|Aramex|DPD|TNT|Skynet|Royal Mail|Canada Post`
const CARRIERS_ONLY = new RegExp(String.raw`^(?:(?:${CARRIER})\s*[/&,+|-]?\s*)+$`, 'i')
// Note: CARRIER_ANY is global (for matchAll); String.replace with it is fine, .test() would not be.
const CARRIER_ANY = new RegExp(String.raw`\b(${CARRIER})\b`, 'gi')
const WEIGHT = /(\d+(?:\.\d+)?)\s*\/?\s*kgs?\b/i
const WEIGHT_ONLY = /^\d{1,3}\.\d{1,3}$/ // "0.900" in a sheet's weight column
const DATE = /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/
const ORDER = /\border\b[^#\d]*#?\s*([A-Z0-9-]{3,})/i
const REFERENCE = /^#?[A-Z]{0,3}-?\d{4,}$/i // "3676242", "N013947", "#28445"
const LABEL = /^(?:phone|tel|telephone|mobile|cell|contact|email|e-mail|email address|name|address|ship to|deliver to)\s*(?:no\.?|number|#)?\s*:\s*/i
const STREET_END = /\b(?:st|street|rd|road|ave|avenue|dr|drive|ln|lane|blvd|way|ct|court|apt|suite|ste|unit|floor|flat)\.?$/i

const hasDigit = (s) => /\d/.test(s)
const digitsOf = (s) => s.replace(/\D/g, '')
const isCityLike = (s) => !!s && /\p{L}/u.test(s) && !hasDigit(s) && !STREET_END.test(s)

function countryOf(part) {
  const p = part.trim().toLowerCase()
  return COUNTRIES.find((c) => c.toLowerCase() === p) ?? COUNTRY_ALIASES[p] ?? ''
}

// "+1 314-282-9402 ext. 05180" -> { phone: '+1 314-282-9402', ext: '05180' }; null when it is not a phone.
function phoneOf(part) {
  const m = part.match(/^(.*?)(?:\s*(?:ext\.?|extension|x)\s*(\d{1,6}))?$/i)
  const main = m[1].trim()
  const n = digitsOf(main).length
  if (!/^\+?[\d\s\-().]+$/.test(main) || n < 10 || n > 15) return null
  return { phone: main, ext: m[2] ?? '' }
}

// US / Canada numbers written without the country code get +1, like the AWB form asks for.
function withCountryCode(phone, country) {
  if (phone.startsWith('+') || !['United States', 'Canada'].includes(country)) return phone
  const d = digitsOf(phone)
  if (d.length === 10) return /^[\d]+$/.test(phone) ? `+1 ${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : `+1 ${phone}`
  if (d.length === 11 && d.startsWith('1')) return `+${phone}`
  return phone
}

// Where the city / state / postcode are. Returns the best match among the parts:
// { at: [indexes used], city, state, zip, strength } or null.
function findLocation(parts) {
  let best = null
  const take = (cand) => {
    if (!best || cand.strength >= best.strength) best = cand
  }
  const cityStateZip = new RegExp(String.raw`^(.+?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?|[A-Z]\d[A-Z] ?\d[A-Z]\d)$`, 'i')
  const stateZip = /^([A-Z]{2})\s+(\d{5}(?:-\d{4})?|[A-Z]\d[A-Z] ?\d[A-Z]\d)$/i
  const cityZip = new RegExp(String.raw`^(.+?)\s+(${POSTAL_SRC})$`, 'i')
  const zipCity = /^(\d{4,6})\s+(\D+)$/
  parts.forEach((s, i) => {
    const prev = parts[i - 1] ?? ''
    const prev2 = parts[i - 2] ?? ''
    let m
    if ((m = s.match(cityStateZip)) && isRegion(m[2]) && isCityLike(m[1])) {
      take({ at: [i], city: m[1], state: m[2], zip: m[3], strength: 5 })
    } else if ((m = s.match(stateZip)) && isRegion(m[1]) && isCityLike(prev)) {
      // "Benicia" / "CA 94510"
      take({ at: [i - 1, i], city: prev, state: m[1], zip: m[2], strength: 4 })
    } else if ((US_ZIP.test(s) || CA_POSTAL.test(s)) && isRegion(prev) && isCityLike(prev2)) {
      // "CHARLOTTE" / "NC" / "28214-7710"
      take({ at: [i - 2, i - 1, i], city: prev2, state: prev, zip: s, strength: 4 })
    } else if ((CA_POSTAL.test(s) || UK_POSTCODE.test(s)) && isCityLike(prev)) {
      take({ at: [i - 1, i], city: prev, state: '', zip: s, strength: 3 })
    } else if ((m = s.match(cityZip)) && isCityLike(m[1]) && !isRegion(m[1].split(/\s+/).at(-1))) {
      // "Manchester M8 8LW", "Dubai 12345"
      take({ at: [i], city: m[1], state: '', zip: m[2], strength: 3 })
    } else if ((m = s.match(zipCity)) && isCityLike(m[2])) {
      // "10711 Berlin"
      take({ at: [i], city: m[2], state: '', zip: m[1], strength: 2 })
    } else if ((US_ZIP.test(s) || NUM_ZIP.test(s)) && isCityLike(prev)) {
      take({ at: [i - 1, i], city: prev, state: '', zip: s, strength: 1 })
    }
  })
  return best
}

function guessCountry(loc) {
  if (!loc) return ''
  const state = loc.state.toUpperCase()
  if (US_STATES.has(state) && US_ZIP.test(loc.zip)) return 'United States'
  if (CA_POSTAL.test(loc.zip) || (CA_PROVINCES.has(state) && !US_STATES.has(state))) return 'Canada'
  if (UK_POSTCODE.test(loc.zip)) return 'United Kingdom'
  return CITY_COUNTRY[loc.city.toLowerCase()] ?? ''
}

/**
 * Splits what the customer sent into
 *   consignee: { name, address, city, zip, country, phone, email }
 *   shipment:  { reference, weight, product, notes }   (order #, KG, what is inside, courier / phone ext.)
 */
export function parseCustomerAddress(text) {
  const parts = String(text ?? '')
    .replace(/"/g, '')
    .split(/[\n\t,;]/)
    .map((p) => p.trim().replace(LABEL, '').trim())
    .filter((p) => p && !/^[^:]{1,30}:$/.test(p)) // label lines like "Email address:"

  const consignee = { name: '', address: '', city: '', zip: '', country: '', phone: '', email: '' }
  const shipment = { reference: '', weight: '', product: '', notes: '' }
  const carriers = []
  const notes = []
  const free = [] // parts that are not phone / email / order info: name, street, city, product...

  for (const p of parts) {
    const email = p.match(/[^\s@]+@[^\s@]+\.[^\s@]{2,}/)
    const phone = phoneOf(p)
    const weight = p.match(WEIGHT)
    const order = p.match(ORDER)
    for (const c of p.matchAll(CARRIER_ANY)) {
      const name = c[1].toUpperCase() === 'FEDEX' || /^fed ex$/i.test(c[1]) ? 'FedEx' : c[1].toUpperCase()
      if (!carriers.includes(name)) carriers.push(name)
    }
    if (DATE.test(p)) continue
    // "0.900 USPS", "DHL / FedEx": what is left without the courier names.
    const bare = p.replace(CARRIER_ANY, ' ').replace(/[/&,+|]/g, ' ').trim()
    if (email) consignee.email ||= email[0]
    else if (phone) {
      if (!consignee.phone) {
        consignee.phone = phone.phone
        if (phone.ext) notes.push(`Phone ext. ${phone.ext}`)
      }
    } else if (order || weight || /#\s*\d{5,}/.test(p) || CARRIERS_ONLY.test(p) || WEIGHT_ONLY.test(bare)) {
      // Order line, e.g. "Order #266774 (Black Fringe) 1.5 KG DHL / FedEx"
      if (order) shipment.reference ||= order[1]
      if (weight) shipment.weight ||= weight[1]
      else if (WEIGHT_ONLY.test(bare)) shipment.weight ||= bare
    } else if (countryOf(p)) consignee.country = countryOf(p)
    else free.push(p)
  }

  const loc = findLocation(free)
  let before = free
  let after = []
  if (loc) {
    consignee.city = loc.state ? `${loc.city}, ${loc.state.toUpperCase()}` : loc.city
    consignee.zip = loc.zip.toUpperCase()
    before = free.slice(0, loc.at[0])
    after = free.slice(loc.at.at(-1) + 1)
    // "J5W 0E7, CA": after a Canadian postcode, CA is Canada (not California).
    if (!consignee.country && /^ca$/i.test(after[0] ?? '') && CA_POSTAL.test(loc.zip)) {
      consignee.country = 'Canada'
      after = after.slice(1)
    }
    consignee.country ||= guessCountry(loc)
  }

  // Order / sheet numbers ("3676242", "N013947") are references, not part of the address.
  const refs = []
  const keep = (list) => list.filter((p) => (REFERENCE.test(p) ? (refs.push(p.replace(/^#/, '')), false) : true))
  before = keep(before)
  after = keep(after)
  shipment.reference ||= refs[0] ?? ''

  // The name is the line just before the street (the first part with a house number);
  // anything above it (product, size...) is shipment detail.
  let extra = []
  if (loc) {
    const street = before.findIndex(hasDigit)
    if (street > 0 && !hasDigit(before[street - 1])) {
      consignee.name = before[street - 1]
      extra = before.slice(0, street - 1)
      consignee.address = before.slice(street).join(', ')
    } else if (street === -1 && before.length > 1) {
      consignee.name = before[0]
      consignee.address = before.slice(1).join(', ')
    } else {
      consignee.address = before.join(', ')
    }
  } else {
    // No city / postcode found: keep the old "Name, address..." reading.
    if (before.length > 1 && !hasDigit(before[0])) consignee.name = before.shift()
    consignee.address = before.join(', ')
  }

  const name = consignee.name.toLowerCase()
  shipment.product = [...extra, ...after]
    .filter((p) => p.toLowerCase() !== name && !isRegion(p))
    .join(', ')
    .slice(0, 255)
  if (carriers.length) notes.unshift(`Customer asked for ${carriers.join(' / ')}`)
  shipment.notes = notes.join(' · ').slice(0, 255)
  consignee.phone = withCountryCode(consignee.phone, consignee.country)
  consignee.name = consignee.name.slice(0, 190)
  consignee.address = consignee.address.slice(0, 255)
  shipment.reference = shipment.reference.slice(0, 60)
  return { consignee, shipment }
}

// Cells of pasted Excel rows (tabs between cells, quoted cells may hold line breaks).
function tsvRows(text) {
  const rows = [[]]
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"' && cell === '') quoted = true
    else if (ch === '\t' || ch === '\n') {
      rows.at(-1).push(cell)
      cell = ''
      if (ch === '\n') rows.push([])
    } else if (ch !== '\r') cell += ch
  }
  rows.at(-1).push(cell)
  return rows.filter((r) => r.some((c) => c.trim()))
}

/**
 * Text pasted into an address box: several rows copied from Excel become one address each;
 * anything else (one address over several lines) stays one address. Returns the addresses.
 */
export function splitPastedAddresses(text) {
  if (!text.includes('\t')) return [text]
  const rows = tsvRows(text)
  // A copied Excel range has the same number of cells in every row; a single address with a few
  // tabs in it does not, so it is kept together.
  const sameShape = rows.length > 1 && rows.every((r) => r.length === rows[0].length && r.length > 1)
  return sameShape ? rows.map((r) => r.map((c) => c.trim()).join('\t')) : [text]
}
