import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, Trash2 } from 'lucide-react'
import Combobox from '../../../components/Combobox'
import LoadState from '../../../components/LoadState'
import StatusUpdate, { StatusBadge } from '../../../components/tracking/StatusUpdate'
import { useDialog } from '../../../context/Dialog'
import { useApi } from '../../../hooks/useApi'
import { calcWeights, kg } from '../../../lib/awb'
import { CARRIERS, deleteEvent, formatDateTime, getShipment, setCarrierTracking, statusInfo } from '../../../lib/tracking'

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none'

const DOT = {
  booked: 'bg-slate-400',
  transit: 'bg-sky-500',
  customs: 'bg-amber-500',
  delivered: 'bg-emerald-500',
  exception: 'bg-accent-500',
}

function Party({ title, party }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</p>
      <p className="mt-1 font-bold text-ink-900">{party.name}</p>
      <p className="text-sm text-slate-600">{party.address}</p>
      <p className="text-sm text-slate-600">
        {[party.city, party.zip, party.country].filter(Boolean).join(', ')}
      </p>
      {party.phone && <p className="text-sm text-slate-600">{party.phone}</p>}
    </div>
  )
}

function CarrierForm({ shipment, onSaved }) {
  const [carrier, setCarrier] = useState(shipment.carrier || 'DPD')
  const [carrierTracking, setTracking] = useState(shipment.carrierTracking)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const changed = carrier !== (shipment.carrier || 'DPD') || carrierTracking !== shipment.carrierTracking

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      onSaved(await setCarrierTracking(shipment.awb.number, { carrier: carrier.trim(), carrierTracking: carrierTracking.trim() }))
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-bold text-ink-900">Carrier tracking</h2>
      <p className="mt-1 text-xs text-slate-500">The delivery partner&apos;s own tracking number for this shipment.</p>
      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="text-xs font-semibold text-slate-600">Carrier</span>
          <div className="mt-1">
            <Combobox className={inputCls} options={CARRIERS} value={carrier} onChange={setCarrier} />
          </div>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-600">Tracking number(s)</span>
          <input className={`${inputCls} mt-1`} value={carrierTracking} onChange={(e) => setTracking(e.target.value)} placeholder="e.g. 15503801001528B" />
        </label>
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-accent-600">
          {error}
        </p>
      )}
      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={!changed || saving}
          className="rounded-xl bg-ink-950 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </form>
  )
}

export default function ShipmentView() {
  const { number } = useParams()
  const { confirm } = useDialog()
  const { data: shipment, error: loadError, reload, setData: setShipment } = useApi(() => getShipment(number), [number])
  const [error, setError] = useState('')

  if (loadError?.status === 404) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <p className="font-semibold text-ink-900">Shipment {number} not found, or its AWB is void</p>
        <Link to="/admin/shipments" className="mt-3 inline-block text-sm font-semibold text-brand-500">
          Back to Shipments
        </Link>
      </div>
    )
  }
  if (!shipment) return <LoadState error={loadError} onRetry={reload} />

  const { awb } = shipment
  const weights = calcWeights(awb.pieces, awb.actualWeight)
  const timeline = [...shipment.events].reverse()

  async function handleDeleteEvent(ev) {
    const ok = await confirm({
      title: 'Remove this update?',
      message: `"${ev.status}" on ${formatDateTime(ev.at)} will be removed from the history.`,
      confirmText: 'Remove',
      danger: true,
    })
    if (!ok) return
    setError('')
    try {
      await deleteEvent(number, ev.id)
      reload()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to="/admin/shipments" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-ink-900">
            <ArrowLeft size={16} /> Shipments
          </Link>
          <h1 className="mt-2 flex flex-wrap items-center gap-3 text-3xl font-extrabold text-ink-900">
            AWB {awb.number}
            <StatusBadge status={shipment.status} />
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {awb.service} · {awb.pieces.length} {awb.pieces.length === 1 ? 'piece' : 'pieces'} · {kg(weights.chargeable)} · booked{' '}
            {new Date(awb.createdAt).toLocaleDateString('en-GB')}
          </p>
        </div>
        <Link
          to={`/admin/awb/${awb.number}`}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold whitespace-nowrap hover:bg-slate-100"
        >
          <FileText size={16} /> View AWB
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
            <Party title="Shipper" party={awb.shipper} />
            <Party title="Consignee" party={awb.consignee} />
            {awb.productDetail && (
              <p className="text-sm text-slate-600 sm:col-span-2">
                <span className="font-semibold text-ink-900">Contents:</span> {awb.productDetail}
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 font-bold text-ink-900">Add update</h2>
            <StatusUpdate number={awb.number} onSaved={reload} locations={shipment.events.map((e) => e.location)} />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-5 font-bold text-ink-900">Tracking history</h2>
            {error && (
              <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent-600">
                {error}
              </p>
            )}
            <ol className="relative space-y-6 border-l-2 border-slate-100 pl-6">
              {timeline.map((ev, i) => (
                <li key={ev.id} className="relative">
                  <span
                    className={`absolute top-1 -left-[31px] h-4 w-4 rounded-full ring-4 ring-white ${DOT[statusInfo(ev.status).group]} ${
                      i === 0 ? '' : 'opacity-50'
                    }`}
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`font-bold ${i === 0 ? 'text-ink-900' : 'text-slate-600'}`}>{ev.status}</p>
                      <p className="text-sm text-slate-500">
                        {formatDateTime(ev.at)}
                        {ev.location && ` · ${ev.location}`}
                      </p>
                      {ev.remarks && <p className="mt-1 text-sm text-slate-700">{ev.remarks}</p>}
                      {ev.by && <p className="mt-0.5 text-xs text-slate-400">by {ev.by}</p>}
                    </div>
                    {!ev.auto && (
                      <button
                        onClick={() => handleDeleteEvent(ev)}
                        aria-label={`Remove ${ev.status} update`}
                        title="Remove"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-accent-500"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="h-fit space-y-6">
          <CarrierForm key={`${shipment.carrier}|${shipment.carrierTracking}`} shipment={shipment} onSaved={setShipment} />
        </aside>
      </div>
    </div>
  )
}
