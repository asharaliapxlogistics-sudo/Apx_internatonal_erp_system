import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, FileText, MapPin, Plus, Printer, RotateCcw, Trash2 } from 'lucide-react'
import AirwayBill from '../../../components/awb/AirwayBill'
import LoadState from '../../../components/LoadState'
import { useDialog } from '../../../context/Dialog'
import { useApi } from '../../../hooks/useApi'
import { deleteAwb, getAwb, restoreAwb, voidAwb } from '../../../lib/awb'

const COPIES = ['SHIPPER COPY', 'ACCOUNTS COPY', 'CONSIGNEE COPY', 'POD COPY']

export default function AwbView() {
  const { number } = useParams()
  const navigate = useNavigate()
  const { confirm, prompt } = useDialog()
  const { data: awb, error: loadError, reload, setData: setAwb } = useApi(() => getAwb(number), [number])
  const [copies, setCopies] = useState(COPIES)
  const [error, setError] = useState('')

  if (loadError?.status === 404) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <p className="font-semibold text-ink-900">AWB {number} not found</p>
        <Link to="/admin/awb" className="mt-3 inline-block text-sm font-semibold text-brand-500">
          Back to Air Waybills
        </Link>
      </div>
    )
  }
  if (!awb) return <LoadState error={loadError} onRetry={reload} />

  function toggleCopy(c) {
    setCopies((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : COPIES.filter((x) => x === c || cur.includes(x))))
  }

  async function handleVoid() {
    const reason = await prompt({
      title: `Void AWB ${awb.number}?`,
      message: 'The AWB stays on record and is marked VOID.',
      label: 'Reason',
      placeholder: 'e.g. Customer cancelled the shipment',
      confirmText: 'Void AWB',
      danger: true,
    })
    if (!reason) return
    setError('')
    try {
      setAwb(await voidAwb(awb.number, reason))
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleRestore() {
    const ok = await confirm({
      title: `Remove void from AWB ${awb.number}?`,
      message: 'The AWB becomes active again and shows in shipments, tracking, reports and the customer portal.',
      confirmText: 'Remove void',
    })
    if (!ok) return
    setError('')
    try {
      setAwb(await restoreAwb(awb.number))
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: `Delete AWB ${awb.number}?`,
      message: 'This airway bill and its tracking history will be removed permanently. This cannot be undone.',
      confirmText: 'Delete',
      danger: true,
    })
    if (!ok) return
    setError('')
    try {
      await deleteAwb(awb.number)
      navigate('/admin/awb', { replace: true })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-6">
      {/* margin 0 stops the browser printing its own date/time/title header; spacing comes from .print-area */}
      <style>{'@page { size: A4 landscape; margin: 0; } @media print { .print-area { padding: 0 8mm; } }'}</style>
      <div className="no-print flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link to="/admin/awb" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-ink-900">
            <ArrowLeft size={16} /> Air Waybills
          </Link>
          <h1 className="mt-2 flex items-center gap-3 text-3xl font-extrabold text-ink-900">
            AWB {awb.number}
            {awb.status === 'Void' && (
              <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-bold text-accent-600">Void</span>
            )}
          </h1>
          {awb.status === 'Void' && <p className="mt-1 text-sm text-slate-500">Reason: {awb.voidReason}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/awb/new"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-100"
          >
            <Plus size={16} /> New AWB
          </Link>
          {awb.status !== 'Void' && (
            <Link
              to={`/admin/shipments/${awb.number}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-100"
            >
              <MapPin size={16} /> Track
            </Link>
          )}
          <Link
            to={`/admin/awb/${awb.number}/invoice`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-100"
          >
            <FileText size={16} /> Customs invoice
          </Link>
          {awb.status !== 'Void' && (
            <button
              onClick={handleVoid}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-accent-600 hover:bg-red-50"
            >
              <Ban size={16} /> Void
            </button>
          )}
          {awb.status === 'Void' && (
            <button
              onClick={handleRestore}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              <RotateCcw size={16} /> Remove void
            </button>
          )}
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-accent-600 hover:bg-red-50"
          >
            <Trash2 size={16} /> Delete
          </button>
          <button
            onClick={() => window.print()}
            disabled={!copies.length}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 hover:bg-accent-600 disabled:opacity-50"
          >
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="no-print rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent-600">
          {error}
        </p>
      )}

      <div className="no-print flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-slate-200 bg-white px-5 py-3">
        <span className="text-sm font-semibold text-ink-900">Copies to print</span>
        {COPIES.map((c) => (
          <label key={c} className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={copies.includes(c)} onChange={() => toggleCopy(c)} className="h-4 w-4 accent-accent-500" />
            {c.replace(' COPY', '')}
          </label>
        ))}
        <span className="text-xs text-slate-400">A4 landscape, 2 copies per page</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4">
        <div className="print-area min-w-[1000px] space-y-4">
          {copies.map((c, i) => (
            <div
              key={c}
              className={`${i % 2 === 0 ? 'print-page-start' : ''} ${i % 2 === 1 && i < copies.length - 1 ? 'print-page-break' : ''}`}
            >
              <AirwayBill awb={awb} copyLabel={c} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
