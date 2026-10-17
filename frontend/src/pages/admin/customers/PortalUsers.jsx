import { useState } from 'react'
import { ExternalLink, KeyRound, Power, UserPlus, Users, X } from 'lucide-react'
import LoadState from '../../../components/LoadState'
import PasswordNotice from '../../../components/PasswordNotice'
import { useDialog } from '../../../context/Dialog'
import { useApi } from '../../../hooks/useApi'
import { getSession } from '../../../lib/auth'
import { createPortalUser, generatePassword, listPortalUsers, resetPassword, updateUser } from '../../../lib/users'
import { username } from '../../../lib/validation'

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none'

const when = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never')

// Customer-portal logins for one customer company. Admins only.
export default function PortalUsers({ customer }) {
  const isAdmin = getSession()?.role === 'admin'
  const { confirm } = useDialog()
  const { data, error: loadError, reload } = useApi(() => (isAdmin ? listPortalUsers(customer.id) : Promise.resolve([])), [customer.id, isAdmin])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', username: '', password: '' })
  const [notice, setNotice] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(action) {
    setError('')
    setBusy(true)
    try {
      await action()
      await reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function add(e) {
    e.preventDefault()
    const badUsername = username(form.username)
    if (badUsername) return setError(badUsername)
    if (form.password.length < 8) return setError('Password must be at least 8 characters.')
    await run(async () => {
      const user = await createPortalUser(customer.id, { ...form, name: form.name.trim(), username: form.username.trim().toLowerCase() })
      setNotice({ title: 'Portal login created', name: user.name, username: user.username, password: form.password })
      setForm({ name: '', username: '', password: '' })
      setAdding(false)
    })
  }

  async function toggle(u) {
    const ok = await confirm({
      title: `${u.isActive ? 'Disable' : 'Enable'} ${u.name}?`,
      message: u.isActive ? 'They are signed out of the portal at once.' : 'They can sign in to the portal again.',
      confirmText: u.isActive ? 'Disable' : 'Enable',
      danger: u.isActive,
    })
    if (ok) run(() => updateUser(u.id, { isActive: !u.isActive }))
  }

  async function reset(u) {
    const ok = await confirm({ title: `Reset password for ${u.name}?`, message: 'A new password is created and shown once.', confirmText: 'Reset password' })
    if (!ok) return
    const password = generatePassword()
    run(async () => {
      await resetPassword(u.id, password)
      setNotice({ title: 'Password reset', name: u.name, username: u.username, password })
    })
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-bold text-ink-900">
            <Users size={18} className="text-slate-400" /> Portal users
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            People at {customer.name} who can sign in to the customer portal and see this account&apos;s shipments and invoices only.
          </p>
        </div>
        {isAdmin && !adding && (
          <button
            type="button"
            onClick={() => {
              setAdding(true)
              setNotice(null)
              setForm({ name: customer.contactPerson ?? '', email: customer.email ?? '', password: generatePassword() })
            }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-ink-950 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800"
          >
            <UserPlus size={16} /> Add portal login
          </button>
        )}
      </div>

      {!isAdmin ? (
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Only an admin can create or change portal logins.</p>
      ) : (
        <div className="space-y-4">
          {adding && (
            <form onSubmit={add} className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Name</span>
                <input className={`${inputCls} mt-1`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Username</span>
                <input className={`${inputCls} mt-1`} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required autoCapitalize="none" autoComplete="off" spellCheck={false} placeholder="acme_owner" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Password</span>
                <div className="mt-1 flex gap-2">
                  <input className={`${inputCls} font-mono`} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
                  <button type="button" onClick={() => setForm({ ...form, password: generatePassword() })} className="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold hover:bg-slate-100">
                    New
                  </button>
                </div>
              </label>
              <div className="flex gap-2">
                <button type="submit" disabled={busy} className="rounded-xl bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-600 disabled:opacity-60">
                  {busy ? 'Saving…' : 'Create login'}
                </button>
                <button type="button" onClick={() => setAdding(false)} aria-label="Cancel" className="rounded-xl border border-slate-300 bg-white px-3 py-2 hover:bg-slate-100">
                  <X size={16} />
                </button>
              </div>
            </form>
          )}

          {notice && (
            <PasswordNotice key={notice.password} notice={{ ...notice, title: `${notice.title}. They sign in at ${window.location.origin}/portal/login` }} onClose={() => setNotice(null)} />
          )}

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent-600">
              {error}
            </p>
          )}

          {!data ? (
            <LoadState error={loadError} onRetry={reload} />
          ) : data.length === 0 ? (
            <p className="text-sm text-slate-500">
              No portal logins yet. Add one so {customer.name} can send addresses, track shipments and see invoices online.
            </p>
          ) : (
            <ul className="-mx-5 divide-y divide-slate-100 border-t border-slate-100">
              {data.map((u) => (
                <li key={u.id} className={`flex flex-wrap items-center gap-3 px-5 py-3 ${u.isActive ? '' : 'bg-slate-50/70'}`}>
                  <div className="min-w-0 flex-1">
                    <p className={`font-semibold ${u.isActive ? 'text-ink-900' : 'text-slate-400'}`}>{u.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {u.username} · last sign-in {when(u.lastLogin)}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                    {u.isActive ? 'Active' : 'Disabled'}
                  </span>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => reset(u)} disabled={busy} title="Reset password" aria-label={`Reset password for ${u.name}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-500 disabled:opacity-40">
                      <KeyRound size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggle(u)}
                      disabled={busy}
                      title={u.isActive ? 'Disable login' : 'Enable login'}
                      aria-label={`${u.isActive ? 'Disable' : 'Enable'} ${u.name}`}
                      className={`rounded-lg p-1.5 disabled:opacity-40 ${u.isActive ? 'text-slate-400 hover:bg-red-50 hover:text-accent-500' : 'text-emerald-600 hover:bg-emerald-50'}`}
                    >
                      <Power size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <a href="/portal/login" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-500 hover:text-accent-500">
            Customer portal sign-in page <ExternalLink size={12} />
          </a>
        </div>
      )}
    </section>
  )
}
