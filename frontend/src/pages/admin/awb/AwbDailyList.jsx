import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import LoadState from '../../../components/LoadState'
import { useAppSettings } from '../../../context/AppSettings'
import { useApi } from '../../../hooks/useApi'
import { calcWeights, listAwbs } from '../../../lib/awb'

// Local date as YYYY-MM-DD (the value format of <input type="date">).
const localDay = (d) => {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const longDay = (day) =>
  new Date(`${day}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

// End-of-day list of the AWBs booked on one day, to print and file.
export default function AwbDailyList() {
  const [today] = useState(() => localDay(new Date()))
  const [day, setDay] = useState(today)
  const { data, error, reload } = useApi(listAwbs, [])
  const settings = useAppSettings()
  const companyName = settings?.company?.name || 'APX INTERNATIONAL'

  if (!data) return <LoadState error={error} onRetry={reload} />

  // Oldest first, the order they were booked in. Voided AWBs are left off the list.
  const awbs = data
    .filter((a) => a.status !== 'Void' && localDay(new Date(a.createdAt)) === day)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  const voided = data.filter((a) => a.status === 'Void' && localDay(new Date(a.createdAt)) === day).length
  const totals = awbs.reduce(
    (t, a) => {
      t.pieces += a.pieces.length
      t.weight += calcWeights(a.pieces, a.actualWeight).chargeable
      return t
    },
    { pieces: 0, weight: 0 },
  )

  return (
    <div className="space-y-6">
      {/* margin 0 stops the browser printing its own date/time/title header; spacing comes from .print-area */}
      <style>{'@page { size: A4 portrait; margin: 0; } @media print { .print-area { padding: 10mm 10mm; } }'}</style>

      <div className="no-print flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to="/admin/awb" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-ink-900">
            <ArrowLeft size={16} /> Air Waybills
          </Link>
          <h1 className="mt-2 text-3xl font-extrabold text-ink-900">Daily Shipments</h1>
          <p className="mt-1 text-sm text-slate-500">Every AWB booked on the chosen day, ready to print at day end.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            aria-label="Day"
            value={day}
            max={today}
            onChange={(e) => e.target.value && setDay(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
          />
          <button
            onClick={() => window.print()}
            disabled={awbs.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink-800 disabled:opacity-40"
          >
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      <div className="print-area rounded-2xl border border-slate-200 bg-white p-6 print:rounded-none print:border-0 print:p-0">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-ink-900 pb-3">
          <div>
            <p className="text-xl font-extrabold text-ink-900">{companyName}</p>
            <p className="text-sm font-semibold text-slate-600">Daily Shipment List</p>
          </div>
          <p className="text-sm font-semibold text-ink-900">{longDay(day)}</p>
        </div>

        {awbs.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">No AWBs were booked on this day.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="mt-4 w-full border-collapse text-sm print:text-[11px]">
                <thead>
                  <tr className="border-b border-slate-300 text-left text-xs font-semibold text-slate-500 uppercase">
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">AWB #</th>
                    <th className="py-2 pr-3">Shipper</th>
                    <th className="py-2 pr-3">Consignee</th>
                    <th className="py-2 pr-3">Destination</th>
                    <th className="py-2 pr-3">Service</th>
                    <th className="py-2 pr-3 text-right">Pcs</th>
                    <th className="py-2 text-right">Weight (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {awbs.map((a, i) => (
                    <tr key={a.number} className="break-inside-avoid border-b border-slate-100 align-top">
                      <td className="py-2 pr-3 text-slate-400">{i + 1}</td>
                      <td className="py-2 pr-3 font-bold whitespace-nowrap text-ink-900">{a.number}</td>
                      <td className="py-2 pr-3">{a.shipper.name}</td>
                      <td className="py-2 pr-3 font-semibold text-ink-900">{a.consignee.name}</td>
                      <td className="py-2 pr-3">{[a.consignee.city, a.consignee.country].filter(Boolean).join(', ')}</td>
                      <td className="py-2 pr-3">{a.service}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{a.pieces.length}</td>
                      <td className="py-2 text-right tabular-nums">{calcWeights(a.pieces, a.actualWeight).chargeable}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-ink-900 font-bold text-ink-900">
                    <td className="py-2 pr-3" colSpan={6}>
                      Total: {awbs.length} {awbs.length === 1 ? 'shipment' : 'shipments'}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{totals.pieces}</td>
                    <td className="py-2 text-right tabular-nums">{Number(totals.weight.toFixed(3))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {voided > 0 && (
              <p className="mt-3 text-xs text-slate-500">
                {voided} voided {voided === 1 ? 'AWB is' : 'AWBs are'} not included.
              </p>
            )}
            <div className="mt-12 hidden grid-cols-2 gap-12 text-sm print:grid">
              <div className="border-t border-slate-400 pt-1">Prepared by</div>
              <div className="border-t border-slate-400 pt-1">Checked by</div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
