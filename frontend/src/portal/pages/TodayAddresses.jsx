import { useRef, useState } from 'react'
import { Check, ClipboardList, Pencil, Plus, Send, Trash2, X } from 'lucide-react'
import LoadState from '../../components/LoadState'
import { splitPastedAddresses } from '../../lib/addressLine'
import { deleteTodayAddress, sendTodayAddresses, updateTodayAddress, useTodayAddresses } from '../data'
import { usePortalAccount } from '../PortalAccount'
import { Card, Empty, PageHeader, PreviewNote, btnPrimary, btnSecondary, inputCls } from '../ui'

const time = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

// The customer sends one address line per shipment for today; APX sees them on the admin "Customer Addresses" page.
export default function TodayAddresses() {
  const { preview } = usePortalAccount()
  const { data: list, error: loadError, reload, setData: setList } = useTodayAddresses()
  const [lines, setLines] = useState([''])
  const [editing, setEditing] = useState(null) // { id, address }
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  // Index of the line to focus when it is rendered (a newly added line).
  const focusNext = useRef(null)
  if (!list) return <LoadState error={loadError} onRetry={reload} />

  const filled = lines.map((l) => l.trim()).filter(Boolean)

  function addLine(after = lines.length - 1) {
    focusNext.current = after + 1
    setLines([...lines.slice(0, after + 1), '', ...lines.slice(after + 1)])
  }

  const lineRef = (i) => (el) => {
    if (el && focusNext.current === i) {
      focusNext.current = null
      el.focus()
    }
  }

  function setLine(i, value) {
    setLines(lines.map((l, j) => (j === i ? value : l)))
  }

  // One box = one address, over as many lines as it takes. Several rows copied from Excel
  // are the exception: each row becomes its own address.
  function pasteInto(i, e) {
    const rows = splitPastedAddresses(e.clipboardData.getData('text'))
    if (rows.length < 2) return
    e.preventDefault()
    const keep = lines[i].trim() ? [lines[i]] : []
    setLines([...lines.slice(0, i), ...keep, ...rows, ...lines.slice(i + 1)])
  }

  async function send(e) {
    e.preventDefault()
    if (!filled.length) return
    setError('')
    setNote('')
    if (preview) {
      const now = new Date().toISOString()
      setList([...list, ...filled.map((address) => ({ id: crypto.randomUUID(), address, createdAt: now }))])
      setLines([''])
      return
    }
    setSaving(true)
    try {
      const saved = await sendTodayAddresses(filled.map((address) => ({ address })))
      setList([...list, ...saved])
      setLines([''])
      setNote(`Sent ${saved.length} ${saved.length === 1 ? 'address' : 'addresses'} to APX.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function saveEdit() {
    const address = editing.address.trim()
    if (!address) return
    setError('')
    setNote('')
    try {
      const saved = preview ? { ...list.find((a) => a.id === editing.id), address } : await updateTodayAddress(editing.id, { address })
      setList(list.map((a) => (a.id === saved.id ? saved : a)))
      setEditing(null)
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(a) {
    if (!window.confirm(`Delete this address?\n\n${a.address}`)) return
    setError('')
    setNote('')
    try {
      if (!preview) await deleteTodayAddress(a.id)
      setList(list.filter((x) => x.id !== a.id))
      if (editing?.id === a.id) setEditing(null)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-6">
      {preview && <PreviewNote />}
      <PageHeader title="Today's addresses" subtitle="One box per shipment. APX sees them as soon as you send." />

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent-600">
          {error}
        </p>
      )}
      {note && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{note}</p>}

      <Card
        title="Add addresses"
        subtitle="Paste or type the full address in a box, as many lines as you like: name, street, city, zip, country, phone, and order #, weight or product if you have them. Pasting several rows from Excel adds one box per row."
      >
        <form onSubmit={send} className="space-y-3">
          {lines.map((line, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-2.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                {i + 1}
              </span>
              <textarea
                ref={lineRef(i)}
                value={line}
                onChange={(e) => setLine(i, e.target.value)}
                onPaste={(e) => pasteInto(i, e)}
                rows={Math.min(12, Math.max(5, line.split('\n').length))}
                maxLength={500}
                placeholder={'e.g.\nSara Malik\n1 High St\nLondon E1 6AN, UK\n+44 7700 900123'}
                aria-label={`Address ${i + 1}`}
                className={`${inputCls} resize-y`}
              />
              {lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLines(lines.filter((_, j) => j !== i))}
                  aria-label={`Remove address ${i + 1}`}
                  className="mt-1.5 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-accent-500"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button type="button" onClick={() => addLine()} className={btnSecondary}>
              <Plus size={16} /> Add another address
            </button>
            <button type="submit" disabled={!filled.length || saving} className={`${btnPrimary} sm:ml-auto`}>
              <Send size={16} />
              {saving ? 'Sending…' : `Send ${filled.length || ''} to APX`.replace('  ', ' ')}
            </button>
          </div>
        </form>
      </Card>

      <Card title={`Sent today (${list.length})`}>
        {list.length === 0 ? (
          <Empty icon={ClipboardList} title="Nothing sent yet today" />
        ) : (
          <ol className="-mx-5 divide-y divide-slate-100">
            {list.map((a, i) => (
              <li key={a.id} className="flex items-start gap-3 px-5 py-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">{i + 1}</span>
                {editing?.id === a.id ? (
                  <>
                    <textarea
                      autoFocus
                      value={editing.address}
                      onChange={(e) => setEditing({ ...editing, address: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveEdit()
                        if (e.key === 'Escape') setEditing(null)
                      }}
                      rows={Math.min(10, Math.max(3, editing.address.split('\n').length))}
                      maxLength={500}
                      aria-label="Edit address"
                      className={`${inputCls} resize-y`}
                    />
                    <button type="button" onClick={saveEdit} aria-label="Save" className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50">
                      <Check size={16} />
                    </button>
                    <button type="button" onClick={() => setEditing(null)} aria-label="Cancel" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm break-words whitespace-pre-line text-ink-900">{a.address}</p>
                      <p className="text-xs text-slate-400 sm:hidden">{time(a.createdAt)}</p>
                    </div>
                    <span className="hidden shrink-0 text-xs text-slate-400 sm:inline">{time(a.createdAt)}</span>
                    <button type="button" onClick={() => setEditing({ id: a.id, address: a.address })} aria-label={`Edit address ${i + 1}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-500">
                      <Pencil size={15} />
                    </button>
                    <button type="button" onClick={() => remove(a)} aria-label={`Delete address ${i + 1}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-accent-500">
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  )
}
