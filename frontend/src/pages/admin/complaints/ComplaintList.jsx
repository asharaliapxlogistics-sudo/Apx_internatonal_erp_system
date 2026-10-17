import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquareWarning, Search } from 'lucide-react'
import { ComplaintStatus } from '../../../components/complaints/Thread'
import LoadState from '../../../components/LoadState'
import { useCustomerFilter } from '../../../context/CustomerFilter'
import { useApi } from '../../../hooks/useApi'
import { COMPLAINT_STATUSES, listComplaints, when } from '../../../lib/complaints'

const TABS = [['active', 'Not resolved'], ...COMPLAINT_STATUSES.map((s) => [s, s]), ['all', 'All']]

// Complaints customers raised from their portal.
export default function ComplaintList() {
  const { customerId } = useCustomerFilter()
  const [tab, setTab] = useState('active')
  const [query, setQuery] = useState('')
  const { data, error, reload } = useApi(() => listComplaints({ customerId }), [customerId])
  if (!data) return <LoadState error={error} onRetry={reload} />

  const count = (t) => data.filter((c) => (t === 'all' ? true : t === 'active' ? c.status !== 'Resolved' : c.status === t)).length
  const q = query.trim().toLowerCase()
  const rows = data.filter(
    (c) =>
      (tab === 'all' || (tab === 'active' ? c.status !== 'Resolved' : c.status === tab)) &&
      (!q || [c.number, c.customerName, c.accountNo, c.awbNumber, c.subject].join(' ').toLowerCase().includes(q)),
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-ink-900">Complaints</h1>
        <p className="mt-1 text-sm text-slate-500">Problems customers raised from their portal. Reply and mark them resolved here.</p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-2">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                tab === key ? 'bg-ink-950 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-100'
              }`}
            >
              {label} <span className={tab === key ? 'text-slate-300' : 'text-slate-400'}>{count(key)}</span>
            </button>
          ))}
        </div>
        <div className="relative lg:ml-auto lg:w-80">
          <Search size={18} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customer, AWB, subject…"
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pr-4 pl-11 text-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <MessageSquareWarning size={36} className="text-slate-300" />
          <p className="mt-4 font-semibold text-ink-900">{data.length ? 'No complaints here' : 'No complaints yet'}</p>
        </div>
      ) : (
        <>
        {/* Phones: one card per complaint */}
        <ul className="space-y-3 sm:hidden">
          {rows.map((c) => (
            <li key={c.id}>
              <Link to={`/admin/complaints/${c.id}`} className="block rounded-2xl border border-slate-200 bg-white p-4 active:bg-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold text-brand-500">{c.number}</p>
                  <ComplaintStatus status={c.status} />
                </div>
                <p className="mt-1 font-semibold text-ink-900">{c.subject}</p>
                <p className="text-sm text-slate-600">
                  {c.customerName} · {c.accountNo}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {c.awbNumber ? `AWB ${c.awbNumber} · ` : ''}
                  {when(c.lastMessageAt)} · {c.lastFromStaff ? 'APX' : 'Customer'}
                </p>
                {!c.lastFromStaff && c.status !== 'Resolved' && (
                  <span className="mt-2 inline-block rounded-full bg-accent-500 px-2 py-0.5 text-xs font-semibold text-white">Needs reply</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white sm:block">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">AWB</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link to={`/admin/complaints/${c.id}`} className="font-bold text-brand-500 hover:text-accent-500">
                      {c.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {c.customerName}
                    <p className="text-xs text-slate-500">{c.accountNo}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/admin/complaints/${c.id}`} className="text-ink-900 hover:text-brand-500">
                      {c.subject}
                    </Link>
                    {!c.lastFromStaff && c.status !== 'Resolved' && (
                      <span className="ml-2 rounded-full bg-accent-500 px-2 py-0.5 text-xs font-semibold text-white">Needs reply</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {c.awbNumber ? (
                      <Link to={`/admin/shipments/${c.awbNumber}`} className="font-semibold text-brand-500 hover:text-accent-500">
                        {c.awbNumber}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ComplaintStatus status={c.status} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                    {when(c.lastMessageAt)}
                    <p className="text-xs">{c.lastFromStaff ? 'APX' : 'Customer'}</p>
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
