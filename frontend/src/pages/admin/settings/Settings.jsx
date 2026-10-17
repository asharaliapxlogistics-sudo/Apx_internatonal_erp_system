import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, History, Search, ShieldCheck } from 'lucide-react'
import LoadState from '../../../components/LoadState'
import { useAppSettings } from '../../../context/AppSettings'
import { useApi } from '../../../hooks/useApi'
import { getSession } from '../../../lib/auth'
import { listAudit, updateSettings } from '../../../lib/settings'
import { listUsers } from '../../../lib/users'
import { PK_PHONE_HINT, email, errorsOf, focusFirstError, hasLetters, ntn, pkPhone } from '../../../lib/validation'

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none'

const TABS = [
  ['company', 'Company & printing'],
  ['series', 'Number series'],
  ['audit', 'Audit log'],
]

const errCls = 'border-accent-500 bg-red-50/40 focus:border-accent-500 focus:ring-red-100'

function Field({ label, hint, error, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <div className="mt-1">{children}</div>
      {error ? (
        <span role="alert" className="mt-1 block text-xs font-medium text-accent-600">
          {error}
        </span>
      ) : (
        hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>
      )}
    </label>
  )
}

function checkCompany(f) {
  return errorsOf({
    name: hasLetters('Company name', f.name, { required: true }),
    phone: pkPhone(f.phone, { required: false }),
    email: email(f.email),
    ntn: ntn(f.ntn),
    trackingUrl: !f.trackingUrl.trim() || /^https?:\/\/\S+\.\S+/.test(f.trackingUrl.trim()) ? '' : 'The address must start with http:// or https://',
  })
}

function Message({ error, saved }) {
  if (error)
    return (
      <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent-600">
        {error}
      </p>
    )
  if (saved)
    return (
      <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
        Saved.
      </p>
    )
  return null
}

