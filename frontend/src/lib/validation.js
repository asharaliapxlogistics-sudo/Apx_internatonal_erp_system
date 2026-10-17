// Checks for form fields, shown under the field before saving. The server runs the same checks
// (backend/app/schemas/validators.py), so keep the two in step.
// Each check returns an error message, or '' when the value is fine. Empty optional values are fine.

const digits = (v) => String(v ?? '').replace(/\D/g, '')

export const isPakistan = (country) => ['pakistan', 'pk'].includes(String(country ?? '').trim().toLowerCase())

export function isPkPhone(value) {
  const raw = String(value ?? '').replace(/[\s\-().]/g, '')
  if (!/^\+?\d+$/.test(raw)) return false
  if (raw.startsWith('111')) return /^111\d{6}$/.test(raw) // UAN
  const national = raw.replace(/^(\+92|0092|92)/, '0')
  if (national.startsWith('03')) return /^03\d{9}$/.test(national) // mobile 0300-1234567
  return /^0[124-9]\d{7,9}$/.test(national) // landline 021-34567890
}

export const PK_PHONE_HINT = 'e.g. 0300-1234567 or 021-34567890'
export const INTL_PHONE_HINT = 'With country code, e.g. +44 7700 900123'

export function pkPhone(value, { required = true } = {}) {
  if (!String(value ?? '').trim()) return required ? 'Enter the phone number.' : ''
  return isPkPhone(value) ? '' : `Enter a valid Pakistani number, ${PK_PHONE_HINT}.`
}

export function anyPhone(value) {
  const v = String(value ?? '').trim()
  if (!v) return 'Enter the phone number.'
  const n = digits(v).length
  return /^\+?[\d\s\-().]+$/.test(v) && n >= 7 && n <= 15 ? '' : `Enter a valid phone number. ${INTL_PHONE_HINT}.`
}

// Pakistani parties need a Pakistani number; anyone else a full international number.
export const phoneFor = (country, value) => (isPakistan(country) ? pkPhone(value) : anyPhone(value))

export function email(value) {
  const v = String(value ?? '').trim()
  return !v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Enter a valid email address.'
}

// Login name, e.g. syed_shahid_admin. Same rule as the backend (validators.username).
export function username(value) {
  const v = String(value ?? '').trim().toLowerCase()
  return /^[a-z0-9][a-z0-9._@-]{2,59}$/.test(v) ? '' : 'Username: 3-60 letters or numbers, no spaces (. _ - allowed).'
}

export function cnic(value) {
  const v = String(value ?? '').trim()
  return !v || /^\d{5}-?\d{7}-?\d$/.test(v) ? '' : 'CNIC must be 13 digits, e.g. 42101-1234567-1.'
}

export function ntn(value) {
  const v = String(value ?? '').trim()
  return !v || /^\d{7}(-?\d)?$/.test(v) || /^\d{5}-?\d{7}-?\d$/.test(v) ? '' : 'NTN must look like 1234567-8, or a 13-digit CNIC.'
}

export function ntnOrCnic(value) {
  const v = String(value ?? '').trim()
  return !v || /^\d{7}(-?\d)?$/.test(v) || /^\d{5}-?\d{7}-?\d$/.test(v)
    ? ''
    : 'Enter a 13-digit CNIC (42101-1234567-1) or an NTN (1234567-8).'
}

export function strn(value) {
  const v = String(value ?? '').trim()
  return !v || (/^[\d\s-]+$/.test(v) && digits(v).length === 13) ? '' : 'STRN must be 13 digits.'
}

export function pkPostal(country, value) {
  const v = String(value ?? '').trim()
  return !isPakistan(country) || !v || /^\d{5}$/.test(v) ? '' : 'Pakistani postal codes are 5 digits, e.g. 75500.'
}

export function hasLetters(label, value, { required = false } = {}) {
  const v = String(value ?? '').trim()
  if (!v) return required ? `Enter the ${label.toLowerCase()}.` : ''
  return /\p{L}/u.test(v) ? '' : `${label} must contain letters.`
}

export function positive(label, value, { max } = {}) {
  const n = Number(value)
  if (value === '' || value === null || value === undefined || !Number.isFinite(n) || n <= 0) return `Enter the ${label.toLowerCase()} (more than 0).`
  if (max && n > max) return `${label} looks too high. Please check it.`
  return ''
}

// { field: message } with only the failing fields; empty object = valid.
export function errorsOf(checks) {
  return Object.fromEntries(Object.entries(checks).filter(([, message]) => message))
}

// Scrolls to and focuses the first field with an error (fields carry data-field="name").
export function focusFirstError(errors) {
  const first = Object.keys(errors)[0]
  if (!first) return
  const el = document.querySelector(`[data-field="${first}"]`)
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el?.focus?.()
}
