import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, MessageSquareWarning, Plus, X } from 'lucide-react'
import { ComplaintStatus, ReplyBox, Thread } from '../../components/complaints/Thread'
import LoadState from '../../components/LoadState'
import { useApi } from '../../hooks/useApi'
import { getMyComplaint, listMyComplaints, raiseComplaint, replyToMyComplaint, when } from '../../lib/complaints'
import { usePortalShipments } from '../data'
import { usePortalAccount } from '../PortalAccount'
import { Card, Empty, Field, PageHeader, PreviewNote, btnPrimary, inputCls } from '../ui'

function PreviewOnly() {
  return (
    <div className="space-y-6">
      <PageHeader title="Complaints" subtitle="Tell APX about a problem with a shipment, and follow the reply here." />
      <PreviewNote>Complaints work for customer logins. Staff answer them under Complaints in the admin portal.</PreviewNote>
    </div>
  )
}

function NewComplaint({ awb, onClose }) {
  const navigate = useNavigate()
  const { data: shipments } = usePortalShipments()
  const [form, setForm] = useState({ awbNumber: awb ?? '', subject: '', body: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const c = await raiseComplaint(form)
      navigate(`/portal/complaints/${c.id}`)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Card
      title="New complaint"
      action={
        <button type="button" onClick={onClose} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-ink-900">
          <X size={16} /> Cancel
        </button>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Shipment">
          <select className={inputCls} value={form.awbNumber} onChange={set('awbNumber')}>
            <option value="">General (not about one shipment)</option>
            {(shipments ?? []).map((s) => (
              <option key={s.number} value={s.number}>
                AWB {s.number} · {s.consignee}, {s.city}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Subject" required>
          <input className={inputCls} value={form.subject} onChange={set('subject')} maxLength={150} required placeholder="e.g. Parcel not delivered yet" />
        </Field>
        <Field label="What happened?" required className="sm:col-span-2">
          <textarea rows={4} className={inputCls} value={form.body} onChange={set('body')} maxLength={2000} required />
        </Field>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent-600 sm:col-span-2">
            {error}
          </p>
        )}
        <div className="flex justify-end sm:col-span-2">
          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy ? 'Sending…' : 'Send complaint'}
          </button>
        </div>
      </form>
    </Card>
  )
}

export function ComplaintList() {
  const { preview } = usePortalAccount()
  const [params, setParams] = useSearchParams()
  const { data: list, error, reload } = useApi(() => (preview ? Promise.resolve([]) : listMyComplaints()), [preview])
  if (preview) return <PreviewOnly />
  if (!list) return <LoadState error={error} onRetry={reload} />

  const showForm = params.has('new')
  return (
    <div className="space-y-6">
      <PageHeader
        title="Complaints"
        subtitle="Tell APX about a problem with a shipment, and follow the reply here."
        actions={
          !showForm && (
            <button type="button" className={btnPrimary} onClick={() => setParams({ new: '1' })}>
              <Plus size={16} /> New complaint
            </button>
          )
        }
      />
      {showForm && <NewComplaint awb={params.get('awb')} onClose={() => setParams({})} />}

      {list.length === 0 ? (
        !showForm && (
          <Empty icon={MessageSquareWarning} title="No complaints">
            If something goes wrong with a shipment, raise a complaint and APX will reply here.
          </Empty>
        )
      ) : (
        <>
        {/* Phones: one card per complaint */}
        <ul className="space-y-3 sm:hidden">
          {list.map((c) => (
            <li key={c.id}>
              <Link to={`/portal/complaints/${c.id}`} className="block rounded-2xl border border-slate-200 bg-white p-4 active:bg-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold text-brand-500">{c.number}</p>
                  <ComplaintStatus status={c.status} />
                </div>
                <p className="mt-1 font-semibold text-ink-900">{c.subject}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {c.awbNumber ? `AWB ${c.awbNumber} · ` : ''}
                  {when(c.lastMessageAt)}
                </p>
                {c.lastFromStaff && c.status !== 'Resolved' && (
                  <span className="mt-2 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-600">APX replied</span>
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
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">AWB</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link to={`/portal/complaints/${c.id}`} className="font-bold text-brand-500 hover:text-accent-500">
                      {c.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/portal/complaints/${c.id}`} className="text-ink-900 hover:text-brand-500">
                      {c.subject}
                    </Link>
                    {c.lastFromStaff && c.status !== 'Resolved' && (
                      <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-600">APX replied</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{c.awbNumber || '—'}</td>
                  <td className="px-4 py-3">
                    <ComplaintStatus status={c.status} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">{when(c.lastMessageAt)}</td>
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

export function ComplaintDetail() {
  const { id } = useParams()
  const { preview } = usePortalAccount()
  const { data: c, error, reload, setData } = useApi(() => (preview ? Promise.resolve(null) : getMyComplaint(id)), [id, preview])
  if (preview) return <PreviewOnly />
  if (error?.status === 404) {
    return (
      <Empty icon={MessageSquareWarning} title="Complaint not found">
        <Link to="/portal/complaints" className="font-semibold text-brand-500">
          Back to complaints
        </Link>
      </Empty>
    )
  }
  if (!c) return <LoadState error={error} onRetry={reload} />

  return (
    <div className="space-y-6">
      <div>
        <Link to="/portal/complaints" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-ink-900">
          <ArrowLeft size={16} /> Complaints
        </Link>
        <h1 className="mt-2 flex flex-wrap items-center gap-3 text-2xl font-extrabold text-ink-900 sm:text-3xl">
          {c.subject} <ComplaintStatus status={c.status} />
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {c.number} · raised {when(c.createdAt)}
          {c.awbNumber && (
            <>
              {' · '}
              <Link to={`/portal/shipments/${c.awbNumber}`} className="font-semibold text-brand-500 hover:text-accent-500">
                AWB {c.awbNumber}
              </Link>
            </>
          )}
        </p>
      </div>

      <Card>
        <Thread messages={c.messages} side="customer" />
      </Card>

      <Card title="Reply">
        <ReplyBox
          onSend={async (text) => setData(await replyToMyComplaint(c.id, text))}
          hint={c.status === 'Resolved' ? 'APX marked this resolved. Replying opens it again.' : undefined}
        />
      </Card>
    </div>
  )
}
