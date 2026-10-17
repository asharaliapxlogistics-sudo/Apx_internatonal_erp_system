import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ListChecks, ScrollText, Search, X } from 'lucide-react'
import LoadState from '../../../components/LoadState'
import StatusUpdate, { StatusBadge } from '../../../components/tracking/StatusUpdate'
import { useCustomerFilter } from '../../../context/CustomerFilter'
import { useApi } from '../../../hooks/useApi'
import { STATUS_GROUPS, carrierFor, formatDateTime, listShipments, setCarrierTracking, statusInfo } from '../../../lib/tracking'

// The delivery partner's number, typed straight into the list during the nightly update. Enter or leaving the box saves.
function CarrierCell({ shipment, onSaved }) {
  const [value, setValue] = useState(shipment.carrierTracking)
  const [state, setState] = useState('') // '' | saving | saved | error
  const carrier = carrierFor(shipment)
  const label = carrier || 'Carrier'

  async function save() {
    const next = value.trim()
    if (next === shipment.carrierTracking) return setValue(next)
    setState('saving')
    try {
      onSaved(await setCarrierTracking(shipment.awb.number, { carrier, carrierTracking: next }))
      setState('saved')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="w-44">
      <input
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setState('')
        }}
        onBlur={save}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        placeholder={`${label} no…`}
        aria-label={`${label} number for AWB ${shipment.awb.number}`}
        className={`w-full rounded-lg border px-2 py-1 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none ${
          state === 'error' ? 'border-accent-500' : 'border-transparent bg-slate-50 hover:border-slate-300'
        }`}
      />
      <p className={`mt-0.5 text-xs ${state === 'error' ? 'text-accent-600' : state === 'saved' ? 'text-emerald-600' : 'text-slate-500'}`}>
        {state === 'saving' ? 'Saving…' : state === 'saved' ? `${label} · saved` : state === 'error' ? 'Not saved, try again' : label}
      </p>
    </div>
  )
}

// Days since booking (until delivery for delivered shipments).
function daysOpen(s) {
  const end = s.status === 'Delivered' ? new Date(s.last.at) : new Date()
  return Math.max(0, Math.floor((end - new Date(s.awb.createdAt)) / 86400000))
}

