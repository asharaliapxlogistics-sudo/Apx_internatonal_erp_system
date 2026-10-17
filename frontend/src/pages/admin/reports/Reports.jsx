import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, Printer, ShieldCheck } from 'lucide-react'
import LoadState from '../../../components/LoadState'
import { StatusBadge } from '../../../components/tracking/StatusUpdate'
import { useCustomerFilter } from '../../../context/CustomerFilter'
import { useApi } from '../../../hooks/useApi'
import { getSession } from '../../../lib/auth'
import { monthLabel, money, shortDate } from '../../../lib/invoices'
import { downloadCsv, getReport } from '../../../lib/reports'

const REPORTS = [
  { key: 'shipments', label: 'Shipments', usesRange: true, usesCustomer: true },
  { key: 'sales', label: 'Sales & Collections', usesRange: true, usesCustomer: true },
  { key: 'balances', label: 'Customer Balances', usesRange: false, usesCustomer: true },
  { key: 'expenses', label: 'Expenses', usesRange: true, usesCustomer: false },
  { key: 'profit-loss', label: 'Profit & Loss', usesRange: true, usesCustomer: false },
]

// Local calendar date as YYYY-MM-DD (toISOString would give the UTC date).
function localDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function rangeFor(preset) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  switch (preset) {
    case 'lastMonth':
      return [localDate(new Date(y, m - 1, 1)), localDate(new Date(y, m, 0))]
    case 'year':
      return [localDate(new Date(y, 0, 1)), localDate()]
    case 'last12':
      return [localDate(new Date(y, m - 11, 1)), localDate()]
    default:
      return [localDate(new Date(y, m, 1)), localDate()]
  }
}

const PRESETS = [
  ['month', 'This month'],
  ['lastMonth', 'Last month'],
  ['year', 'This year'],
  ['last12', 'Last 12 months'],
  ['custom', 'Custom'],
]

const rs = (n) => `Rs ${money(n)}`
const kgs = (n) => `${Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })} KG`

