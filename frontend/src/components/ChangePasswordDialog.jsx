import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, KeyRound } from 'lucide-react'
import { changePassword } from '../lib/auth'

const inputCls =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none'

export default function ChangePasswordDialog({ onClose }) {
  const [form, setForm] = useState({ current: '', next: '', repeat: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const firstRef = useRef(null)
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  useEffect(() => {
    firstRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.next.length < 8) return setError('New password must be at least 8 characters.')
    if (form.next !== form.repeat) return setError('The new passwords do not match.')
    setSaving(true)
    try {
      await changePassword(form.current, form.next)
      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
        className="relative max-h-full w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
      >
        {done ? (
          <div className="text-center">
            <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
            <h2 id="change-password-title" className="mt-3 text-lg font-bold text-ink-900">
              Password changed
            </h2>
            <p className="mt-1 text-sm text-slate-500">Use your new password next time you sign in.</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 rounded-xl bg-ink-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink-800"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-500">
                <KeyRound size={22} />
              </span>
              <h2 id="change-password-title" className="text-lg font-bold text-ink-900">
                Change password
              </h2>
            </div>
            <div className="mt-5 space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Current password</span>
                <input ref={firstRef} type="password" autoComplete="current-password" className={inputCls} value={form.current} onChange={set('current')} required />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">New password (min 8 characters)</span>
                <input type="password" autoComplete="new-password" className={inputCls} value={form.next} onChange={set('next')} required />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Repeat new password</span>
                <input type="password" autoComplete="new-password" className={inputCls} value={form.repeat} onChange={set('repeat')} required />
              </label>
            </div>
            {error && (
              <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent-600">
                {error}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink-800 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Change password'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}
