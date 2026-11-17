import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  FileUp,
  Inbox,
  Loader2,
  RotateCcw,
  Search,
  X,
  XCircle,
} from 'lucide-react'
import LoadState from '../../../components/LoadState'
import { useCustomerFilter } from '../../../context/CustomerFilter'
import { useApi } from '../../../hooks/useApi'
import { IMPORT_FIRST_DAY, commitImport, listImported, previewImport } from '../../../lib/awb'

const COLUMNS = ['Date', 'Tracking no.', 'Shipper', 'Weight (kg)', 'Country', 'Consignee', 'Service', 'Carrier']
const field =
  'rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none'

// Local date as YYYY-MM-DD (the value format of <input type="date">).
const localDay = (d) => {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const shortDay = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })

// Read a sheet, check its rows, then save the good rows as AWBs.
function Uploader({ onImported, onClose }) {
  const inputRef = useRef(null)
  const [preview, setPreview] = useState(null) // { fileName, rows }
  const [result, setResult] = useState(null) // { created, skipped }
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  async function readFile(file) {
    if (!file) return
    setError('')
    setResult(null)
    setPreview(null)
    setBusy('Reading file…')
    try {
      setPreview(await previewImport(file))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function save() {
    const ready = preview.rows.filter((r) => r.errors.length === 0)
    setError('')
    setBusy(`Saving ${ready.length} AWBs…`)
    try {
      setResult(await commitImport(preview.fileName, ready))
      setPreview(null)
      onImported()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  const rows = preview?.rows ?? []
  const ready = rows.filter((r) => r.errors.length === 0)
  const withErrors = rows.length - ready.length
  const withWarnings = ready.filter((r) => r.warnings.length).length
  const manySheets = new Set(rows.map((r) => r.sheet)).size > 1

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-ink-900">Upload Excel</p>
          <p className="text-sm text-slate-500">Nothing is saved until you check the rows and press Import.</p>
        </div>
        <button onClick={onClose} aria-label="Close upload" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-ink-900">
          <X size={18} />
        </button>
      </div>

      {!preview && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            readFile(e.dataTransfer.files[0])
          }}
          className={`flex flex-col items-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition ${
            dragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300'
          }`}
        >
          {busy ? <Loader2 size={32} className="animate-spin text-brand-500" /> : <FileSpreadsheet size={32} className="text-slate-300" />}
          <p className="mt-3 font-semibold text-ink-900">{busy || 'Drop the Excel file here'}</p>
          <p className="mt-1 text-xs text-slate-500">.xlsx only · dates from July 2026</p>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => readFile(e.target.files[0])}
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={!!busy}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 hover:bg-accent-600 disabled:opacity-50"
          >
            <FileUp size={18} /> Choose file
          </button>
        </div>
      )}

      {!preview && (
        <details className="text-sm text-slate-600">
          <summary className="cursor-pointer font-semibold text-ink-900">Sheet layout</summary>
          <p className="mt-2">Columns A to H, in this order (a heading row is optional):</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {COLUMNS.map((c, i) => (
              <span key={c} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-ink-900">
                {String.fromCharCode(65 + i)}: {c}
              </span>
            ))}
          </div>
          <p className="mt-2">
            The shipper is matched to a customer account by name. Format the tracking column as <b>Text</b> in Excel
            before typing: longer numbers stored as numbers are rounded (they show as 9.20559E+21) and cannot be recovered.
          </p>
        </details>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent-600">
          {error}
        </p>
      )}

      {result && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
          <p className="flex items-center gap-2 font-semibold text-emerald-800">
            <CheckCircle2 size={18} /> {result.created.length} AWBs created
            {result.created.length > 0 && ` (${result.created[0]} to ${result.created[result.created.length - 1]})`}
          </p>
          {result.skipped.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-6 text-accent-600">
              {result.skipped.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {preview && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <p className="font-semibold text-ink-900">{preview.fileName}</p>
              <p className="text-slate-500">
                {rows.length} rows: <span className="font-semibold text-emerald-700">{ready.length} ready</span>
                {withWarnings > 0 && <span className="text-amber-700">, {withWarnings} with notes</span>}
                {withErrors > 0 && <span className="text-accent-600">, {withErrors} will be skipped</span>}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPreview(null)}
                disabled={!!busy}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink-900 hover:bg-slate-100"
              >
                <X size={16} /> Cancel
              </button>
              <button
                onClick={save}
                disabled={!!busy || ready.length === 0}
                className="inline-flex items-center gap-1.5 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 hover:bg-accent-600 disabled:opacity-50"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />} Import {ready.length} AWBs
              </button>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase">
                <tr>
                  <th className="px-3 py-3">Row</th>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Tracking</th>
                  <th className="px-3 py-3">Shipper</th>
                  <th className="px-3 py-3 text-right">Kg</th>
                  <th className="px-3 py-3">Country</th>
                  <th className="px-3 py-3">Consignee</th>
                  <th className="px-3 py-3">Service</th>
                  <th className="px-3 py-3">Carrier</th>
                  <th className="px-3 py-3">Check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const bad = r.errors.length > 0
                  return (
                    <tr key={`${r.sheet}-${r.row}`} className={bad ? 'bg-red-50/60' : r.warnings.length ? 'bg-amber-50/50' : ''}>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-400">
                        {manySheets ? `${r.sheet} ` : ''}
                        {r.row}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{shortDay(new Date(`${r.date}T00:00:00`))}</td>
                      <td className="px-3 py-2 font-mono text-xs">{r.tracking || <span className="text-slate-400">—</span>}</td>
                      <td className="px-3 py-2">
                        {r.shipper}
                        {r.customerId && <span className="block text-xs text-emerald-700">Account matched</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.weight ?? '—'}</td>
                      <td className="px-3 py-2">{r.country}</td>
                      <td className="px-3 py-2 font-semibold text-ink-900">{r.consignee}</td>
                      <td className="px-3 py-2">{r.service}</td>
                      <td className="px-3 py-2">{r.carrier}</td>
                      <td className="min-w-56 px-3 py-2 text-xs">
                        {r.errors.map((m) => (
                          <p key={m} className="flex gap-1 text-accent-600">
                            <XCircle size={14} className="mt-px shrink-0" /> {m}
                          </p>
                        ))}
                        {r.warnings.map((m) => (
                          <p key={m} className="flex gap-1 text-amber-700">
                            <AlertTriangle size={14} className="mt-px shrink-0" /> {m}
                          </p>
                        ))}
                        {!bad && !r.warnings.length && (
                          <p className="flex gap-1 text-emerald-700">
                            <CheckCircle2 size={14} className="mt-px shrink-0" /> Ready
                          </p>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// Imported shipments, with search and a date range from July 2026, plus the Excel upload.
export default function AwbImport() {
  const { customerId } = useCustomerFilter()
  const [today] = useState(() => localDay(new Date()))
  const [from, setFrom] = useState(IMPORT_FIRST_DAY)
  const [to, setTo] = useState(today)
  const [query, setQuery] = useState('')
  const [q, setQ] = useState('') // search sent to the server, a moment after typing stops
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setQ(query), 300)
    return () => clearTimeout(t)
  }, [query])

  const { data, error, loading, reload } = useApi(() => listImported({ q, from, to, customerId }), [q, from, to, customerId])

  const filtered = q || from !== IMPORT_FIRST_DAY || to !== today
  const list = data ?? []
  const totalKg = list.reduce((sum, a) => sum + (Number(a.actualWeight) || 0), 0)

  function clearFilters() {
    setQuery('')
    setQ('')
    setFrom(IMPORT_FIRST_DAY)
    setTo(today)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-ink-900">Import Files</h1>
          <p className="mt-1 text-sm text-slate-500">Shipments imported from Excel. Each row is saved as an Air Waybill.</p>
        </div>
        {!uploading && (
          <button
            onClick={() => setUploading(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 hover:bg-accent-600"
          >
            <FileUp size={18} /> Upload Excel
          </button>
        )}
      </div>

      {uploading && <Uploader onImported={reload} onClose={() => setUploading(false)} />}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <label className="relative min-w-0 flex-1 lg:max-w-md">
          <span className="sr-only">Search</span>
          <Search size={18} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tracking, AWB, shipper, consignee, file…"
            className={`${field} w-full pl-11`}
          />
        </label>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-semibold text-slate-500">
            From
            <input
              type="date"
              value={from}
              min={IMPORT_FIRST_DAY}
              max={to}
              onChange={(e) => setFrom(e.target.value && e.target.value >= IMPORT_FIRST_DAY ? e.target.value : IMPORT_FIRST_DAY)}
              className={`${field} mt-1 block`}
            />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            To
            <input
              type="date"
              value={to}
              min={from}
              max={today}
              onChange={(e) => setTo(e.target.value || today)}
              className={`${field} mt-1 block`}
            />
          </label>
          {filtered && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-ink-900 hover:bg-slate-100"
            >
              <RotateCcw size={15} /> Clear
            </button>
          )}
        </div>
      </div>

      {data === undefined ? (
        <LoadState error={error} onRetry={reload} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
            <span>
              <b className="text-ink-900">{list.length}</b> {list.length === 1 ? 'shipment' : 'shipments'}
            </span>
            <span>
              <b className="text-ink-900">{Number(totalKg.toFixed(3))}</b> kg
            </span>
            {loading && <Loader2 size={15} className="animate-spin" />}
            {error && <span className="text-accent-600">{error.message}</span>}
          </div>

          {list.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <Inbox size={36} className="text-slate-300" />
              <p className="mt-4 font-semibold text-ink-900">{filtered ? 'No matching imported shipments' : 'Nothing imported yet'}</p>
              {!filtered && !uploading && (
                <button onClick={() => setUploading(true)} className="mt-2 text-sm font-semibold text-brand-500 hover:text-accent-500">
                  Upload the first Excel file
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">AWB #</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Tracking</th>
                    <th className="px-4 py-3">Shipper</th>
                    <th className="px-4 py-3">Consignee</th>
                    <th className="px-4 py-3">Country</th>
                    <th className="px-4 py-3">Service</th>
                    <th className="px-4 py-3">Carrier</th>
                    <th className="px-4 py-3 text-right">Kg</th>
                    <th className="px-4 py-3">File</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {list.map((a) => (
                    <tr key={a.number} className={`hover:bg-slate-50 ${a.status === 'Void' ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link to={`/admin/awb/${a.number}`} className="font-bold text-brand-500 hover:text-accent-500">
                          {a.number}
                        </Link>
                        {a.status === 'Void' && <span className="ml-1.5 text-xs font-semibold text-accent-600">Void</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500">{shortDay(new Date(a.createdAt))}</td>
                      <td className="px-4 py-3 font-mono text-xs">{a.carrierTracking || <span className="text-slate-400">—</span>}</td>
                      <td className="px-4 py-3">{a.shipper.name}</td>
                      <td className="px-4 py-3 font-semibold text-ink-900">{a.consignee.name}</td>
                      <td className="px-4 py-3">{a.consignee.country}</td>
                      <td className="px-4 py-3">{a.service}</td>
                      <td className="px-4 py-3">{a.carrier}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{a.actualWeight}</td>
                      <td className="max-w-48 truncate px-4 py-3 text-xs text-slate-500" title={a.importFile}>
                        {a.importFile}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