export default function ShipmentList() {
  const { customerId } = useCustomerFilter()
  const { data, error, reload, setData } = useApi(() => listShipments(), [])
  const replace = (updated) => setData((list) => list.map((s) => (s.awb.number === updated.awb.number ? updated : s)))
  const [group, setGroup] = useState('open')
  const [query, setQuery] = useState('')
  const [showUpdate, setShowUpdate] = useState(false)
  const [picked, setPicked] = useState([])
  const [notice, setNotice] = useState('')

  const all = data ?? []
  const mine = all.filter((s) => !customerId || s.awb.customerId === customerId)
  const countOf = (g) => mine.filter((s) => statusInfo(s.status).group === g).length
  const openCount = mine.filter((s) => statusInfo(s.status).group !== 'delivered').length
  const q = query.trim().toLowerCase()
  const shown = mine.filter(
    (s) =>
      (group === 'all' || (group === 'open' ? statusInfo(s.status).group !== 'delivered' : statusInfo(s.status).group === group)) &&
      (!q ||
        [s.awb.number, s.carrierTracking, s.awb.shipper.name, s.awb.consignee.name, s.awb.consignee.city, s.awb.consignee.country]
          .join(' ')
          .toLowerCase()
          .includes(q)),
  )

  const selected = new Set(picked)
  const allShownSelected = shown.length > 0 && shown.every((s) => selected.has(s.awb.number))

  function setSelected(next) {
    setPicked([...next])
    if (next.size) setShowUpdate(true)
  }

  function toggle(number) {
    const next = new Set(selected)
    if (next.has(number)) next.delete(number)
    else next.add(number)
    setSelected(next)
  }

  function toggleAll() {
    const next = new Set(selected)
    shown.forEach((s) => (allShownSelected ? next.delete(s.awb.number) : next.add(s.awb.number)))
    setSelected(next)
  }

  function handleSaved(numbers) {
    reload()
    setPicked([])
    setNotice(`${numbers.length} ${numbers.length === 1 ? 'shipment' : 'shipments'} updated.`)
  }

  const chips = [['open', 'Open', openCount], ...STATUS_GROUPS.map(([g, label]) => [g, label, countOf(g)]), ['all', 'All', mine.length]]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-ink-900">Shipments & Tracking</h1>
          <p className="mt-1 text-sm text-slate-500">Every airway bill is a shipment. Record each step until it is delivered.</p>
        </div>
        <button
          onClick={() => setShowUpdate((v) => !v)}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-white shadow-lg shadow-accent-500/25 hover:bg-accent-600"
        >
          <ListChecks size={18} /> Update status
        </button>
      </div>

      {showUpdate && (
        <section className="rounded-2xl border border-brand-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-ink-900">Update status</h2>
            <button
              onClick={() => setShowUpdate(false)}
              className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-ink-900"
            >
              <X size={16} /> Close
            </button>
          </div>
          <StatusUpdate
            selected={picked}
            onSelectedChange={setPicked}
            shipments={mine}
            onSaved={handleSaved}
            locations={all.flatMap((s) => s.events.map((e) => e.location))}
          />
        </section>
      )}

      {notice && (
        <p role="status" className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {notice}
          <button onClick={() => setNotice('')} aria-label="Dismiss">
            <X size={16} />
          </button>
        </p>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-2">
          {chips.map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => setGroup(key)}
              className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                group === key ? 'bg-ink-950 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-100'
              }`}
            >
              {label} <span className={group === key ? 'text-slate-300' : 'text-slate-400'}>{count}</span>
            </button>
          ))}
        </div>
        <div className="relative lg:ml-auto lg:w-80">
          <Search size={18} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search AWB, carrier no, name, city…"
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pr-4 pl-11 text-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
          />
        </div>
      </div>

      {!data ? (
        <LoadState error={error} onRetry={reload} />
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <ScrollText size={36} className="text-slate-300" />
          <p className="mt-4 font-semibold text-ink-900">{mine.length ? 'No shipments match' : 'No shipments yet'}</p>
          {!mine.length && (
            <Link to="/admin/awb/new" className="mt-2 text-sm font-semibold text-brand-500 hover:text-accent-500">
              Create an airway bill to start a shipment
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" checked={allShownSelected} onChange={toggleAll} aria-label="Select all shown" className="h-4 w-4 accent-accent-500" />
                </th>
                <th className="px-3 py-3">AWB #</th>
                <th className="px-3 py-3">Consignee</th>
                <th className="px-3 py-3">Destination</th>
                <th className="px-3 py-3">Carrier no</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Last update</th>
                <th className="px-3 py-3 text-right">Days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((s) => (
                <tr key={s.awb.number} className={selected.has(s.awb.number) ? 'bg-brand-50/60' : 'hover:bg-slate-50'}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(s.awb.number)}
                      onChange={() => toggle(s.awb.number)}
                      aria-label={`Select AWB ${s.awb.number}`}
                      className="h-4 w-4 accent-accent-500"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <Link to={`/admin/shipments/${s.awb.number}`} className="font-bold text-brand-500 hover:text-accent-500">
                      {s.awb.number}
                    </Link>
                    <p className="text-xs text-slate-500">{s.awb.shipper.name}</p>
                  </td>
                  <td className="px-3 py-3">{s.awb.consignee.name}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {s.awb.consignee.city}
                    <p className="text-xs text-slate-500">{s.awb.consignee.country}</p>
                  </td>
                  <td className="px-3 py-2">
                    <CarrierCell shipment={s} onSaved={replace} />
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-slate-600">
                    {formatDateTime(s.last.at)}
                    {s.last.location && <p className="text-xs text-slate-500">{s.last.location}</p>}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold">{daysOpen(s)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
