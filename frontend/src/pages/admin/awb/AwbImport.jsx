import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, FileUp, Loader2, X, XCircle } from 'lucide-react'
import { commitImport, previewImport } from '../../../lib/awb'

const COLUMNS = ['Date', 'Tracking no.', 'Shipper', 'Weight (kg)', 'Country', 'Consignee', 'Service', 'Carrier']
const day = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })

// Upload an Excel sheet of shipments; each row becomes an AWB after a preview.
export default function AwbImport() {
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
    const rows = preview.rows.filter((r) => r.errors.length === 0)
    setError('')
    setBusy(`Saving ${rows.length} AWBs…`)
    try {
      setResult(await commitImport(rows))
      setPreview(null)
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-ink-900">Import Files</h1>
        <p className="mt-1 text-sm text-slate-500">Upload an Excel sheet of shipments. Each row is saved as an Air Waybill.</p>
      </div>

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
        className={`flex flex-col items-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
          dragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-white'
        }`}
      >
        {busy ? (
          <Loader2 size={36} className="animate-spin text-brand-500" />
        ) : (
          <FileSpreadsheet size={36} className="text-slate-300" />
        )}
        <p className="mt-3 font-semibold text-ink-900">{busy || 'Drop the Excel file here'}</p>
        <p className="mt-1 text-xs text-slate-500">.xlsx only. Nothing is saved until you check the rows and press Import.</p>
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

      <details className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">
        <summary className="cursor-pointer font-semibold text-ink-900">Sheet layout</summary>
        <p className="mt-3">Columns A to H, in this order (a heading row is optional):</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {COLUMNS.map((c, i) => (
            <span key={c} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-ink-900">
              {String.fromCharCode(65 + i)}: {c}
            </span>
          ))}
        </div>
        <p className="mt-3">
          The shipper is matched to a customer account by name. Tracking numbers longer than 15 digits must be in a
          column formatted as <b>Text</b> in Excel; otherwise Excel rounds them (they show as 9.20559E+21) and the digits
          cannot be recovered.
        </p>
      </details>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent-600">
          {error}
        </p>
      )}

      {result && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm">
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
          <Link to="/admin/awb" className="mt-3 inline-block font-semibold text-brand-500 hover:text-accent-500">
            Open Air Waybills
          </Link>
        </div>
      )}

      {preview && (
        <div className="space-y-4">
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
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink-900 hover:bg-slate-100"
              >
                <X size={16} /> Cancel
              </button>
              <button
                onClick={save}
                disabled={!!busy || ready.length === 0}
                className="inline-flex items-center gap-1.5 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 hover:bg-accent-600 disabled:opacity-50"
              >
                <FileUp size={16} /> Import {ready.length} AWBs
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase">
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
                        {preview.rows.some((x) => x.sheet !== r.sheet) ? `${r.sheet} ` : ''}
                        {r.row}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{day(r.date)}</td>
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
        </div>
      )}
    </div>
  )
}
