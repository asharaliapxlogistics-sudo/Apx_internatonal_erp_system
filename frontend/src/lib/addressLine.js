// Splits a one-line address a customer sent ("Today's addresses") into consignee fields, e.g.
// "Hamza Qureshi, Flat 3, 17 Cheetham Hill Road, Manchester M8 8LW, United Kingdom, +44 7700 900311"
// It is a best guess: staff check the filled fields before saving the AWB.
import { COUNTRIES } from './awb'

// Other ways customers write a country -> the name used on AWBs.
const COUNTRY_ALIASES = {
  uk: 'United Kingdom', 'u.k.': 'United Kingdom', 'great britain': 'United Kingdom', england: 'United Kingdom',
  scotland: 'United Kingdom', wales: 'United Kingdom', 'northern ireland': 'United Kingdom',
  usa: 'United States', us: 'United States', 'u.s.a.': 'United States', america: 'United States',
  'united states of america': 'United States',
  uae: 'United Arab Emirates', 'u.a.e.': 'United Arab Emirates',
  ksa: 'Saudi Arabia', saudia: 'Saudi Arabia', 'saudi': 'Saudi Arabia',
  pk: 'Pakistan', holland: 'Netherlands', 'the netherlands': 'Netherlands', turkiye: 'Turkey', 'türkiye': 'Turkey',
  deutschland: 'Germany',
}
// Cities that tell the country when the customer left it out ("..., Dubai, +971 ...").
const CITY_COUNTRY = {
  dubai: 'United Arab Emirates', 'abu dhabi': 'United Arab Emirates', sharjah: 'United Arab Emirates',
  london: 'United Kingdom', manchester: 'United Kingdom', birmingham: 'United Kingdom',
  karachi: 'Pakistan', lahore: 'Pakistan', islamabad: 'Pakistan', riyadh: 'Saudi Arabia', jeddah: 'Saudi Arabia', doha: 'Qatar',
}

function countryOf(part) {
  const p = part.trim().toLowerCase()
  return COUNTRIES.find((c) => c.toLowerCase() === p) ?? COUNTRY_ALIASES[p] ?? ''
}

const isPhone = (part) => /^\+?[\d\s\-().]{7,}$/.test(part) && part.replace(/\D/g, '').length >= 7
const isEmail = (part) => /^\S+@\S+\.\S+$/.test(part)
const hasDigit = (s) => /\d/.test(s)

// "Manchester M8 8LW" -> Manchester + M8 8LW, "10711 Berlin" -> Berlin + 10711,
// "Toronto ON M5H 2M5" -> Toronto + M5H 2M5 (a 2-letter state/province code is dropped).
function cityAndZip(part) {
  const words = part.trim().split(/\s+/)
  const first = words.findIndex((w) => !hasDigit(w))
  if (first > 0) {
    // Postcode first ("10711 Berlin")
    return { city: words.slice(first).join(' '), zip: words.slice(0, first).join(' ') }
  }
  const firstDigit = words.findIndex(hasDigit)
  if (firstDigit === -1) return { city: part.trim(), zip: '' }
  let cityWords = words.slice(0, firstDigit)
  if (cityWords.length > 1 && /^[A-Z]{2}$/.test(cityWords.at(-1))) cityWords = cityWords.slice(0, -1)
  return { city: cityWords.join(' '), zip: words.slice(firstDigit).join(' ') }
}

export function parseAddressLine(line) {
  const parts = String(line ?? '')
    .split(/[,\n;]/)
    .map((p) => p.trim())
    .filter(Boolean)
  const out = { name: '', address: '', city: '', zip: '', country: '', phone: '', email: '' }
  // The country is usually near the end, so take the last part that is one.
  const countryAt = parts.findLastIndex((p) => countryOf(p))
  if (countryAt !== -1) out.country = countryOf(parts[countryAt])
  const rest = []
  parts.forEach((p, i) => {
    if (i === countryAt) return
    if (!out.phone && isPhone(p)) out.phone = p
    else if (!out.email && isEmail(p)) out.email = p
    else rest.push(p)
  })
  // Name: first part, if it looks like a name (letters, no house number).
  if (rest.length > 1 && !hasDigit(rest[0])) out.name = rest.shift()
  // City (+ postcode): the last part left, when there is a street address before it.
  if (rest.length > 1) Object.assign(out, cityAndZip(rest.pop()))
  out.address = rest.join(', ')
  if (!out.country) out.country = CITY_COUNTRY[out.city.toLowerCase()] ?? ''
  return out
}
