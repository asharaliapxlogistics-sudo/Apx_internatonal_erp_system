import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, Copy, ExternalLink, MapPin, MessageSquareWarning, Package, Search, Share2 } from 'lucide-react'
import LoadState from '../../components/LoadState'
import { STATUS_GROUPS, carrierLink, statusInfo } from '../../lib/tracking'
import { usePortalShipment, usePortalShipments } from '../data'
import { usePortalAccount } from '../PortalAccount'
import { Card, Empty, PageHeader, PreviewNote, ProgressSteps, StatusBadge, Timeline, btnSecondary, inputCls, shortDay } from '../ui'

export const publicTrackingLink = (number) => `${window.location.origin}/track?no=${encodeURIComponent(number)}`

// The delivery partner's own number (e.g. DPD), once APX staff enter it, with a link to the partner's tracking.
export function CarrierLine({ shipment }) {
  if (!shipment.carrierTracking) return null
  const site = carrierLink(shipment.carrier, shipment.carrierTracking, shipment.service)
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-slate-600">
      <span>
        {shipment.carrier || 'Carrier'} tracking: <span className="font-mono font-semibold text-ink-900">{shipment.carrierTracking}</span>
      </span>
      {site && (
        <a href={site.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-500 hover:text-accent-500">
          Track on {site.name} <ExternalLink size={14} />
        </a>
      )}
    </p>
  )
}

export function CopyLinkButton({ number, className = btnSecondary }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(publicTrackingLink(number))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this tracking link:', publicTrackingLink(number))
    }
  }
  return (
    <button type="button" onClick={copy} className={className} title="Copy a link your consignee can open without signing in">
      {copied ? <Check size={16} /> : <Share2 size={16} />} {copied ? 'Link copied' : 'Share tracking link'}
    </button>
  )
}

export function ShipmentList() {
  const { preview } = usePortalAccount()
  const { data: shipments, error, reload } = usePortalShipments()
  const [params, setParams] = useSearchParams()
  const group = params.get('group') ?? 'all'
  const [query, setQuery] = useState('')
  if (!shipments) return <LoadState error={error} onRetry={reload} />

  const q = query.trim().toLowerCase()
  const shown = shipments.filter(
    (s) =>
      (group === 'all' || statusInfo(s.status).group === group) &&
      (!q || [s.number, s.consignee, s.city, s.country, s.contents, s.reference].join(' ').toLowerCase().includes(q)),
  )
  const chips = [['all', 'All', shipments.length], ...STATUS_GROUPS.map(([g, l]) => [g, l, shipments.filter((s) => statusInfo(s.status).group === g).length])]

  return (
    <div className="space-y-6">
      {preview && <PreviewNote />}
      <PageHeader
        title="Shipments"
        subtitle="Every shipment booked on your account."
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-2">
          {chips.map(([key, label, n]) => (
            <button
              key={key}
              onClick={() => setParams(key === 'all' ? {} : { group: key })}
              className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                group === key ? 'bg-ink-950 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-100'
              }`}
            >
              {label} <span className={group === key ? 'text-slate-300' : 'text-slate-400'}>{n}</span>
            </button>
          ))}
        </div>
        <div className="relative lg:ml-auto lg:w-80">
          <Search size={18} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="AWB, consignee, city…" className={`${inputCls} pl-11`} />
        </div>
      </div>

      {shown.length === 0 ? (
        <Empty icon={Package} title={shipments.length ? 'No shipments match' : 'No shipments yet'}>
          {!shipments.length && 'Shipments booked on your account will show up here.'}
        </Empty>
      ) : (
        <>
        {/* Phones: one card per shipment */}
        <ul className="space-y-3 sm:hidden">
          {shown.map((s) => (
            <li key={s.number}>
              <Link to={`/portal/shipments/${s.number}`} className="block rounded-2xl border border-slate-200 bg-white p-4 active:bg-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold text-brand-500">{s.number}</p>
                  <StatusBadge status={s.status} />
                </div>
                <p className="mt-1 font-semibold text-ink-900">{s.consignee}</p>
                <p className="text-sm text-slate-600">
                  {s.city}, {s.country}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {shortDay(s.date)} · {s.service} · {s.pieces} pcs / {s.weight} kg
                </p>
              </Link>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white sm:block">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">AWB #</th>
                <th className="px-4 py-3">Booked</th>
                <th className="px-4 py-3">Consignee</th>
                <th className="px-4 py-3">Destination</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3 text-right">Pcs / kg</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((s) => (
                <tr key={s.number} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link to={`/portal/shipments/${s.number}`} className="font-bold text-brand-500 hover:text-accent-500">
                      {s.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">{shortDay(s.date)}</td>
                  <td className="px-4 py-3">{s.consignee}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {s.city}
                    <p className="text-xs text-slate-500">{s.country}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{s.service}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {s.pieces} / {s.weight}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  )
}

export function ShipmentDetail() {
  const { number } = useParams()
  const { preview } = usePortalAccount()
  const { data: s, error, reload } = usePortalShipment(number)

  if (s === undefined) return <LoadState error={error} onRetry={reload} />
  if (!s) {
    return (
      <Empty icon={Package} title={`Shipment ${number} not found`}>
        <Link to="/portal/shipments" className="font-semibold text-brand-500">
          Back to shipments
        </Link>
      </Empty>
    )
  }

  const last = s.events[s.events.length - 1]
  return (
    <div className="space-y-6">
      {preview && <PreviewNote />}
      <div>
        <Link to="/portal/shipments" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-ink-900">
          <ArrowLeft size={16} /> Shipments
        </Link>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="flex flex-wrap items-center gap-3 text-2xl font-extrabold text-ink-900 sm:text-3xl">
              AWB {s.number} <StatusBadge status={s.status} />
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Booked {shortDay(s.date)} · {s.service} · {s.pieces} {s.pieces === 1 ? 'piece' : 'pieces'} · {s.weight} kg
            </p>
            <CarrierLine shipment={s} />
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyLinkButton number={s.number} />
            <Link to={`/portal/complaints?new=1&awb=${encodeURIComponent(s.number)}`} className={btnSecondary}>
              <MessageSquareWarning size={16} /> Report a problem
            </Link>
          </div>
        </div>
      </div>

      <Card>
        <ProgressSteps status={s.status} />
        <p className="mt-4 text-sm text-slate-600">
          <MapPin size={14} className="mr-1 inline text-accent-500" />
          Latest: <b>{last.status}</b>
          {last.location && ` at ${last.location}`}
          {last.remarks && ` — ${last.remarks}`}
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Tracking history" className="lg:col-span-2">
          <Timeline events={s.events} />
        </Card>
        <div className="space-y-6">
          <Card title="Consignee">
            <p className="font-bold text-ink-900">{s.consignee}</p>
            <p className="text-sm text-slate-600">
              {s.city}, {s.country}
            </p>
            <p className="mt-3 text-sm text-slate-600">
              <span className="font-semibold text-ink-900">Contents:</span> {s.contents}
            </p>
            {s.reference && (
              <p className="mt-1 text-sm text-slate-600">
                <span className="font-semibold text-ink-900">Your reference:</span> {s.reference}
              </p>
            )}
          </Card>
          <Card title="Share with your consignee" subtitle="They can follow the shipment without an account.">
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <Copy size={14} className="shrink-0" />
              <span className="truncate">{publicTrackingLink(s.number)}</span>
            </div>
            <CopyLinkButton number={s.number} className={`${btnSecondary} mt-3 w-full`} />
          </Card>
        </div>
      </div>
    </div>
  )
}
