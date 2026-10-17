import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, RotateCcw } from 'lucide-react'
import { ComplaintStatus, ReplyBox, Thread } from '../../../components/complaints/Thread'
import LoadState from '../../../components/LoadState'
import { useApi } from '../../../hooks/useApi'
import { COMPLAINT_STATUSES, getComplaint, replyToComplaint, setComplaintStatus, when } from '../../../lib/complaints'

export default function ComplaintView() {
  const { id } = useParams()
  const { data: c, error, reload, setData } = useApi(() => getComplaint(id), [id])
  const [busy, setBusy] = useState(false)
  const [statusError, setStatusError] = useState('')

  if (error?.status === 404) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <p className="font-semibold text-ink-900">Complaint not found</p>
        <Link to="/admin/complaints" className="mt-3 inline-block text-sm font-semibold text-brand-500">
          Back to Complaints
        </Link>
      </div>
    )
  }
  if (!c) return <LoadState error={error} onRetry={reload} />

  async function changeStatus(status) {
    setBusy(true)
    setStatusError('')
    try {
      setData(await setComplaintStatus(c.id, status))
    } catch (err) {
      setStatusError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link to="/admin/complaints" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-ink-900">
            <ArrowLeft size={16} /> Complaints
          </Link>
          <h1 className="mt-2 flex flex-wrap items-center gap-3 text-3xl font-extrabold text-ink-900">
            {c.subject} <ComplaintStatus status={c.status} />
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {c.number} · {c.customerName} ({c.accountNo}) · raised {when(c.createdAt)}
            {c.awbNumber && (
              <>
                {' · '}
                <Link to={`/admin/shipments/${c.awbNumber}`} className="font-semibold text-brand-500 hover:text-accent-500">
                  AWB {c.awbNumber}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm font-semibold text-slate-600" htmlFor="complaint-status">
            Status
          </label>
          <select
            id="complaint-status"
            value={c.status}
            disabled={busy}
            onChange={(e) => changeStatus(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
          >
            {COMPLAINT_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          {c.status === 'Resolved' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => changeStatus('Open')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-100 disabled:opacity-60"
            >
              <RotateCcw size={16} /> Reopen
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => changeStatus('Resolved')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <CheckCircle2 size={16} /> Mark resolved
            </button>
          )}
        </div>
      </div>

      {statusError && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent-600">
          {statusError}
        </p>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <Thread messages={c.messages} side="staff" />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-bold text-ink-900">Reply to {c.customerName}</h2>
        <ReplyBox
          onSend={async (text) => setData(await replyToComplaint(c.id, text))}
          placeholder="Your reply is shown to the customer in their portal."
          hint={c.status === 'Open' ? 'Replying moves it to In progress. Ctrl + Enter to send.' : undefined}
        />
      </section>
    </div>
  )
}
