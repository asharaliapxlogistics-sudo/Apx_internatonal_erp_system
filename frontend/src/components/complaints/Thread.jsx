import { useState } from 'react'
import { Send } from 'lucide-react'
import { COMPLAINT_TONE, when } from '../../lib/complaints'

export function ComplaintStatus({ status }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${COMPLAINT_TONE[status] ?? ''}`}>{status}</span>
}

// Message thread of one complaint. `side` is who is reading ('customer' or 'staff'): their own messages sit on the right.
export function Thread({ messages, side }) {
  return (
    <ol className="space-y-4">
      {messages.map((m) => {
        const mine = (side === 'staff') === m.fromStaff
        return (
          <li key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${mine ? 'rounded-br-md bg-brand-500 text-white' : 'rounded-bl-md bg-slate-100 text-ink-900'}`}>
              <p className={`text-xs font-semibold ${mine ? 'text-white/80' : 'text-slate-500'}`}>
                {m.fromStaff ? (side === 'staff' ? m.authorName : 'APX International') : m.authorName}
              </p>
              <p className="mt-1 text-sm whitespace-pre-wrap">{m.body}</p>
              <p className={`mt-1 text-[11px] ${mine ? 'text-white/70' : 'text-slate-400'}`}>{when(m.createdAt)}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// Reply box under a thread. `onSend(text)` returns a promise; the box clears when it succeeds.
export function ReplyBox({ onSend, placeholder = 'Write a reply…', hint }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    setError('')
    try {
      await onSend(text.trim())
      setText('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(e)
        }}
        maxLength={2000}
        placeholder={placeholder}
        aria-label="Reply"
        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
      />
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-accent-600">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400">{hint ?? 'Ctrl + Enter to send'}</p>
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 hover:bg-accent-600 disabled:opacity-60"
        >
          <Send size={16} /> {busy ? 'Sending…' : 'Send'}
        </button>
      </div>
    </form>
  )
}
