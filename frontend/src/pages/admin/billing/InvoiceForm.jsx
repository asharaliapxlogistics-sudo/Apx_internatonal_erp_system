import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import Combobox from '../../../components/Combobox'
import { useCustomerFilter } from '../../../context/CustomerFilter'
import { getSession } from '../../../lib/auth'
import { calcWeights, listAwbs } from '../../../lib/awb'
import { NATURES, createInvoice, lastOutstanding, listInvoices, money } from '../../../lib/invoices'

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-ink-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none'

const emptyLine = { date: '', tracking: '', nature: 'WPX', service: '', country: '', consignee: '', weight: '', amount: '' }

function Field({ label, required, hint, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-semibold text-slate-600">
        {label}
        {required && <span className="text-accent-500"> *</span>}
      </span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  )
}

// Customer select value for an invoice without a customer account, billed from its AWBs.
const WALK_IN = 'walk-in'

const thisMonth = () => new Date().toISOString().slice(0, 7)
const newLine = (month) => ({ ...emptyLine, date: `${month}-01` })

// Invoice line filled from the customer's AWB; staff only add nature and amount.
const lineFromAwb = (awb) => ({
  date: new Date(awb.createdAt).toLocaleDateString('en-CA'),
  tracking: awb.number,
  service: awb.service,
  country: awb.consignee.country,
  consignee: awb.consignee.name,
  weight: String(calcWeights(awb.pieces, awb.actualWeight).chargeable),
})

