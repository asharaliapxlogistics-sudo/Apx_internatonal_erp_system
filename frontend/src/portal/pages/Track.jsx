import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MapPin, SearchX } from 'lucide-react'
import LoadState from '../../components/LoadState'
import { usePortalShipments } from '../data'
import { usePortalAccount } from '../PortalAccount'
import { Card, PageHeader, PreviewNote, ProgressSteps, StatusBadge, Timeline, btnPrimary, inputCls, shortDay } from '../ui'
import { CarrierLine, CopyLinkButton } from './Shipments'

const parse = (text) => [...new Set(text.split(/[\s,;]+/).map((n) => n.trim()).filter(Boolean))].slice(0, 25)

// One result card: used by the portal Track page and the public tracking page.
export function TrackResult({ number, shipment, showShare }) {
  if (!shipment) {
    return (
      <Card>
        <p className="flex items-center gap-2 font-bold text-ink-900">
          <SearchX size={18} className="text-slate-400" /> {number}
        </p>
        <p className="mt-1 text-sm text-slate-500">No shipment found with this number. Check the number on your airway bill.</p>
      </Card>
    )
  }
  const s = shipment
  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex flex-wrap items-center gap-2 text-lg font-extrabold text-ink-900">
            AWB {s.number} <StatusBadge status={s.status} />
          </p>
          <p className="text-sm text-slate-500">
            To {s.city}, {s.country} · booked {shortDay(s.date)} · {s.service}
          </p>
          <CarrierLine shipment={s} />
        </div>
        {showShare && <CopyLinkButton number={s.number} />}
      </div>
      <div className="my-5">
        <ProgressSteps status={s.status} />
      </div>
      <Timeline events={s.events} />
    </Card>
  )
}

export default function Track() {
  const [params, setParams] = useSearchParams()
  const [text, setText] = useState(() => (params.get('no') ?? '').split(',').join('\n'))
  const numbers = parse(params.get('no') ?? '')
  const { preview } = usePortalAccount()
  // Customers track their own shipments, so the list they already have covers it.
  const { data: shipments, error, reload } = usePortalShipments()

  return (
    <div className="space-y-6">
      {preview && <PreviewNote />}
      <PageHeader title="Track shipments" subtitle="Enter up to 25 AWB numbers, one per line or separated by commas." />
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const list = parse(text)
          setParams(list.length ? { no: list.join(',') } : {})
        }}
        className="rounded-2xl border border-slate-200 bg-white p-5"
      >
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'10257088\n10257084'}
          className={`${inputCls} font-mono`}
          aria-label="AWB numbers"
        />
        <div className="mt-3 flex justify-end">
          <button type="submit" className={btnPrimary}>
            <MapPin size={16} /> Track
          </button>
        </div>
      </form>

      {numbers.length > 0 && !shipments && <LoadState error={error} onRetry={reload} />}
      {numbers.length > 0 && shipments && (
        <div className="space-y-4">
          {numbers.map((n) => (
            <TrackResult key={n} number={n} shipment={shipments.find((s) => s.number === n || s.carrierTracking === n)} showShare />
          ))}
        </div>
      )}
      {numbers.length === 0 && (
        <p className="text-sm text-slate-500">
          Or open a shipment from your{' '}
          <Link to="/portal/shipments" className="font-semibold text-brand-500">
            shipments list
          </Link>
          .
        </p>
      )}
    </div>
  )
}