function CompanyForm({ settings, onSaved }) {
  const [form, setForm] = useState({ ...settings.company, trackingUrl: settings.trackingUrl })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [tried, setTried] = useState(false)
  const errors = tried ? checkCompany(form) : {}
  const cls = (key) => `${inputCls} ${errors[key] ? errCls : ''}`
  const set = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value })
    setSaved(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setTried(true)
    const found = checkCompany(form)
    if (Object.keys(found).length) {
      setTimeout(() => focusFirstError(found))
      return
    }
    setSaving(true)
    try {
      const { trackingUrl, ...company } = form
      onSaved(await updateSettings({ company, trackingUrl }))
      setSaved(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-ink-900">Company details</h2>
        <p className="mt-1 mb-4 text-xs text-slate-500">Printed at the top of invoices and expense vouchers.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name" error={errors.name}>
            <input data-field="name" className={cls('name')} value={form.name} onChange={set('name')} maxLength={120} required />
          </Field>
          <Field label="Phone" hint={PK_PHONE_HINT} error={errors.phone}>
            <input data-field="phone" type="tel" inputMode="tel" className={cls('phone')} value={form.phone} onChange={set('phone')} maxLength={60} />
          </Field>
          <Field label="Office address" className="sm:col-span-2">
            <input className={inputCls} value={form.office} onChange={set('office')} maxLength={255} />
          </Field>
          <Field label="Email" hint="Leave empty to leave it off the invoice." error={errors.email}>
            <input data-field="email" type="email" className={cls('email')} value={form.email} onChange={set('email')} maxLength={190} />
          </Field>
          <Field label="NTN" hint="e.g. 1234567-8. Leave empty to leave it off the invoice." error={errors.ntn}>
            <input data-field="ntn" className={cls('ntn')} value={form.ntn} onChange={set('ntn')} maxLength={15} />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-ink-900">Tracking page</h2>
        <p className="mt-1 mb-4 text-xs text-slate-500">
          The QR code on each airway bill opens this address with the AWB number added, e.g. …?no=10257080.
        </p>
        <Field label="Tracking page address" hint="Your website's tracking page. Leave empty to use this system's address." error={errors.trackingUrl}>
          <input data-field="trackingUrl" className={cls('trackingUrl')} value={form.trackingUrl} onChange={set('trackingUrl')} placeholder="https://www.example.com/tracking" maxLength={255} />
        </Field>
      </section>

      <Message error={error} saved={saved} />
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 hover:bg-accent-600 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </form>
  )
}

function SeriesForm({ settings, onSaved }) {
  const [values, setValues] = useState(() => Object.fromEntries(settings.series.map((s) => [s.key, String(s.first)])))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const changed = settings.series.filter((s) => values[s.key] !== String(s.first))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const series = Object.fromEntries(changed.map((s) => [s.key, Number(values[s.key])]))
      onSaved(await updateSettings({ company: settings.company, trackingUrl: settings.trackingUrl, series }))
      setSaved(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-500">
        Numbers are given out by the system in order. You can make a series start at a higher number (for example when moving
        to a new AWB book); it cannot go back to a number already used.
      </p>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">Series</th>
              <th className="px-4 py-3">Last used</th>
              <th className="px-4 py-3">Next number</th>
              <th className="px-4 py-3">Start series at</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {settings.series.map((s) => (
              <tr key={s.key}>
                <td className="px-4 py-3 font-semibold text-ink-900">{s.label}</td>
                <td className="px-4 py-3 text-slate-500">{s.lastUsed ?? 'None yet'}</td>
                <td className="px-4 py-3 font-bold text-brand-600">{s.nextLabel}</td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    aria-label={`Start ${s.label} at`}
                    className={`${inputCls} w-40`}
                    value={values[s.key]}
                    onChange={(e) => {
                      setValues({ ...values, [s.key]: e.target.value })
                      setSaved(false)
                    }}
                    required
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Message error={error} saved={saved} />
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving || changed.length === 0}
          className="rounded-xl bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 hover:bg-accent-600 disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save number series'}
        </button>
      </div>
    </form>
  )
}

const ENTITIES = [
  ['', 'Everything'],
  ['login', 'Sign-ins'],
  ['customer', 'Customers'],
  ['awb', 'AWBs & tracking'],
  ['invoice', 'Invoices & payments'],
  ['expense', 'Expenses'],
  ['user', 'Employees'],
  ['settings', 'Settings'],
]
const ACTION_TONE = {
  'auth.login_failed': 'bg-red-50 text-accent-600',
  'awb.void': 'bg-red-50 text-accent-600',
  'awb.restore': 'bg-emerald-50 text-emerald-700',
}
const PAGE = 50

const fieldName = (k) => k.replace(/_/g, ' ')
const show = (v) => (v === '' || v === null || v === undefined ? '(empty)' : String(v))

function AuditDetails({ details }) {
  if (!details) return null
  const { changes, ...rest } = details
  return (
    <div className="mt-2 space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
      {changes &&
        Object.entries(changes).map(([k, [from, to]]) => (
          <p key={k}>
            <span className="font-semibold text-ink-900">{fieldName(k)}:</span> {show(from)} → {show(to)}
          </p>
        ))}
      {Object.entries(rest)
        .filter(([, v]) => v !== '' && v !== null)
        .map(([k, v]) => (
          <p key={k}>
            <span className="font-semibold text-ink-900">{fieldName(k)}:</span> {show(v)}
          </p>
        ))}
    </div>
  )
}

function AuditLog() {
  const [filters, setFilters] = useState({ from: '', to: '', userId: '', entity: '', q: '' })
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [open, setOpen] = useState(() => new Set())
  const { data: users } = useApi(listUsers, [])
  const key = JSON.stringify({ ...filters, limit })
  const { data, error, reload } = useApi(() => listAudit({ ...filters, limit }), [key])
  const set = (k) => (e) => {
    setFilters({ ...filters, [k]: e.target.value })
    setLimit(PAGE)
  }

  function toggle(id) {
    const next = new Set(open)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setOpen(next)
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setFilters({ ...filters, q: search.trim() })
          setLimit(PAGE)
        }}
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <Field label="What">
          <select className={inputCls} value={filters.entity} onChange={set('entity')}>
            {ENTITIES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Who">
          <select className={inputCls} value={filters.userId} onChange={set('userId')}>
            <option value="">Everyone</option>
            {(users ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="From">
          <input type="date" className={inputCls} value={filters.from} onChange={set('from')} />
        </Field>
        <Field label="To">
          <input type="date" className={inputCls} value={filters.to} onChange={set('to')} />
        </Field>
        <Field label="Search" hint="AWB / invoice number, name… press Enter">
          <div className="relative">
            <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <input className={`${inputCls} pl-9`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. 10257080" />
          </div>
        </Field>
      </form>

      {!data ? (
        <LoadState error={error} onRetry={reload} />
      ) : data.rows.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <History size={36} className="text-slate-300" />
          <p className="mt-4 font-semibold text-ink-900">No activity found</p>
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <p className="border-b border-slate-100 px-5 py-3 text-sm text-slate-500">
            Showing {data.rows.length} of {data.total} entries, newest first
          </p>
          <ul className="divide-y divide-slate-100">
            {data.rows.map((r) => {
              const expandable = r.details && Object.keys(r.details).length > 0
              return (
                <li key={r.id} className="px-5 py-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-4">
                    <p className="w-40 shrink-0 text-xs whitespace-nowrap text-slate-500">
                      {new Date(r.at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => expandable && toggle(r.id)}
                        className={`flex items-start gap-1 text-left text-sm ${expandable ? 'cursor-pointer' : 'cursor-default'}`}
                        aria-expanded={expandable ? open.has(r.id) : undefined}
                      >
                        {expandable &&
                          (open.has(r.id) ? (
                            <ChevronDown size={16} className="mt-0.5 shrink-0 text-slate-400" />
                          ) : (
                            <ChevronRight size={16} className="mt-0.5 shrink-0 text-slate-400" />
                          ))}
                        <span className="text-ink-900">{r.summary}</span>
                      </button>
                      {open.has(r.id) && <AuditDetails details={r.details} />}
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-xs">
                      <span className={`rounded-md px-1.5 py-0.5 font-semibold ${ACTION_TONE[r.action] ?? 'bg-slate-100 text-slate-600'}`}>{r.action}</span>
                      <span className="font-semibold text-slate-600">{r.userName || '—'}</span>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
          {data.rows.length < data.total && (
            <div className="border-t border-slate-100 p-3 text-center">
              <button onClick={() => setLimit(limit + PAGE)} className="rounded-lg px-4 py-2 text-sm font-semibold text-brand-500 hover:bg-brand-50">
                Show more
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

export default function Settings() {
  const me = getSession()
  const [params, setParams] = useSearchParams()
  const tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'company'
  const settings = useAppSettings()

  if (me?.role !== 'admin') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <ShieldCheck size={36} className="mx-auto text-slate-300" />
        <p className="mt-4 font-semibold text-ink-900">Only admins can change settings</p>
      </div>
    )
  }

  // Saving returns the new settings; reloading the shared copy updates printed documents too.
  const onSaved = () => settings.reloadSettings()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-ink-900">Settings & Audit Log</h1>
        <p className="mt-1 text-sm text-slate-500">Company details, number series, and a record of who did what.</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setParams({ tab: key })}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${
              key === tab ? 'border-accent-500 text-ink-900' : 'border-transparent text-slate-500 hover:text-ink-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'audit' ? (
        <AuditLog />
      ) : !settings.loaded ? (
        <LoadState onRetry={settings.reloadSettings} />
      ) : tab === 'company' ? (
        <CompanyForm settings={settings} onSaved={onSaved} />
      ) : (
        <SeriesForm settings={settings} onSaved={onSaved} />
      )}
    </div>
  )
}
