import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Printer, Trash2, Wallet } from 'lucide-react'
import InvoiceSheet from '../../../components/billing/InvoiceSheet'
import LoadState from '../../../components/LoadState'
import { useDialog } from '../../../context/Dialog'
import { useApi } from '../../../hooks/useApi'
import { PAYMENT_METHODS,addPayment, deleteInvoice, getInvoice, invoiceTotals, money, shortDate } from '../../../lib/invoices'

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none'

const statusCls = {
  Paid: 'bg-emerald-50 text-emerald-700',
  Partial: 'bg-amber-50 text-amber-700',
  Unpaid: 'bg-red-50 text-accent-600',
}

export default function InvoiceView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { confirm } = useDialog()
  const { data: invoice, error: loadError, reload, setData: setInvoice } = useApi(() => getInvoice(id), [id])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showPay, setShowPay] = useState(false)
  const [pay, setPay] = useState({ date: new Date().toISOString().slice(0, 10), amount: '', method: 'Bank transfer', reference: '' })

  if (loadError?.status === 404) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <p className="font-semibold text-ink-900">Invoice not found</p>
        <Link to="/admin/billing" className="mt-3 inline-block text-sm font-semibold text-brand-500">
          Back to Billing & Invoices
        </Link>
      </div>
    )
  }

  if (!invoice) return <LoadState error={loadError} onRetry={reload} />

  const t = invoiceTotals(invoice)

  async function handlePay(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      setInvoice(await addPayment(invoice.id, { ...pay, amount: Number(pay.amount) }))
      setPay({ ...pay, amount: '', reference: '' })
      setShowPay(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: `Delete invoice ${invoice.number}?`,
      message: 'The invoice and its payments will be removed permanently. This cannot be undone.',
      confirmText: 'Delete',
      danger: true,
    })
    if (!ok) return
    setError('')
    try {
      await deleteInvoice(invoice.id)
      navigate('/admin/billing', { replace: true })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-6">
      {/* margin 0 stops the browser printing its own date/time/title header; spacing comes from .print-area */}
      <style>{'@page { size: A4 portrait; margin: 0; } @media print { .print-area { padding: 10mm 12mm; } }'}</style>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link to="/admin/billing" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-ink-900">
            <ArrowLeft size={16} /> Billing & Invoices
          </Link>
          <h1 className="mt-2 flex flex-wrap items-center gap-3 text-3xl font-extrabold text-ink-900">
            {invoice.number}
            <span className={`rounded-full px-3 py-1 text-sm font-bold ${statusCls[t.status]}`}>{t.status}</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {invoice.customerName} · {invoice.accountNo}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-accent-600 hover:bg-red-50"
          >
            <Trash2 size={16} /> Delete
          </button>
          {t.outstanding > 0 && (
            <button
              onClick={() => setShowPay((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-100"
            >
              <Wallet size={16} /> Record payment
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 hover:bg-accent-600"
          >
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ['Total payable', t.payable],
          ['Paid', t.paid],
          ['Outstanding', t.outstanding],
          ['This month', t.total],
        ].map(([label, v]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase">{label}</p>
            <p className={`mt-1 text-xl font-extrabold ${label === 'Outstanding' && v > 0 ? 'text-accent-500' : 'text-ink-900'}`}>
              Rs {money(v)}
            </p>
          </div>
        ))}
      </div>

      {error && (
        <p role="alert" className="no-print rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent-600">
          {error}
        </p>
      )}

      {showPay && (
        <form onSubmit={handlePay} className="grid gap-3 rounded-2xl border border-brand-100 bg-brand-50/50 p-5 sm:grid-cols-5 sm:items-end">
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Date</span>
            <input type="date" className={`${inputCls} mt-1`} value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} required />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Amount (PKR)</span>
            <input
              type="number"
              min="1"
              step="any"
              placeholder={String(t.outstanding)}
              className={`${inputCls} mt-1`}
              value={pay.amount}
              onChange={(e) => setPay({ ...pay, amount: e.target.value })}
              required
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Method</span>
            <select className={`${inputCls} mt-1`} value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Reference / cheque #</span>
            <input className={`${inputCls} mt-1`} value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} />
          </label>
          <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink-800 disabled:opacity-60">
            <Plus size={16} /> Save payment
          </button>
        </form>
      )}

      {invoice.payments?.length > 0 && (
        <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 px-5 py-3 font-bold text-ink-900">Payments</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {invoice.payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-2.5 whitespace-nowrap text-slate-500">{shortDate(p.date)}</td>
                  <td className="px-5 py-2.5">{p.method}</td>
                  <td className="px-5 py-2.5 text-slate-500">{p.reference}</td>
                  <td className="px-5 py-2.5 text-right font-bold text-emerald-700">Rs {money(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-6">
        <div className="print-area min-w-[900px]">
          <InvoiceSheet invoice={invoice} />
        </div>
      </div>
    </div>
  )
}
