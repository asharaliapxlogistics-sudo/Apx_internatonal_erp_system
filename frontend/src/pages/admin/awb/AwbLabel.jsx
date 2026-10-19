import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import ShippingLabel from '../../../components/awb/ShippingLabel'
import LoadState from '../../../components/LoadState'
import { useApi } from '../../../hooks/useApi'
import { getAwb } from '../../../lib/awb'

export default function AwbLabel() {
  const { number } = useParams()
  const { data: awb, error, reload } = useApi(() => getAwb(number), [number])

  if (!awb) return <LoadState error={error} onRetry={reload} />

  return (
    <div className="space-y-6">
      {/* One 4x6 inch sticker per page, no browser header/footer */}
      <style>{'@page { size: 4in 6in; margin: 0; } @media print { .print-area { width: 4in !important; } }'}</style>
      <div className="no-print flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            to={`/admin/awb/${awb.number}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-ink-900"
          >
            <ArrowLeft size={16} /> AWB {awb.number}
          </Link>
          <h1 className="mt-2 text-3xl font-extrabold text-ink-900">Shipping label</h1>
          <p className="mt-1 text-sm text-slate-500">4 x 6 inch (102 x 152 mm) sticker</p>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 self-start rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 hover:bg-accent-600 sm:self-auto"
        >
          <Printer size={16} /> Print label
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100 p-6">
        <div className="print-area mx-auto w-max shadow-lg print:shadow-none">
          <ShippingLabel awb={awb} />
        </div>
      </div>
    </div>
  )
}
