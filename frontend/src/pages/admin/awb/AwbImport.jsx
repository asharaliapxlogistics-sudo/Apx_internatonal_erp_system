import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileUp,
  Inbox,
  Loader2,
  Search,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import LoadState from '../../../components/LoadState'
import { useCustomerFilter } from '../../../context/CustomerFilter'
import { useDialog } from '../../../context/Dialog'
import { useApi } from '../../../hooks/useApi'
import { IMPORT_FIRST_DAY, commitImport, deleteImported, exportImported, listImported, previewImport } from '../../../lib/awb'

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
      onImported(ready[0]?.date)
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

const kgOf = (awbs) => Number(awbs.reduce((sum, a) => sum + (Number(a.actualWeight) || 0), 0).toFixed(3))

// One imported sheet: its file name, totals and shipments.
function SheetCard({ file, awbs, showDate, onDelete, deleting }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-100 bg-slate-50 px-4 py-3">
        <p className="flex min-w-0 items-center gap-2 font-bold text-ink-900">
          <FileSpreadsheet size={18} className="shrink-0 text-emerald-600" />
          <span className="truncate">{file}</span>
        </p>
        <p className="text-sm text-slate-500">
          <b className="text-ink-900">{awbs.length}</b> {awbs.length === 1 ? 'shipment' : 'shipments'} ·{' '}
          <b className="text-ink-900">{kgOf(awbs)}</b> kg
        </p>
        {onDelete && (
          <button
            onClick={onDelete}
            disabled={deleting}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-accent-600 hover:bg-red-50 disabled:opacity-50"
          >
            {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Delete sheet
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs font-semibold text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-2.5">#</th>
              <th className="px-4 py-2.5">AWB #</th>
              {showDate && <th className="px-4 py-2.5">Date</th>}
              <th className="px-4 py-2.5">Tracking</th>
              <th className="px-4 py-2.5">Shipper</th>
              <th className="px-4 py-2.5">Consignee</th>
              <th className="px-4 py-2.5">Country</th>
              <th className="px-4 py-2.5">Service</th>
              <th className="px-4 py-2.5">Carrier</th>
              <th className="px-4 py-2.5 text-right">Kg</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {awbs.map((a, i) => (
              <tr key={a.number} className={`hover:bg-slate-50 ${a.status === 'Void' ? 'opacity-50' : ''}`}>
                <td className="px-4 py-2.5 text-slate-400">{i + 1}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <Link to={`/admin/awb/${a.number}`} className="font-bold text-brand-500 hover:text-accent-500">
                    {a.number}
                  </Link>
                  {a.status === 'Void' && <span className="ml-1.5 text-xs font-semibold text-accent-600">Void</span>}
                </td>
                {showDate && <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">{shortDay(new Date(a.createdAt))}</td>}
                <td className="px-4 py-2.5 font-mono text-xs">{a.carrierTracking || <span className="text-slate-400">—</span>}</td>
                <td className="px-4 py-2.5">{a.shipper.name}</td>
                <td className="px-4 py-2.5 font-semibold text-ink-900">{a.consignee.name}</td>
                <td className="px-4 py-2.5">{a.consignee.country}</td>
                <td className="px-4 py-2.5">{a.service}</td>
                <td className="px-4 py-2.5">{a.carrier}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{a.actualWeight}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Pick a date to see every sheet imported for it; searching looks across all dates from July 2026.
export default function AwbImport() {
  const { customerId } = useCustomerFilter()
  const [today] = useState(() => localDay(new Date()))
  const [day, setDay] = useState(today)
  const [query, setQuery] = useState('')
  const [q, setQ] = useState('') // search sent to the server, a moment after typing stops
  const [uploading, setUploading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [deletingFile, setDeletingFile] = useState('')
  const { confirm } = useDialog()

  async function handleDelete(sheet) {
    const ok = await confirm({
      title: `Delete sheet "${sheet.file}"?`,
      message: `${sheet.awbs.length} imported AWBs (${sheet.awbs[0].number} to ${sheet.awbs[sheet.awbs.length - 1].number}) and their tracking history will be removed permanently. This cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    })
    if (!ok) return
    setExportError('')
    setDeletingFile(sheet.file)
    try {
      await deleteImported(sheet.awbs.map((a) => a.number))
      await reload()
    } catch (err) {
      setExportError(err.message)
    } finally {
      setDeletingFile('')
    }
  }

  async function handleExport() {
    setExporting(true)
    setExportError('')
    try {
      const filters = q ? { q, customerId } : { from: day, to: day, customerId }
      const safe = q.replace(/[^\w-]+/g, '-').slice(0, 30)
      await exportImported(filters, q ? `imported-search-${safe}.xlsx` : `imported-shipments-${day}.xlsx`)
    } catch (err) {
      setExportError(err.message)
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(() => setQ(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  const { data, error, loading, reload } = useApi(
    () => listImported(q ? { q, customerId } : { from: day, to: day, customerId }),
    [q, day, customerId],
  )

  const list = data ?? []
  // Sheets in the order they were imported (oldest first), rows in sheet order.
  const sheets = []
  for (const a of [...list].reverse()) {
    let sheet = sheets.find((s) => s.file === a.importFile)
    if (!sheet) sheets.push((sheet = { file: a.importFile, awbs: [] }))
    sheet.awbs.push(a)
  }
  const dayLabel = new Date(`${day}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-ink-900">Import Files</h1>
          <p className="mt-1 text-sm text-slate-500">Shipments imported from Excel. Each row is saved as an Air Waybill.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExport}
            disabled={exporting || list.length === 0}
            title={list.length === 0 ? 'Nothing to export for this view' : 'Download what is shown below as Excel'}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink-900 hover:bg-slate-100 disabled:opacity-40"
          >
            {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />} Export Excel
          </button>
          {!uploading && (
            <button
              onClick={() => setUploading(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 hover:bg-accent-600"
            >
              <FileUp size={18} /> Upload Excel
            </button>
          )}
        </div>
      </div>

      {exportError && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent-600">
          {exportError}
        </p>
      )}

      {uploading && (
        <Uploader
          onImported={(sheetDay) => {
            // Jump to the imported sheet's date so it shows below.
            setQuery('')
            if (sheetDay && sheetDay !== day) setDay(sheetDay)
            else reload()
          }}
          onClose={() => setUploading(false)}
        />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="text-xs font-semibold text-slate-500">
          Date
          <input
            type="date"
            value={day}
            min={IMPORT_FIRST_DAY}
            max={today}
            disabled={!!q}
            onChange={(e) => e.target.value && setDay(e.target.value < IMPORT_FIRST_DAY ? IMPORT_FIRST_DAY : e.target.value)}
            className={`${field} mt-1 block disabled:opacity-50`}
          />
        </label>
        <label className="relative min-w-0 flex-1 sm:max-w-md">
          <span className="sr-only">Search</span>
          <Search size={18} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tracking, AWB, shipper, consignee, file…"
            className={`${field} w-full pr-10 pl-11`}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-ink-900"
            >
              <X size={16} />
            </button>
          )}
        </label>
      </div>

      {data === undefined ? (
        <LoadState error={error} onRetry={reload} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
            <span className="font-semibold text-ink-900">{q ? `Search results for “${q}” (all dates)` : dayLabel}</span>
            <span>
              <b className="text-ink-900">{sheets.length}</b> {sheets.length === 1 ? 'sheet' : 'sheets'}
            </span>
            <span>
              <b className="text-ink-900">{list.length}</b> {list.length === 1 ? 'shipment' : 'shipments'}
            </span>
            <span>
              <b className="text-ink-900">{kgOf(list)}</b> kg
            </span>
            {loading && <Loader2 size={15} className="animate-spin" />}
            {error && <span className="text-accent-600">{error.message}</span>}
          </div>

          {sheets.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <Inbox size={36} className="text-slate-300" />
              <p className="mt-4 font-semibold text-ink-900">
                {q ? 'No matching imported shipments' : 'No sheets imported for this date'}
              </p>
              {!q && !uploading && (
                <button onClick={() => setUploading(true)} className="mt-2 text-sm font-semibold text-brand-500 hover:text-accent-500">
                  Upload an Excel file
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {sheets.map((s) => (
                <SheetCard
                  key={s.file}
                  file={s.file}
                  awbs={s.awbs}
                  showDate={!!q}
                  deleting={deletingFile === s.file}
                  // Search shows only matching rows, so a sheet is deleted from the date view, where it is whole.
                  onDelete={q ? null : () => handleDelete(s)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
