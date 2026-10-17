import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Printer, X } from 'lucide-react'
import CustomsInvoice from '../../../components/awb/CustomsInvoice'
import CustomsItems from '../../../components/awb/CustomsItems'
import LoadState from '../../../components/LoadState'
import { useApi } from '../../../hooks/useApi'
import { INVOICE_TYPES, emptyItem, getAwb, itemErrors, setCustoms } from '../../../lib/awb'
import { focusFirstError } from '../../../lib/validation'

const toForm = (items) =>
  items.length
    ? items.map((i) => ({ ...i, quantity: String(i.quantity), unitPrice: String(i.unitPrice) }))
    : [{ ...emptyItem }]

// Items editor: AWBs are not edited after saving, but their customs invoice lines can be filled in or corrected here.
function EditItems({ awb, onSaved, onCancel }) {
  const [invoiceType, setInvoiceType] = useState(awb.invoiceType || 'Gift')
  const [items, setItems] = useState(() => toForm(awb.items))
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const errors = tried ? itemErrors(items) : {}

  async function handleSubmit(e) {
    e.preventDefault()
    setTried(true)
    setError('')
    const found = itemErrors(items)
    if (Object.keys(found).length) return setTimeout(() => focusFirstError(found))
    setSaving(true)
    try {
      onSaved(await setCustoms(awb.number, { invoiceType, items }))
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="no-print rounded-2xl border border-brand-200 bg-white p-5">
      <h2 className="mb-1 font-bold text-ink-900">Customs invoice items</h2>
      <p className="mb-4 text-xs text-slate-500">With items, the AWB&apos;s declared value becomes the invoice total.</p>
      <CustomsItems invoiceType={invoiceType} onInvoiceTypeChange={setInvoiceType} items={items} onItemsChange={setItems} errors={errors} />
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent-600">
          {error}
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-ink-950 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save items'}
        </button>
      </div>
    </form>
  )
}

export default function AwbInvoice() {
  const { number } = useParams()
  const { data: awb, error, reload, setData } = useApi(() => getAwb(number), [number])
  const [editing, setEditing] = useState(false)
  const [typeState, setTypeState] = useState('') // '' | saving | error

  if (!awb) return <LoadState error={error} onRetry={reload} />

  // Gift or Commercial: saved straight away, the items stay as they are.
  async function changeType(e) {
    setTypeState('saving')
    try {
      setData(await setCustoms(awb.number, { invoiceType: e.target.value, items: awb.items }))
      setTypeState('')
    } catch {
      setTypeState('error')
    }
  }

  return (
    <div className="space-y-6">
      <style>{'@page { size: A4 portrait; margin: 0; } @media print { .print-area { padding: 10mm 12mm; } }'}</style>
      <div className="no-print flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to={`/admin/awb/${awb.number}`} className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-ink-900">
            <ArrowLeft size={16} /> AWB {awb.number}
          </Link>
          <h1 className="mt-2 text-3xl font-extrabold text-ink-900">Customs invoice</h1>
          {!awb.items.length && (
            <p className="mt-1 text-sm text-slate-500">No items yet, so it shows the product detail and declared value. Add items for HS codes and quantities.</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
            {typeState === 'saving' ? 'Saving…' : typeState === 'error' ? <span className="text-accent-600">Not saved</span> : 'Invoice'}
            <select
              value={awb.invoiceType || 'Gift'}
              onChange={changeType}
              disabled={typeState === 'saving' || editing}
              aria-label="Invoice type"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-ink-900 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none disabled:opacity-60"
            >
              {INVOICE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t} invoice
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => setEditing((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-100"
          >
            {editing ? <X size={16} /> : <Pencil size={16} />} {editing ? 'Close' : awb.items.length ? 'Edit items' : 'Add items'}
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 hover:bg-accent-600"
          >
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      {editing && (
        <EditItems
          awb={awb}
          onCancel={() => setEditing(false)}
          onSaved={(saved) => {
            setData(saved)
            setEditing(false)
          }}
        />
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-6">
        <div className="print-area mx-auto max-w-[820px] min-w-[720px]">
          <CustomsInvoice awb={awb} />
        </div>
      </div>
    </div>
  )
}
