import { Link } from 'react-router-dom'
import { Download, Receipt } from 'lucide-react'
import { monthLabel } from '../../lib/invoices'
import LoadState from '../../components/LoadState'
import { usePortalInvoices } from '../data'
import { usePortalAccount } from '../PortalAccount'
import { Card, Empty, PageHeader, PreviewNote, btnSecondary, rs, shortDay } from '../ui'

const TONE = { Paid: 'bg-emerald-50 text-emerald-700', Partial: 'bg-amber-50 text-amber-700', Unpaid: 'bg-red-50 text-accent-600' }

export default function Invoices() {
  const { preview } = usePortalAccount()
  const { data: invoices, error, reload } = usePortalInvoices()
  if (!invoices) return <LoadState error={error} onRetry={reload} />

  // Each invoice carries the earlier unpaid amounts forward, so the latest one holds the full balance.
  const latest = invoices[0]
  return (
    <div className="space-y-6">
      {preview && <PreviewNote />}
      <PageHeader title="Invoices" subtitle="Your monthly invoices from APX." />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl bg-ink-950 p-5 text-white sm:col-span-1">
          <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-accent-500/40 blur-2xl" />
          <p className="relative text-sm text-slate-300">Balance due</p>
          <p className="relative mt-1 text-3xl font-extrabold">{rs(latest?.balance)}</p>
          <p className="relative mt-1 text-xs text-slate-400">
            {latest ? `Includes earlier unpaid amounts, as on ${latest.number}` : 'No invoices yet'}
          </p>
        </div>
        <Card title="How to pay" className="sm:col-span-2">
          <p className="text-sm text-slate-600">
            Pay by bank transfer or cash at the APX office and quote your invoice number. Payments appear here once APX records them.
          </p>
        </Card>
      </div>

      {invoices.length === 0 ? (
        <Empty icon={Receipt} title="No invoices yet">
          Your monthly invoices will show up here once APX issues them.
        </Empty>
      ) : (
      <>
      {/* Phones: one card per invoice */}
      <ul className="space-y-3 sm:hidden">
        {invoices.map((i) => (
          <li key={i.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link to={`/portal/invoices/${i.id}`} className="font-bold text-brand-500">
                  {i.number}
                </Link>
                <p className="text-xs text-slate-500">
                  {monthLabel(i.month)} · issued {shortDay(i.issued)}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[i.status]}`}>{i.status}</span>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt className="text-slate-500">This month</dt>
                <dd className="font-semibold text-ink-900">{rs(i.amount)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Paid</dt>
                <dd className="font-semibold text-ink-900">{rs(i.paid)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Balance</dt>
                <dd className="font-bold text-accent-500">{rs(i.balance)}</dd>
              </div>
            </dl>
            <Link to={`/portal/invoices/${i.id}`} className={`${btnSecondary} mt-3 w-full py-2`}>
              <Download size={14} /> View / PDF
            </Link>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white sm:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">Invoice #</th>
              <th className="px-4 py-3">Month</th>
              <th className="px-4 py-3">Issued</th>
              <th className="px-4 py-3 text-right">This month</th>
              <th className="px-4 py-3 text-right">Paid</th>
              <th className="px-4 py-3 text-right">Balance</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.map((i) => (
              <tr key={i.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-bold whitespace-nowrap">
                  <Link to={`/portal/invoices/${i.id}`} className="text-brand-500 hover:text-accent-500">
                    <Receipt size={14} className="mr-1.5 inline text-slate-400" />
                    {i.number}
                  </Link>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{monthLabel(i.month)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">{shortDay(i.issued)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">{rs(i.amount)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">{rs(i.paid)}</td>
                <td className="px-4 py-3 text-right font-bold whitespace-nowrap">{rs(i.balance)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[i.status]}`}>{i.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/portal/invoices/${i.id}`} className={`${btnSecondary} px-3 py-1.5`}>
                    <Download size={14} /> PDF
                  </Link>
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
