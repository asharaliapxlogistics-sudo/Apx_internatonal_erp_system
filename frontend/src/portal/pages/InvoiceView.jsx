import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Printer, Receipt } from 'lucide-react'
import InvoiceSheet from '../../components/billing/InvoiceSheet'
import LoadState from '../../components/LoadState'
import { AppSettingsProvider } from '../../context/AppSettings'
import { useApi } from '../../hooks/useApi'
import { invoiceTotals, money, shortDate } from '../../lib/invoices'
import { getPortalInvoice, getPortalSettings } from '../data'
import { usePortalAccount } from '../PortalAccount'
import { Empty, PreviewNote, btnPrimary } from '../ui'

const TONE = { Paid: 'bg-emerald-50 text-emerald-700', Partial: 'bg-amber-50 text-amber-700', Unpaid: 'bg-red-50 text-accent-600' }

const back = (
  <Link to="/portal/invoices" className="no-print inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-ink-900">
    <ArrowLeft size={16} /> Invoices
  </Link>
)

// One invoice, printed exactly like the copy APX issues. "Save as PDF" in the print dialog gives the PDF.
export default function InvoiceView() {
  const { id } = useParams()
  const { preview } = usePortalAccount()
  if (preview) {
    return (
      <div className="space-y-6">
        {back}
        <PreviewNote>Invoices open here for customer logins, with their real invoices.</PreviewNote>
      </div>
    )
  }
  return (
    <AppSettingsProvider load={getPortalSettings}>
      <Invoice id={id} />
    </AppSettingsProvider>
  )
}

function Invoice({ id }) {
  const { company } = usePortalAccount()
  const { data: invoice, error, reload } = useApi(() => getPortalInvoice(id), [id])

  if (error?.status === 404) {
    return (
      <Empty icon={Receipt} title="Invoice not found">
        <Link to="/portal/invoices" className="font-semibold text-brand-500">
          Back to invoices
        </Link>
      </Empty>
    )
  }
  if (!invoice) return <LoadState error={error} onRetry={reload} />

  const t = invoiceTotals(invoice)
  return (
    <div className="space-y-6">
      {/* margin 0 stops the browser printing its own date/time/title header; spacing comes from .print-area */}
      <style>{'@page { size: A4 portrait; margin: 0; } @media print { .print-area { padding: 10mm 12mm; } }'}</style>
      <div className="no-print flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {back}
          <h1 className="mt-2 flex flex-wrap items-center gap-3 text-2xl font-extrabold text-ink-900 sm:text-3xl">
            {invoice.number}
            <span className={`rounded-full px-3 py-1 text-sm font-bold ${TONE[t.status]}`}>{t.status}</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">To save a PDF, choose “Save as PDF” as the printer.</p>
        </div>
        <button type="button" onClick={() => window.print()} className={btnPrimary}>
          <Printer size={16} /> Print / Save PDF
        </button>
      </div>

      <div className="no-print grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['This month', t.total],
          ['Total payable', t.payable],
          ['Paid', t.paid],
          ['Balance', t.outstanding],
        ].map(([label, v]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase">{label}</p>
            <p className={`mt-1 text-xl font-extrabold ${label === 'Balance' && v > 0 ? 'text-accent-500' : 'text-ink-900'}`}>Rs {money(v)}</p>
          </div>
        ))}
      </div>

      {invoice.payments.length > 0 && (
        <section className="no-print overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 px-5 py-3 font-bold text-ink-900">Payments received</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {invoice.payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-2.5 whitespace-nowrap text-slate-500">{shortDate(p.date)}</td>
                  <td className="px-5 py-2.5">{p.method}</td>
                  <td className="px-5 py-2.5 text-slate-500">{p.reference}</td>
                  <td className="px-5 py-2.5 text-right font-bold text-emerald-700">Rs {money(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-6">
        <div className="print-area min-w-[900px]">
          <InvoiceSheet invoice={invoice} customer={company} />
        </div>
      </div>
    </div>
  )
}
