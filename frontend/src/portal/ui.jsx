import { CheckCircle2, Circle, Info } from 'lucide-react'
import { StatusBadge } from '../components/tracking/StatusUpdate'
import { formatDateTime, statusInfo } from '../lib/tracking'

export { StatusBadge }

export const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none'

export const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent-500 px-5 py-2.5 text-sm font-semibold whitespace-nowrap text-white shadow-lg shadow-accent-500/25 hover:bg-accent-600 disabled:opacity-60'
export const btnSecondary =
  'inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-ink-900 hover:bg-slate-50'

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold text-ink-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="font-bold text-ink-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

// Add to an input's classes when its field has an error.
export const errCls = 'border-accent-500 bg-red-50/40 focus:border-accent-500 focus:ring-red-100'

export function Field({ label, required, hint, error, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-semibold text-slate-600">
        {label}
        {required && <span className="text-accent-500"> *</span>}
      </span>
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

// Marks a screen that still shows sample data.
export function PreviewNote({ children = 'Preview with sample data. Nothing you do here is saved yet.' }) {
  return (
    <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800">
      <Info size={16} className="shrink-0" /> {children}
    </p>
  )
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <Icon size={36} className="text-slate-300" />
      <p className="mt-4 font-semibold text-ink-900">{title}</p>
      {children && <div className="mt-1 text-sm text-slate-500">{children}</div>}
    </div>
  )
}

const DOT = { booked: 'bg-slate-400', transit: 'bg-sky-500', customs: 'bg-amber-500', delivered: 'bg-emerald-500', exception: 'bg-accent-500' }

// Shipment history, newest first.
export function Timeline({ events }) {
  const list = [...events].reverse()
  return (
    <ol className="relative space-y-5 border-l-2 border-slate-100 pl-6">
      {list.map((e, i) => (
        <li key={`${e.status}-${e.at}`} className="relative">
          <span className={`absolute top-1 -left-[31px] h-4 w-4 rounded-full ring-4 ring-white ${DOT[statusInfo(e.status).group]} ${i ? 'opacity-50' : ''}`} />
          <p className={`font-bold ${i ? 'text-slate-600' : 'text-ink-900'}`}>{e.status}</p>
          <p className="text-sm text-slate-500">
            {formatDateTime(e.at)}
            {e.location && ` · ${e.location}`}
          </p>
          {e.remarks && <p className="mt-0.5 text-sm text-slate-700">{e.remarks}</p>}
        </li>
      ))}
    </ol>
  )
}

// Booked → Picked up → In transit → Delivered, for a quick visual of where a shipment is.
const STEPS = ['Booked', 'Shipped', 'Delivered']

export function ProgressSteps({ status }) {
  const group = statusInfo(status).group
  const reached = group === 'delivered' ? 3 : group === 'booked' ? 1 : 2
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, i) => (
        <div key={label} className="flex flex-1 items-center gap-2">
          {i < reached ? <CheckCircle2 size={18} className="shrink-0 text-emerald-500" /> : <Circle size={18} className="shrink-0 text-slate-300" />}
          <span className={`text-xs font-semibold ${i < reached ? 'text-ink-900' : 'text-slate-400'}`}>{label}</span>
          {i < STEPS.length - 1 && <span className={`h-0.5 flex-1 rounded ${i + 1 < reached ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
        </div>
      ))}
    </div>
  )
}

export const rs = (n) => `Rs ${Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`
export const shortDay = (iso) => new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
