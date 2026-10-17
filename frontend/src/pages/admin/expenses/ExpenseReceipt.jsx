import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import LoadState from '../../../components/LoadState'
import { useAppSettings } from '../../../context/AppSettings'
import { useApi } from '../../../hooks/useApi'
import { amountInWords } from '../../../lib/amountInWords'
import { getExpense } from '../../../lib/expenses'
import { money, shortDate } from '../../../lib/invoices'
import './expenseReceipt.css'

// Printable payment voucher for one office expense.
export default function ExpenseReceipt() {
  const { id } = useParams()
  const { company } = useAppSettings()
  const { data: x, error, reload } = useApi(() => getExpense(id), [id])

  if (error?.status === 404) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <p className="font-semibold text-ink-900">Expense not found</p>
        <Link to="/admin/expenses" className="mt-3 inline-block text-sm font-semibold text-brand-500">
          Back to Office Expenses
        </Link>
      </div>
    )
  }

  if (!x) return <LoadState error={error} onRetry={reload} />

  const rows = [
    ['Paid to', x.paidTo || '—'],
    ['Category', x.category],
    ['Description', x.description || '—'],
    ['Payment method', x.method],
  ]

  return (
    <div className="space-y-6">
      <style>{'@page { size: A4 portrait; margin: 0; } @media print { .print-area { padding: 12mm 14mm; } }'}</style>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to="/admin/expenses" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-ink-900">
            <ArrowLeft size={16} /> Office Expenses
          </Link>
          <h1 className="mt-2 text-3xl font-extrabold text-ink-900">Receipt {x.number}</h1>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 hover:bg-accent-600"
        >
          <Printer size={16} /> Print
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-6">
        <div className="print-area min-w-[700px]">
          <div className="xr">
            <header className="xr-top">
              <img src="/apx-logo.svg" alt="APX International" className="xr-logo" />
              <div className="xr-company">
                <p className="xr-company-name">{company.name}</p>
                <p>{company.office}</p>
                <p>TEL # {company.phone}</p>
                {company.email && <p>{company.email}</p>}
                {company.ntn && <p>NTN: {company.ntn}</p>}
              </div>
            </header>
            <div className="xr-band" />

            <div className="xr-head">
              <div>
                <h2 className="xr-title">PAYMENT VOUCHER</h2>
                <p className="xr-sub">Office expense receipt</p>
              </div>
              <dl className="xr-meta">
                <dt>Voucher #</dt>
                <dd>{x.number}</dd>
                <dt>Date</dt>
                <dd>{shortDate(x.date)}</dd>
              </dl>
            </div>

            <table className="xr-table">
              <tbody>
                {rows.map(([label, value]) => (
                  <tr key={label}>
                    <th>{label}</th>
                    <td>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="xr-amount">
              <div>
                <p className="xr-eyebrow">Amount in words</p>
                <p className="xr-words">Rupees {amountInWords(x.amount)} Only</p>
              </div>
              <div className="xr-total">
                <span>Amount</span>
                <strong>Rs {money(x.amount)}</strong>
              </div>
            </div>

            <div className="xr-sign">
              {[
                ['Prepared by', x.preparedBy],
                ['Approved by', ''],
                ['Received by', x.paidTo],
              ].map(([label, name]) => (
                <div key={label}>
                  <p className="xr-sign-name">{name || ' '}</p>
                  <p className="xr-sign-line">{label}</p>
                </div>
              ))}
            </div>

            <p className="xr-foot">This is a computer-generated voucher.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