export default function InvoiceForm() {
  const navigate = useNavigate()
  const { customerId: filterCustomerId, customers } = useCustomerFilter()

  const [customerId, setCustomerId] = useState(filterCustomerId ?? '')
  const walkIn = customerId === WALK_IN
  const [billTo, setBillTo] = useState('')
  const [month, setMonth] = useState(thisMonth)
  const [lines, setLines] = useState(() => [newLine(thisMonth())])
  const [prevBalance, setPrevBalance] = useState(0)
  const [received, setReceived] = useState(0)
  const [preparedBy, setPreparedBy] = useState(getSession()?.name ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // The customer's last outstanding balance carries over; staff can still edit it.
  useEffect(() => {
    let current = true
    if (!customerId || walkIn) return
    lastOutstanding(customerId).then(
      (v) => current && setPrevBalance(v),
      (err) => current && setError(`Could not load the previous balance: ${err.message}`),
    )
    return () => {
      current = false
    }
  }, [customerId, walkIn])

  // Tracking # is typed freely. Any active AWB number fills the line; this customer's AWBs
  // (linked, or made with their account no.) are suggested; for a walk-in, AWBs without an account.
  // Ones already on an invoice are flagged.
  const [awbs, setAwbs] = useState([])
  const [billed, setBilled] = useState({})
  useEffect(() => {
    let current = true
    if (!customerId) return
    Promise.all([listAwbs(), listInvoices(walkIn ? {} : { customerId })]).then(
      ([awbList, invoices]) => {
        if (!current) return
        setAwbs(awbList.filter((a) => a.status !== 'Void'))
        const map = {}
        for (const inv of invoices) for (const l of inv.lines) if (l.tracking) map[l.tracking] = inv.number
        setBilled(map)
      },
      (err) => current && setError(`Could not load the customer's airway bills: ${err.message}`),
    )
    return () => {
      current = false
    }
  }, [customerId, walkIn])

  const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
  const payable = total + (Number(prevBalance) || 0) - (Number(received) || 0)

  function pickCustomer(e) {
    const cid = e.target.value
    setCustomerId(cid)
    if (!cid || cid === WALK_IN) setPrevBalance(0)
    setAwbs([])
    setBilled({})
    // AWBs of the previous customer cannot stay on this invoice.
    setLines(lines.map((l) => (l.tracking ? { ...newLine(month), nature: l.nature, amount: l.amount } : l)))
  }

  const customer = customers.find((c) => c.id === customerId)
  // Unbilled AWBs first; billed ones stay in the list, marked with their invoice.
  const suggested = awbs.filter(
    (a) =>
      (walkIn
        ? !a.customerId && !a.accountNo
        : a.customerId === customerId || (customer && a.accountNo === customer.accountNo)),
  )
  const options = [...suggested.filter((a) => !billed[a.number]), ...suggested.filter((a) => billed[a.number])].map((a) => a.number)

  function typeTracking(i, value) {
    const awb = awbs.find((a) => a.number === value.trim())
    // A walk-in invoice is billed to the shipper of its first AWB unless a name was typed.
    if (awb && walkIn && !billTo.trim()) setBillTo(awb.shipper.company || awb.shipper.name)
    setLines(lines.map((l, j) => (j !== i ? l : awb ? { ...l, ...lineFromAwb(awb) } : { ...l, tracking: value })))
  }

  function pickMonth(e) {
    setMonth(e.target.value)
  }

  const setLine = (i, key) => (e) => setLines(lines.map((l, j) => (j === i ? { ...l, [key]: e.target.value } : l)))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (walkIn && !billTo.trim()) return setError('Enter the name to bill to.')
    if (!lines.length) return setError('Add at least one line to the invoice.')
    if (lines.some((l) => !l.tracking.trim())) return setError('Enter a tracking # for every line.')
    const numbers = lines.map((l) => l.tracking.trim())
    const dup = numbers.find((n, i) => numbers.indexOf(n) !== i)
    if (dup) return setError(`Tracking # ${dup} is on this invoice twice.`)
    if (lines.some((l) => l.amount === '' || l.amount === null)) return setError('Enter an amount for every line.')

    setSaving(true)
    try {
      const inv = await createInvoice({
        customerId: walkIn ? null : customerId,
        customerName: walkIn ? billTo : '',
        month, lines, prevBalance, received, preparedBy })
      navigate(`/admin/billing/${inv.id}`)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Link to="/admin/billing" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-ink-900">
          <ArrowLeft size={16} /> Billing & Invoices
        </Link>
        <h1 className="mt-2 text-3xl font-extrabold text-ink-900">New Invoice</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pick the customer and month, then enter each shipment of the month with its amount.
        </p>
      </div>

      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Customer" required className="lg:col-span-2">
          <select className={inputCls} value={customerId} onChange={pickCustomer} required>
            <option value="">Select customer…</option>
            <option value={WALK_IN}>No customer account (bill from AWB)</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.accountNo})
              </option>
            ))}
          </select>
        </Field>
        {walkIn && (
          <Field label="Bill to" required hint="Filled from the AWB's shipper; you can change it" className="lg:col-span-2">
            <input className={inputCls} value={billTo} onChange={(e) => setBillTo(e.target.value)} placeholder="Name or company" required />
          </Field>
        )}
        <Field label="Invoice month" required>
          <input type="month" className={inputCls} value={month} onChange={pickMonth} required />
        </Field>
        <Field label="Prepared by" hint="Printed at the bottom of the invoice">
          <input className={inputCls} value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} />
        </Field>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3">
          <h2 className="font-bold text-ink-900">
            Shipments <span className="text-sm font-medium text-slate-500">({lines.length})</span>
          </h2>
          <button
            type="button"
            onClick={() => setLines([...lines, newLine(month)])}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-brand-500 hover:bg-brand-50"
          >
            <Plus size={16} /> Add line
          </button>
        </div>

        {lines.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            No shipments yet. Use “Add line” to enter the month&apos;s shipments.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase">
                <tr>
                  <th className="w-10 px-3 py-2">#</th>
                  <th className="w-36 px-1 py-2">Date</th>
                  <th className="w-56 px-1 py-2">Tracking # *</th>
                  <th className="w-20 px-1 py-2">Nature</th>
                  <th className="px-1 py-2">Service</th>
                  <th className="px-1 py-2">Country</th>
                  <th className="px-1 py-2">Consignee</th>
                  <th className="w-20 px-1 py-2">Weight</th>
                  <th className="w-28 px-1 py-2">Amount *</th>
                  <th className="w-10 px-1 py-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-3 py-1.5 font-semibold text-slate-400">{i + 1}</td>
                    <td className="px-1 py-1.5">
                      <input type="date" className={inputCls} value={l.date} onChange={setLine(i, 'date')} required />
                    </td>
                    <td className="px-1 py-1.5">
                      <Combobox
                        className={inputCls}
                        value={l.tracking}
                        onChange={(v) => typeTracking(i, v)}
                        options={options.filter((n) => n === l.tracking || !lines.some((x) => x.tracking === n))}
                        describe={(n) => {
                          const a = awbs.find((x) => x.number === n)
                          if (!a) return ''
                          const info = `${a.consignee.name} · ${a.consignee.country} · ${a.service}`
                          return billed[n] ? `${info} · already on ${billed[n]}` : info
                        }}
                        emptyText={walkIn ? 'No AWBs without an account. Type the AWB #.' : 'No AWBs for this customer yet. Type the AWB #.'}
                        fixed
                        placeholder={customerId ? 'Type or pick AWB #' : 'Select customer first'}
                        disabled={!customerId}
                        required
                      />
                      {billed[l.tracking.trim()] && (
                        <span className="mt-0.5 block text-xs font-medium text-accent-500">
                          Already billed on {billed[l.tracking.trim()]}
                        </span>
                      )}
                    </td>
                    <td className="px-1 py-1.5">
                      <select className={inputCls} value={l.nature} onChange={setLine(i, 'nature')}>
                        {NATURES.map((n) => (
                          <option key={n}>{n}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-1 py-1.5">
                      <input className={inputCls} value={l.service} onChange={setLine(i, 'service')} />
                    </td>
                    <td className="px-1 py-1.5">
                      <input className={inputCls} value={l.country} onChange={setLine(i, 'country')} />
                    </td>
                    <td className="px-1 py-1.5">
                      <input className={inputCls} value={l.consignee} onChange={setLine(i, 'consignee')} />
                    </td>
                    <td className="px-1 py-1.5">
                      <input type="number" min="0" step="any" className={inputCls} value={l.weight} onChange={setLine(i, 'weight')} />
                    </td>
                    <td className="px-1 py-1.5">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className={`${inputCls} font-semibold`}
                        value={l.amount}
                        onChange={setLine(i, 'amount')}
                        required
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <button
                        type="button"
                        onClick={() => setLines(lines.filter((_, j) => j !== i))}
                        aria-label={`Remove line ${i + 1}`}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-accent-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="ml-auto max-w-md rounded-2xl border border-slate-200 bg-white p-5">
        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Total invoice amount</dt>
            <dd className="font-bold text-ink-900">Rs {money(total)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Previous balance</dt>
            <dd className="w-36">
              <input type="number" step="any" className={`${inputCls} text-right`} value={prevBalance} onChange={(e) => setPrevBalance(e.target.value)} />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Received amount</dt>
            <dd className="w-36">
              <input type="number" min="0" step="any" className={`${inputCls} text-right`} value={received} onChange={(e) => setReceived(e.target.value)} />
            </dd>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 pt-3">
            <dt className="font-bold text-ink-900">Total payable</dt>
            <dd className="text-lg font-extrabold text-accent-500">Rs {money(payable)}</dd>
          </div>
        </dl>
      </section>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent-600">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <Link to="/admin/billing" className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold hover:bg-slate-100">
          Cancel
        </Link>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 hover:bg-accent-600 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Create invoice'}
        </button>
      </div>
    </form>
  )
}
