import { useState } from 'react'
import { X } from 'lucide-react'
import Combobox from '../Combobox'
import { STATUSES, addEvent, localDateTime, statusInfo } from '../../lib/tracking'

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none'

const LOCATIONS = ['Karachi', 'Karachi Airport (KHI)', 'Dubai (DXB)', 'Doha (DOH)', 'London Heathrow (LHR)', 'Manchester (MAN)', 'Birmingham (BHX)']

// Statuses where staff must say why.
const NEEDS_REMARKS = new Set(['Customs hold', 'Exception', 'Returned'])

const REMARKS_HINT = {
  Delivered: 'Received by (name)',
  'Customs hold': 'Reason / documents needed',
  Exception: 'What went wrong (e.g. wrong address)',
  Returned: 'Reason for return',
}

export function StatusBadge({ status }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${statusInfo(status).tone}`}>
      {status}
    </span>
  )
}

function Field({ label, required, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-semibold text-slate-600">
        {label}
        {required && <span className="text-accent-500"> *</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

// Status update for one AWB (`number`) or many (`selected`, picked from `shipments` or ticked in the list;
// numbers cannot be typed). `locations` = places used in earlier updates, offered as suggestions.
export default function StatusUpdate({ number, selected = [], onSelectedChange, shipments = [], onSaved, locations = [] }) {
  const [form, setForm] = useState(() => ({ status: '', at: localDateTime(), location: '', remarks: '' }))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  const bulk = number === undefined
  const usedLocations = [...new Set([...LOCATIONS, ...locations])].filter(Boolean)
  const byNumber = new Map(shipments.map((s) => [s.awb.number, s]))
  const available = shipments.filter((s) => !selected.includes(s.awb.number))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const numbers = bulk ? selected : [number]
    if (!numbers.length) return setError('Select at least one AWB.')
    setSaving(true)
    try {
      // The server rejects the whole batch if any number is unknown or void.
      await addEvent(numbers, { status: form.status, at: form.at, location: form.location.trim(), remarks: form.remarks.trim() })
    } catch (err) {
      setSaving(false)
      return setError(err.message)
    }
    setSaving(false)
    // Bulk keeps the status so the next scanned batch can get the same update.
    setForm({ status: bulk ? form.status : '', at: localDateTime(), location: form.location, remarks: '' })
    onSaved(numbers)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {bulk && (
        <Field label="AWB numbers" required>
          <select className={inputCls} value="" onChange={(e) => e.target.value && onSelectedChange([...selected, e.target.value])}>
            <option value="">{available.length ? 'Select AWB…' : 'No more shipments to add'}</option>
            {available.map((s) => (
              <option key={s.awb.number} value={s.awb.number}>
                {s.awb.number} · {s.awb.consignee.name} · {s.awb.consignee.city} ({s.status})
              </option>
            ))}
          </select>
          {selected.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {selected.map((n) => (
                <span key={n} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 py-1 pr-1.5 pl-2.5 text-xs font-semibold text-ink-900">
                  {n}
                  <span className="font-normal text-slate-500">{byNumber.get(n)?.awb.consignee.name}</span>
                  <button
                    type="button"
                    onClick={() => onSelectedChange(selected.filter((x) => x !== n))}
                    aria-label={`Remove AWB ${n}`}
                    className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-accent-500"
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <span className="mt-1 block text-xs text-slate-500">
            {selected.length} AWB selected · pick from the list above or tick shipments below
          </span>
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New status" required>
          <select className={inputCls} value={form.status} onChange={set('status')} required>
            <option value="">— Select status —</option>
            {STATUSES.filter((s) => s.name !== 'Booked').map((s) => (
              <option key={s.name}>{s.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Date & time" required>
          <input type="datetime-local" className={inputCls} value={form.at} onChange={set('at')} required />
        </Field>
        <Field label="Location">
          <Combobox className={inputCls} options={usedLocations} placeholder="e.g. Karachi" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
        </Field>
        <Field label="Remarks" required={NEEDS_REMARKS.has(form.status)}>
          <input
            className={inputCls}
            placeholder={REMARKS_HINT[form.status] ?? 'Optional'}
            value={form.remarks}
            onChange={set('remarks')}
            required={NEEDS_REMARKS.has(form.status)}
          />
        </Field>
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent-600">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 hover:bg-accent-600 disabled:opacity-60"
        >
          {saving ? 'Saving…' : bulk ? 'Update all' : 'Add update'}
        </button>
      </div>
    </form>
  )
}
