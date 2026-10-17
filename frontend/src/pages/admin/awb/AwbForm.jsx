import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPinned, Plus, Trash2 } from 'lucide-react'
import Combobox from '../../../components/Combobox'
import CustomsItems from '../../../components/awb/CustomsItems'
import { useCustomerFilter } from '../../../context/CustomerFilter'
import { parseAddressLine } from '../../../lib/addressLine'
import { COUNTRIES, SERVICES, calcWeights, createAwb, emptyItem, itemErrors, itemsTotal, kg, pieceVolumetric } from '../../../lib/awb'
import {
  INTL_PHONE_HINT,
  PK_PHONE_HINT,
  email,
  errorsOf,
  focusFirstError,
  hasLetters,
  isPakistan,
  ntnOrCnic,
  phoneFor,
  pkPostal,
  positive,
} from '../../../lib/validation'

const emptyParty = { name: '', company: '', address: '', email: '', ntnCnic: '', zip: '', city: '', country: '', phone: '' }
const emptyPiece = { length: '', width: '', height: '' }

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

function Card({ title, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 font-bold text-ink-900">{title}</h2>
      {children}
    </section>
  )
}

function partyErrors(prefix, p, isShipper) {
  return {
    [`${prefix}.name`]: hasLetters('Name', p.name, { required: true }),
    [`${prefix}.address`]: p.address.trim() ? '' : 'Enter the address.',
    [`${prefix}.city`]: hasLetters('City', p.city, { required: true }),
    [`${prefix}.zip`]: pkPostal(p.country, p.zip),
    [`${prefix}.country`]: p.country.trim() ? '' : 'Enter the country.',
    [`${prefix}.phone`]: phoneFor(p.country, p.phone),
    [`${prefix}.email`]: email(p.email),
    [`${prefix}.ntnCnic`]: isShipper ? ntnOrCnic(p.ntnCnic) : '',
  }
}

function check({ shipper, consignee, form, pieces, items }) {
  const pieceErrors = {}
  pieces.forEach((p, i) => {
    const dims = [p.length, p.width, p.height]
    const filled = dims.filter((d) => d !== '' && d !== null && d !== undefined)
    if (filled.length && (filled.length < 3 || dims.some((d) => !(Number(d) > 0)))) {
      pieceErrors[`piece.${i}`] = `Piece ${i + 1}: enter length, width and height (all more than 0), or leave all three empty.`
    }
  })
  return errorsOf({
    ...partyErrors('shipper', shipper, true),
    ...partyErrors('consignee', consignee, false),
    service: form.service.trim() ? '' : 'Choose the service.',
    actualWeight: positive('Actual weight', form.actualWeight, { max: 5000 }),
    declaredValue: form.declaredValue !== '' && !(Number(form.declaredValue) >= 0) ? 'Declared value cannot be negative.' : '',
    productDetail: form.productDetail.trim() ? '' : 'Enter the product detail.',
    ...pieceErrors,
    ...itemErrors(items),
  })
}

function PartyFields({ party, onChange, kind, errors }) {
  const set = (key) => (e) => onChange({ ...party, [key]: e.target.value })
  const isShipper = kind === 'shipper'
  const err = (key) => errors[`${kind}.${key}`]
  const cls = (key) => `${inputCls} ${err(key) ? errCls : ''}`
  const field = (key) => `${kind}.${key}`
  const pk = isPakistan(party.country)
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Name" required error={err('name')}>
        <input data-field={field('name')} className={cls('name')} value={party.name} onChange={set('name')} maxLength={190} required />
      </Field>
      {isShipper ? (
        <Field label="NTN / CNIC" hint="CNIC 42101-1234567-1 or NTN 1234567-8" error={err('ntnCnic')}>
          <input data-field={field('ntnCnic')} className={cls('ntnCnic')} value={party.ntnCnic} onChange={set('ntnCnic')} maxLength={15} />
        </Field>
      ) : (
        <Field label="Company">
          <input className={inputCls} value={party.company} onChange={set('company')} maxLength={190} />
        </Field>
      )}
      <Field label="Address" required className="sm:col-span-2" error={err('address')}>
        <input data-field={field('address')} className={cls('address')} value={party.address} onChange={set('address')} maxLength={255} required />
      </Field>
      <Field label="City" required error={err('city')}>
        <input data-field={field('city')} className={cls('city')} value={party.city} onChange={set('city')} maxLength={80} required />
      </Field>
      <Field label="Zip code" hint={pk ? '5 digits, e.g. 75500' : undefined} error={err('zip')}>
        <input data-field={field('zip')} className={cls('zip')} value={party.zip} onChange={set('zip')} maxLength={20} />
      </Field>
      <Field label="Country" required error={err('country')}>
        <Combobox
          data-field={field('country')}
          className={cls('country')}
          options={COUNTRIES}
          value={party.country}
          onChange={(v) => onChange({ ...party, country: v })}
          required
        />
      </Field>
      <Field label="Telephone" required hint={pk ? PK_PHONE_HINT : INTL_PHONE_HINT} error={err('phone')}>
        <input
          data-field={field('phone')}
          className={cls('phone')}
          type="tel"
          inputMode="tel"
          value={party.phone}
          onChange={set('phone')}
          placeholder={pk ? '0300-1234567' : '+44 7700 900123'}
          maxLength={40}
          required
        />
      </Field>
      <Field label="Email" className="sm:col-span-2" error={err('email')}>
        <input data-field={field('email')} className={cls('email')} type="email" value={party.email} onChange={set('email')} maxLength={190} />
      </Field>
    </div>
  )
}

