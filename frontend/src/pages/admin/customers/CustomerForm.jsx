import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import LoadState from '../../../components/LoadState'
import { useCustomerFilter } from '../../../context/CustomerFilter'
import { useApi } from '../../../hooks/useApi'
import { CUSTOMER_TYPES, createCustomer, emptyCustomer, getCustomer, updateCustomer } from '../../../lib/customers'
import { PK_PHONE_HINT, cnic, email, errorsOf, focusFirstError, hasLetters, ntn, pkPhone, pkPostal, strn } from '../../../lib/validation'
import PortalUsers from './PortalUsers'

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none'

const errCls = 'border-accent-500 bg-red-50/40 focus:border-accent-500 focus:ring-red-100'

function Field({ label, required, hint, error, className = '', children }) {
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

function check(f) {
  const walkIn = f.type === 'Walk-in'
  return errorsOf({
    name: hasLetters(walkIn ? 'Customer name' : 'Company name', f.name, { required: true }),
    contactPerson: walkIn ? '' : hasLetters('Contact person', f.contactPerson),
    phone: pkPhone(f.phone),
    email: email(f.email),
    city: hasLetters('City', f.city, { required: true }),
    zip: pkPostal(f.country, f.zip),
    country: String(f.country ?? '').trim() ? '' : 'Enter the country.',
    ntn: ntn(f.ntn),
    strn: strn(f.strn),
    cnic: cnic(f.cnic),
  })
}

function Card({ title, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 font-bold text-ink-900">{title}</h2>
      {children}
    </section>
  )
}

export default function CustomerForm() {
  const { id } = useParams()
  const { data, error, reload } = useApi(() => (id ? getCustomer(id) : Promise.resolve(null)), [id])

  if (error?.status === 404) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <p className="font-semibold text-ink-900">Customer not found</p>
        <Link to="/admin/customers" className="mt-3 inline-block text-sm font-semibold text-brand-500">
          Back to Customers
        </Link>
      </div>
    )
  }
  if (error || data === undefined) return <LoadState error={error} onRetry={reload} />
  if (!data) return <CustomerFormFields key="new" existing={null} />
  return (
    <div className="space-y-6">
      <CustomerFormFields key={id} existing={data} />
      <PortalUsers customer={data} />
    </div>
  )
}

function CustomerFormFields({ existing }) {
  const navigate = useNavigate()
  const { reloadCustomers } = useCustomerFilter()
  const [form, setForm] = useState(() => ({ ...emptyCustomer, ...existing }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [tried, setTried] = useState(false)
  // Shown after the first save attempt, then updated as the user types.
  const errors = tried ? check(form) : {}
  const cls = (key) => `${inputCls} ${errors[key] ? errCls : ''}`

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const isWalkIn = form.type === 'Walk-in'

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setTried(true)
    const found = check(form)
    if (Object.keys(found).length) {
      setTimeout(() => focusFirstError(found))
      return
    }
    setSaving(true)
    try {
      if (existing) {
        await updateCustomer(existing.id, form)
        reloadCustomers()
        navigate('/admin/customers')
      } else {
        // Open the new customer so its portal login can be added straight away.
        const created = await createCustomer(form)
        reloadCustomers()
        navigate(`/admin/customers/${created.id}`, { replace: true })
      }
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <div>
        <Link
          to="/admin/customers"
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-ink-900"
        >
          <ArrowLeft size={16} /> Customers
        </Link>
        <h1 className="mt-2 text-3xl font-extrabold text-ink-900">
          {existing ? existing.name : 'Add Customer'}
          {existing && <span className="ml-3 align-middle text-base font-bold text-brand-500">{existing.accountNo}</span>}
        </h1>
        {!existing && (
          <p className="mt-1 text-sm text-slate-500">
            The account number is generated automatically when you save. After saving, you can add the customer's portal login below.
          </p>
        )}
      </div>

      <Card title="Customer profile">
        <div className="mb-5 flex flex-wrap gap-2">
          {CUSTOMER_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setForm({ ...form, type: t })}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                form.type === t
                  ? 'border-ink-950 bg-ink-950 text-white'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={isWalkIn ? 'Customer name' : 'Company name'} required error={errors.name}>
            <input data-field="name" className={cls('name')} value={form.name} onChange={set('name')} maxLength={190} required />
          </Field>
          {!isWalkIn && (
            <Field label="Contact person" error={errors.contactPerson}>
              <input data-field="contactPerson" className={cls('contactPerson')} value={form.contactPerson} onChange={set('contactPerson')} maxLength={120} />
            </Field>
          )}
          <Field label="Phone" required hint={PK_PHONE_HINT} error={errors.phone}>
            <input data-field="phone" className={cls('phone')} type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} placeholder="0300-1234567" maxLength={40} required />
          </Field>
          <Field label="Email" error={errors.email}>
            <input data-field="email" className={cls('email')} type="email" value={form.email} onChange={set('email')} placeholder="name@company.com" maxLength={190} />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <input className={inputCls} value={form.address} onChange={set('address')} maxLength={255} />
          </Field>
          <Field label="City" required error={errors.city}>
            <input data-field="city" className={cls('city')} value={form.city} onChange={set('city')} maxLength={80} required />
          </Field>
          <Field label="Zip code" hint="5 digits for Pakistan, e.g. 75500" error={errors.zip}>
            <input data-field="zip" className={cls('zip')} value={form.zip} onChange={set('zip')} inputMode="numeric" maxLength={20} />
          </Field>
          <Field label="Country" required error={errors.country}>
            <input data-field="country" className={cls('country')} value={form.country} onChange={set('country')} maxLength={80} required />
          </Field>
        </div>
      </Card>

      <Card title="Tax & identity">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="NTN" hint="e.g. 1234567-8" error={errors.ntn}>
            <input data-field="ntn" className={cls('ntn')} value={form.ntn} onChange={set('ntn')} placeholder="1234567-8" maxLength={15} />
          </Field>
          <Field label="STRN" hint="13 digits" error={errors.strn}>
            <input data-field="strn" className={cls('strn')} value={form.strn} onChange={set('strn')} inputMode="numeric" maxLength={20} />
          </Field>
          <Field label="CNIC" hint="13 digits, e.g. 42101-1234567-1" error={errors.cnic}>
            <input data-field="cnic" className={cls('cnic')} value={form.cnic} onChange={set('cnic')} placeholder="42101-1234567-1" inputMode="numeric" maxLength={15} />
          </Field>
        </div>
      </Card>

      <Card title="Notes">
        <textarea className={`${inputCls} min-h-20`} value={form.notes} onChange={set('notes')} />
      </Card>

      {(error || Object.keys(errors).length > 0) && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent-600">
          {error || `Please fix ${Object.keys(errors).length} ${Object.keys(errors).length === 1 ? 'field' : 'fields'} marked in red.`}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <Link
          to="/admin/customers"
          className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold hover:bg-slate-100"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 hover:bg-accent-600 disabled:opacity-60"
        >
          {saving ? 'Saving…' : existing ? 'Save changes' : 'Add customer'}
        </button>
      </div>
    </form>
  )
}
