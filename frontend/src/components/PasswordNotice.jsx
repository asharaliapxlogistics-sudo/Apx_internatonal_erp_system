import { useState } from 'react'
import { Check, Copy, X } from 'lucide-react'

// Shows a new or reset password once, so the admin can pass it on.
export default function PasswordNotice({ notice, onClose }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(notice.password)
      setCopied(true)
    } catch {
      // Clipboard blocked: the password is on screen to copy by hand.
    }
  }

  return (
    <section role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-bold text-emerald-800">{notice.title}</p>
          <p className="mt-1 text-sm text-emerald-700">
            Give this password to <b>{notice.name}</b> (username <b>{notice.username}</b>). It is shown only now; they can change it from their
            profile menu after signing in.
          </p>
        </div>
        <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100">
          <X size={18} />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="rounded-lg bg-white px-3 py-2 font-mono text-base font-bold tracking-wide text-ink-900 ring-1 ring-emerald-200">
          {notice.password}
        </code>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </section>
  )
}