function shipperFromCustomer(c) {
  return {
    ...emptyParty,
    name: c.name,
    address: c.address,
    email: c.email,
    ntnCnic: c.ntn || c.cnic,
    zip: c.zip,
    city: c.city,
    country: c.country,
    phone: c.phone,
  }
}

export default function AwbForm() {
  const navigate = useNavigate()
  // "Create AWB" on Customer Addresses passes the customer and the address line they sent.
  const fromAddress = useLocation().state ?? {}
  const { customerId: filterCustomerId, customers } = useCustomerFilter()
  const initialCustomer = customers.find((c) => c.id === (fromAddress.customerId ?? filterCustomerId)) ?? null
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [tried, setTried] = useState(false)

  const [customerId, setCustomerId] = useState(initialCustomer?.id ?? '')
  const [shipper, setShipper] = useState(() =>
    initialCustomer ? shipperFromCustomer(initialCustomer) : { ...emptyParty, country: 'Pakistan' },
  )
  const [consignee, setConsignee] = useState(() => {
    if (!fromAddress.address) return emptyParty
    const parsed = parseAddressLine(fromAddress.address)
    return { ...emptyParty, ...parsed, address: (parsed.address || fromAddress.address).slice(0, 255) }
  })
  const [pieces, setPieces] = useState([{ ...emptyPiece }])
  const [items, setItems] = useState([{ ...emptyItem }])
  const [invoiceType, setInvoiceType] = useState('Gift')
  // Once items have prices, the declared value is their total (the server does the same).
  const itemsValue = itemsTotal(items)
  const [form, setForm] = useState({
    accountNo: initialCustomer?.accountNo ?? '',
    bagNumber: '',
    shipperReference: '',
    actualWeight: '',
    service: '',
    fragile: false,
    declaredValue: '',
    productDetail: '',
    comments: '',
  })

  // After a page reload the customer list arrives late; fill the shipper from the address's customer then.
  useEffect(() => {
    const c = !customerId && fromAddress.customerId && customers.find((x) => x.id === fromAddress.customerId)
    if (c) {
      setCustomerId(c.id)
      setShipper(shipperFromCustomer(c))
      setForm((f) => ({ ...f, accountNo: c.accountNo }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers])

  // Shown after the first save attempt, then updated as the user types.
  const errors = tried ? check({ shipper, consignee, form, pieces, items }) : {}
  const cls = (key) => `${inputCls} ${errors[key] ? errCls : ''}`

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const setPiece = (i, key) => (e) => setPieces(pieces.map((p, j) => (j === i ? { ...p, [key]: e.target.value } : p)))
  const weights = calcWeights(pieces, form.actualWeight)

  function pickCustomer(e) {
    const c = customers.find((x) => x.id === e.target.value)
    setCustomerId(e.target.value)
    if (c) {
      setShipper(shipperFromCustomer(c))
      setForm((f) => ({ ...f, accountNo: c.accountNo }))
    } else {
      setShipper({ ...emptyParty, country: 'Pakistan' })
      setForm((f) => ({ ...f, accountNo: '' }))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setTried(true)
    const found = check({ shipper, consignee, form, pieces, items })
    if (Object.keys(found).length) {
      setTimeout(() => focusFirstError(found))
      return
    }
    setSaving(true)
    try {
      const awb = await createAwb({ ...form, customerId: customerId || null, shipper, consignee, pieces, items, invoiceType })
      navigate(`/admin/awb/${awb.number}`)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const errorCount = Object.keys(errors).length

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <div>
        <Link to="/admin/awb" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-ink-900">
          <ArrowLeft size={16} /> Air Waybills
        </Link>
        <h1 className="mt-2 text-3xl font-extrabold text-ink-900">New Airway Bill</h1>
        <p className="mt-1 text-sm text-slate-500">
          AWB number, date and time are generated automatically when you save.
        </p>
      </div>

      {fromAddress.address && (
        <div className="flex gap-3 rounded-2xl border border-brand-100 bg-brand-50 px-5 py-4 text-sm">
          <MapPinned size={18} className="mt-0.5 shrink-0 text-brand-500" />
          <div>
            <p className="font-semibold text-ink-900">Address sent by the customer</p>
            <p className="mt-1 text-ink-900">{fromAddress.address}</p>
            <p className="mt-1 text-xs text-slate-500">
              Name, address, city, zip, country and phone were filled in from it. Check them before saving.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Shipper">
          <Field label="Customer account" className="mb-4">
            <select className={inputCls} value={customerId} onChange={pickCustomer}>
              <option value="">— No account (enter shipper manually) —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.accountNo})
                </option>
              ))}
            </select>
          </Field>
          <PartyFields party={shipper} onChange={setShipper} kind="shipper" errors={errors} />
        </Card>
        <Card title="Consignee">
          <PartyFields party={consignee} onChange={setConsignee} kind="consignee" errors={errors} />
        </Card>
      </div>

      <Card title="Shipment">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Service" required error={errors.service}>
            <Combobox
              data-field="service"
              className={cls('service')}
              options={SERVICES}
              value={form.service}
              onChange={(v) => setForm({ ...form, service: v })}
              required
            />
          </Field>
          <Field label="Account #">
            <input className={inputCls} value={form.accountNo} onChange={set('accountNo')} maxLength={20} />
          </Field>
          <Field label="Shipper's reference">
            <input className={inputCls} value={form.shipperReference} onChange={set('shipperReference')} maxLength={60} />
          </Field>
          <Field label="Bag number">
            <input className={inputCls} value={form.bagNumber} onChange={set('bagNumber')} maxLength={30} />
          </Field>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-ink-900">
              Pieces & dimensions <span className="font-medium text-slate-500">(cm)</span>
            </p>
            <button
              type="button"
              onClick={() => setPieces([...pieces, { ...emptyPiece }])}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-brand-500 hover:bg-brand-50"
            >
              <Plus size={16} /> Add piece
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {pieces.map((p, i) => (
              <div key={i}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-16 text-xs font-semibold text-slate-500">Piece {i + 1}</span>
                  {['length', 'width', 'height'].map((k, n) => (
                    <input
                      key={k}
                      data-field={n === 0 ? `piece.${i}` : undefined}
                      type="number"
                      min="0"
                      step="any"
                      placeholder={k[0].toUpperCase() + k.slice(1)}
                      value={p[k]}
                      onChange={setPiece(i, k)}
                      className={`${cls(`piece.${i}`)} w-24`}
                    />
                  ))}
                  <span className="w-28 text-xs text-slate-500">= {kg(pieceVolumetric(p))}</span>
                  {pieces.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setPieces(pieces.filter((_, j) => j !== i))}
                      aria-label={`Remove piece ${i + 1}`}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-accent-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                {errors[`piece.${i}`] && (
                  <p role="alert" className="mt-1 text-xs font-medium text-accent-600">
                    {errors[`piece.${i}`]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Actual weight (KG)" required error={errors.actualWeight}>
            <input
              data-field="actualWeight"
              className={cls('actualWeight')}
              type="number"
              min="0"
              step="any"
              value={form.actualWeight}
              onChange={set('actualWeight')}
              required
            />
          </Field>
          <Field label="Declared value (USD)" error={errors.declaredValue} hint={itemsValue > 0 ? 'Total of the customs items below' : undefined}>
            <input
              data-field="declaredValue"
              className={cls('declaredValue')}
              type="number"
              min="0"
              step="0.01"
              value={itemsValue > 0 ? itemsValue.toFixed(2) : form.declaredValue}
              onChange={set('declaredValue')}
              readOnly={itemsValue > 0}
            />
          </Field>
          <div className="rounded-xl bg-slate-50 px-4 py-2.5 sm:col-span-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-slate-500">Pieces</p>
                <p className="font-bold text-ink-900">{pieces.length}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Volumetric</p>
                <p className="font-bold text-ink-900">{kg(weights.volumetric)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Chargeable</p>
                <p className="font-bold text-accent-500">{kg(weights.chargeable)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Field label="Product detail" required error={errors.productDetail}>
            <input data-field="productDetail" className={cls('productDetail')} value={form.productDetail} onChange={set('productDetail')} maxLength={255} required />
          </Field>
          <Field label="Comments">
            <input className={inputCls} value={form.comments} onChange={set('comments')} maxLength={255} />
          </Field>
        </div>

        <label className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-ink-900">
          <input type="checkbox" checked={form.fragile} onChange={set('fragile')} className="h-4 w-4 accent-accent-500" />
          Fragile
        </label>
      </Card>

      <Card title="Customs invoice items">
        <p className="-mt-2 mb-4 text-xs text-slate-500">
          Printed on the customs invoice that goes with the AWB. You can also fill these in later from the AWB page.
        </p>
        <CustomsItems invoiceType={invoiceType} onInvoiceTypeChange={setInvoiceType} items={items} onItemsChange={setItems} errors={errors} />
      </Card>

      {(error || errorCount > 0) && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent-600">
          {error || `Please fix ${errorCount} ${errorCount === 1 ? 'field' : 'fields'} marked in red.`}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <Link to="/admin/awb" className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold hover:bg-slate-100">
          Cancel
        </Link>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 hover:bg-accent-600 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save & generate AWB'}
        </button>
      </div>
    </form>
  )
}
