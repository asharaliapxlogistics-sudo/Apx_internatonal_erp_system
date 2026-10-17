import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Plus, Search, Trash2 } from 'lucide-react'
import LoadState from '../../../components/LoadState'
import { useDialog } from '../../../context/Dialog'
import { useApi } from '../../../hooks/useApi'
import { calcWeights, deleteAwb, kg, listAwbs } from '../../../lib/awb'

export default function AwbList() {
  const [query, setQuery] = useState('')
  const { data, error: loadError, reload } = useApi(listAwbs, [])
  const [error, setError] = useState('')
  const { confirm } = useDialog()
  const q = query.trim().toLowerCase()

  async function handleDelete(number) {
    const ok = await confirm({
      title: `Delete AWB ${number}?`,
      message: 'This airway bill and its tracking history will be removed permanently. This cannot be undone.',
      confirmText: 'Delete',
      danger: true,
    })
    if (!ok) return
    setError('')
    try {
      await deleteAwb(number)
      reload()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!data) return <LoadState error={loadError} onRetry={reload} />
  const all = data
  const awbs = all.filter(
    (a) =>
      !q ||
      [a.number, a.shipper.name, a.consignee.name, a.consignee.country, a.service]
        .join(' ')
        .toLowerCase()
        .includes(q),
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-ink-900">Air Waybills</h1>
          <p className="mt-1 text-sm text-slate-500">Create, print and void airway bills.</p>
        </div>
        <Link
          to="/admin/awb/new"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 hover:bg-accent-600"
        >
          <Plus size={18} /> New Airway Bill
        </Link>
      </div>

      <div className="relative max-w-md">
        <Search size={18} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search AWB, shipper, consignee, country…"
          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pr-4 pl-11 text-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent-600">
          {error}
        </p>
      )}

      {awbs.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <FileText size={36} className="text-slate-300" />
          <p className="mt-4 font-semibold text-ink-900">{q ? 'No matching airway bills' : 'No airway bills yet'}</p>
          {!q && (
            <Link to="/admin/awb/new" className="mt-2 text-sm font-semibold text-brand-500 hover:text-accent-500">
              Create the first one
            </Link>
          )}
        </div>
      ) : (
        <div className="relative overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">AWB #</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Shipper</th>
                <th className="px-4 py-3">Consignee</th>
                <th className="px-4 py-3">Destination</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3 text-right">Chargeable</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {awbs.map((a) => (
                <tr key={a.number} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link to={`/admin/awb/${a.number}`} className="font-bold text-brand-500 hover:text-accent-500">
                      {a.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                    {new Date(a.createdAt).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-4 py-3">{a.shipper.name}</td>
                  <td className="px-4 py-3">{a.consignee.name}</td>
                  <td className="px-4 py-3">{a.consignee.country}</td>
                  <td className="px-4 py-3">{a.service}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {kg(calcWeights(a.pieces, a.actualWeight).chargeable)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        a.status === 'Void' ? 'bg-red-50 text-accent-600' : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(a.number)}
                      aria-label={`Delete AWB ${a.number}`}
                      title="Delete"
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
    </div>
  )
}