function Kpi({ label, value, tone = 'text-ink-900' }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold ${tone}`}>{value}</p>
    </div>
  )
}

// Ranked list with a proportional bar, e.g. shipments per service.
function Breakdown({ title, rows, value, format = (v) => v, detail }) {
  const max = Math.max(0, ...rows.map((r) => r[value]))
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 font-bold text-ink-900">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing in this period.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.name}>
              <div className="flex justify-between gap-3 text-sm">
                <span className="truncate font-medium text-slate-600">{r.name}</span>
                <span className="font-bold whitespace-nowrap text-ink-900">{format(r[value])}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                <div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${max ? (r[value] / max) * 100 : 0}%` }} />
              </div>
              {detail && <p className="mt-0.5 text-right text-xs text-slate-400">{detail(r)}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Table({ title, columns, rows, footer, empty = 'Nothing in this period.' }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <h2 className="border-b border-slate-100 px-5 py-3 font-bold text-ink-900">
        {title} <span className="text-sm font-medium text-slate-500">({rows.length})</span>
      </h2>
      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-500">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase">
              <tr>
                {columns.map((c) => (
                  <th key={c.label} className={`px-4 py-2.5 whitespace-nowrap ${c.right ? 'text-right' : ''}`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={r.id ?? r.number ?? r.customerId ?? r.month ?? r.name ?? i}>
                  {columns.map((c) => (
                    <td key={c.label} className={`px-4 py-2.5 ${c.right ? 'text-right whitespace-nowrap' : ''} ${c.className ?? ''}`}>
                      {c.render ? c.render(r) : r[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {footer && (
              <tfoot className="bg-slate-50 font-bold text-ink-900">
                <tr>
                  {columns.map((c, i) => (
                    <td key={c.label} className={`px-4 py-2.5 ${c.right ? 'text-right whitespace-nowrap' : ''}`}>
                      {i === 0 ? 'Total' : footer[c.label] ?? ''}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </section>
  )
}

// ---------- the five reports: each returns its screen and its CSV export ----------

function shipmentsView(d) {
  const t = d.totals
  const columns = [
    { label: 'AWB #', key: 'number', render: (r) => <Link to={`/admin/shipments/${r.number}`} className="font-bold text-brand-500">{r.number}</Link> },
    { label: 'Date', key: 'date', render: (r) => shortDate(r.date), className: 'whitespace-nowrap' },
    { label: 'Customer', key: 'customer' },
    { label: 'Consignee', key: 'consignee' },
    { label: 'Destination', key: 'country' },
    { label: 'Service', key: 'service' },
    { label: 'Pcs', key: 'pieces', right: true },
    { label: 'Chargeable', key: 'chargeableWeight', right: true, render: (r) => kgs(r.chargeableWeight) },
    { label: 'Status', key: 'status', render: (r) => <StatusBadge status={r.status} /> },
  ]
  return {
    screen: (
      <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Shipments" value={t.shipments} />
          <Kpi label="Pieces" value={t.pieces} />
          <Kpi label="Chargeable weight" value={kgs(t.chargeableWeight)} />
          <Kpi label="Declared value" value={`USD ${money(t.declaredValue)}`} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <Breakdown title="By service" rows={d.byService} value="shipments" detail={(r) => kgs(r.weight)} />
          <Breakdown title="By destination" rows={d.byCountry} value="shipments" detail={(r) => kgs(r.weight)} />
          <Breakdown title="By customer" rows={d.byCustomer} value="shipments" detail={(r) => kgs(r.weight)} />
          <Breakdown title="By current status" rows={d.byStatus} value="shipments" />
        </div>
        <Table
          title="Shipments"
          columns={columns}
          rows={d.rows}
          footer={{ Pcs: t.pieces, Chargeable: kgs(t.chargeableWeight) }}
        />
      </>
    ),
    csv: { columns: columns.map(({ label, key }) => ({ label, key })), rows: d.rows },
  }
}

function salesView(d) {
  const t = d.totals
  const columns = [
    { label: 'Invoice #', key: 'number', render: (r) => <Link to={`/admin/billing/${r.id}`} className="font-bold text-brand-500">{r.number}</Link> },
    { label: 'Customer', key: 'customer' },
    { label: 'Account', key: 'accountNo' },
    { label: 'Month', key: 'month', render: (r) => monthLabel(r.month) },
    { label: 'Invoice amount', key: 'total', right: true, render: (r) => rs(r.total) },
    { label: 'Paid', key: 'paid', right: true, render: (r) => rs(r.paid) },
    { label: 'Outstanding', key: 'outstanding', right: true, render: (r) => rs(r.outstanding) },
    { label: 'Status', key: 'status' },
  ]
  return {
    screen: (
      <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Invoices" value={t.invoices} />
          <Kpi label="Invoiced" value={rs(t.invoiced)} />
          <Kpi label="Collected" value={rs(t.collected)} tone="text-emerald-600" />
          <Kpi label="Balance due now" value={rs(t.balanceNow)} tone="text-accent-500" />
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          <Table
            title="By month"
            columns={[
              { label: 'Month', key: 'month', render: (r) => monthLabel(r.month), className: 'whitespace-nowrap' },
              { label: 'Invoiced', key: 'invoiced', right: true, render: (r) => rs(r.invoiced) },
              { label: 'Collected', key: 'collected', right: true, render: (r) => rs(r.collected) },
            ]}
            rows={d.byMonth}
          />
          <Breakdown title="Invoiced by customer" rows={d.byCustomer} value="invoiced" format={rs} detail={(r) => `collected ${rs(r.collected)}`} />
          <Breakdown title="Collected by method" rows={d.byMethod} value="amount" format={rs} />
        </div>
        <Table title="Invoices" columns={columns} rows={d.rows} footer={{ 'Invoice amount': rs(t.invoiced) }} />
      </>
    ),
    csv: { columns: columns.map(({ label, key }) => ({ label, key })), rows: d.rows },
  }
}

function balancesView(d) {
  const columns = [
    { label: 'Customer', key: 'customer', render: (r) => <span className="font-semibold text-ink-900">{r.customer}</span> },
    { label: 'Account', key: 'accountNo' },
    { label: 'Latest invoice', key: 'invoice', render: (r) => <Link to={`/admin/billing/${r.invoiceId}`} className="font-bold text-brand-500">{r.invoice}</Link> },
    { label: 'Month', key: 'month', render: (r) => monthLabel(r.month) },
    { label: 'Days', key: 'days', right: true },
    { label: 'Age', key: 'age', className: 'whitespace-nowrap' },
    { label: 'Last payment', key: 'lastPayment', render: (r) => (r.lastPayment ? shortDate(r.lastPayment) : 'None'), className: 'whitespace-nowrap' },
    { label: 'Balance', key: 'balance', right: true, render: (r) => <span className="font-bold text-accent-500">{rs(r.balance)}</span> },
  ]
  return {
    screen: (
      <>
        <p className="text-sm text-slate-500">
          As of {shortDate(d.asOf)}. A customer&apos;s balance is the outstanding on their latest invoice, which already carries
          earlier unpaid amounts forward.
        </p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <Kpi label="Customers owing" value={d.totals.customers} />
          <Kpi label="Total due" value={rs(d.totals.balance)} tone="text-accent-500" />
          {d.byAge.map((b) => (
            <Kpi key={b.name} label={b.name} value={rs(b.balance)} />
          ))}
        </div>
        <Table title="Customers with a balance" columns={columns} rows={d.rows} footer={{ Balance: rs(d.totals.balance) }} empty="No customer owes anything." />
      </>
    ),
    csv: { columns: columns.map(({ label, key }) => ({ label, key })), rows: d.rows },
  }
}

function expensesView(d) {
  const columns = [
    { label: 'Voucher', key: 'number', className: 'font-semibold whitespace-nowrap' },
    { label: 'Date', key: 'date', render: (r) => shortDate(r.date), className: 'whitespace-nowrap' },
    { label: 'Category', key: 'category' },
    { label: 'Description', key: 'description' },
    { label: 'Paid to', key: 'paidTo' },
    { label: 'Method', key: 'method' },
    { label: 'Amount', key: 'amount', right: true, render: (r) => rs(r.amount) },
  ]
  return {
    screen: (
      <>
        <div className="grid grid-cols-2 gap-3">
          <Kpi label="Total spent" value={rs(d.totals.amount)} tone="text-accent-500" />
          <Kpi label="Entries" value={d.totals.entries} />
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          <Breakdown title="By category" rows={d.byCategory} value="amount" format={rs} />
          <Table title="By month" columns={[{ label: 'Month', key: 'month', render: (r) => monthLabel(r.month), className: 'whitespace-nowrap' }, { label: 'Amount', key: 'amount', right: true, render: (r) => rs(r.amount) }]} rows={d.byMonth} />
          <Breakdown title="By payment method" rows={d.byMethod} value="amount" format={rs} />
        </div>
        <Table title="Expenses" columns={columns} rows={d.rows} footer={{ Amount: rs(d.totals.amount) }} />
      </>
    ),
    csv: { columns: columns.map(({ label, key }) => ({ label, key })), rows: d.rows },
  }
}

function profitLossView(d) {
  const t = d.totals
  const signed = (n) => <span className={n < 0 ? 'text-accent-500' : 'text-emerald-600'}>{rs(n)}</span>
  const columns = [
    { label: 'Month', key: 'month', render: (r) => monthLabel(r.month), className: 'whitespace-nowrap' },
    { label: 'Revenue', key: 'revenue', right: true, render: (r) => rs(r.revenue) },
    { label: 'Expenses', key: 'expenses', right: true, render: (r) => rs(r.expenses) },
    { label: 'Profit', key: 'profit', right: true, render: (r) => <b>{signed(r.profit)}</b> },
    { label: 'Collected', key: 'collected', right: true, render: (r) => rs(r.collected) },
    { label: 'Cash (collected − expenses)', key: 'cash', right: true, render: (r) => signed(r.cash) },
  ]
  return {
    screen: (
      <>
        <p className="text-sm text-slate-500">
          Revenue is the shipments invoiced for each month (previous balances are not counted again). Cash shows what was actually
          received minus what was spent.
        </p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Revenue" value={rs(t.revenue)} />
          <Kpi label="Expenses" value={rs(t.expenses)} />
          <Kpi label="Profit" value={rs(t.profit)} tone={t.profit < 0 ? 'text-accent-500' : 'text-emerald-600'} />
          <Kpi label="Cash in hand change" value={rs(t.cash)} tone={t.cash < 0 ? 'text-accent-500' : 'text-emerald-600'} />
        </div>
        <Table
          title="Month by month"
          columns={columns}
          rows={d.rows}
          footer={{ Revenue: rs(t.revenue), Expenses: rs(t.expenses), Profit: rs(t.profit), Collected: rs(t.collected), 'Cash (collected − expenses)': rs(t.cash) }}
        />
      </>
    ),
    csv: { columns: columns.map(({ label, key }) => ({ label, key })), rows: d.rows },
  }
}

const VIEWS = { shipments: shipmentsView, sales: salesView, balances: balancesView, expenses: expensesView, 'profit-loss': profitLossView }

export default function Reports() {
  const me = getSession()
  const [params, setParams] = useSearchParams()
  const report = REPORTS.find((r) => r.key === params.get('r')) ?? REPORTS[0]
  const { customerId, customers } = useCustomerFilter()
  const [preset, setPreset] = useState('month')
  const [custom, setCustom] = useState(() => rangeFor('month'))
  const [from, to] = preset === 'custom' ? custom : rangeFor(preset)
  const scopedCustomer = report.usesCustomer ? customerId : null
  const request = { kind: report.key, from: report.usesRange ? from : null, to: report.usesRange ? to : null, customerId: scopedCustomer }
  const requestKey = JSON.stringify(request)
  // Each response is tagged with the request it answers.
  const { data, error, reload } = useApi(() => getReport(request.kind, request).then((d) => ({ requestKey, d })), [requestKey])

  if (me?.role !== 'admin') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <ShieldCheck size={36} className="mx-auto text-slate-300" />
        <p className="mt-4 font-semibold text-ink-900">Only admins can see reports</p>
      </div>
    )
  }

  const customerName = customers.find((c) => c.id === scopedCustomer)?.name
  const period = report.usesRange ? `${shortDate(from)} to ${shortDate(to)}` : 'Current balances'
  // While a new report or period loads, the previous response must not be shown in the new layout.
  const current = data?.requestKey === requestKey ? data.d : null
  const view = current && VIEWS[report.key](current)

  function exportCsv() {
    const name = `${report.label} ${report.usesRange ? `${from} to ${to}` : current.asOf}${customerName ? ` ${customerName}` : ''}`
    downloadCsv(`${name.replace(/[^\w\- ]+/g, '').trim()}.csv`, view.csv.columns, view.csv.rows)
  }

  return (
    <div className="space-y-6">
      <style>{'@page { size: A4 landscape; margin: 10mm; }'}</style>
      <div className="no-print flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-ink-900">Reports</h1>
          <p className="mt-1 text-sm text-slate-500">
            {customerName ? `Showing ${customerName} only (change it in the top bar).` : 'Figures for the whole company.'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCsv}
            disabled={!view}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-100 disabled:opacity-40"
          >
            <Download size={16} /> Excel (CSV)
          </button>
          <button
            onClick={() => window.print()}
            disabled={!view}
            className="inline-flex items-center gap-1.5 rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink-800 disabled:opacity-40"
          >
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      <div className="no-print flex flex-wrap gap-2 border-b border-slate-200">
        {REPORTS.map((r) => (
          <button
            key={r.key}
            onClick={() => setParams({ r: r.key })}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${
              r.key === report.key ? 'border-accent-500 text-ink-900' : 'border-transparent text-slate-500 hover:text-ink-900'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {report.usesRange && (
        <div className="no-print flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPreset(key)}
                className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                  preset === key ? 'bg-ink-950 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" aria-label="From" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={custom[0]} onChange={(e) => setCustom([e.target.value, custom[1]])} />
              <span className="text-sm text-slate-400">to</span>
              <input type="date" aria-label="To" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={custom[1]} onChange={(e) => setCustom([custom[0], e.target.value])} />
            </div>
          )}
        </div>
      )}

      {!view ? (
        <LoadState error={error} onRetry={reload} />
      ) : (
        <div className="print-area space-y-6">
          <div className="hidden print:block">
            <p className="text-xl font-extrabold text-ink-900">APX International — {report.label}</p>
            <p className="text-sm text-slate-600">
              {period}
              {customerName ? ` · ${customerName}` : ''}
            </p>
          </div>
          {view.screen}
        </div>
      )}
    </div>
  )
}
