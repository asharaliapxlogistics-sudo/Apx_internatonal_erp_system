import { useState } from 'react'
import { KeyRound, Plus, Power, Search, ShieldCheck, UserCog, X } from 'lucide-react'
import LoadState from '../../../components/LoadState'
import PasswordNotice from '../../../components/PasswordNotice'
import { useDialog } from '../../../context/Dialog'
import { useApi } from '../../../hooks/useApi'
import { getSession } from '../../../lib/auth'
import { ROLES, createUser, generatePassword, listUsers, resetPassword, updateUser } from '../../../lib/users'

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none'

const emptyForm = () => ({ name: '', email: '', role: 'staff', password: '' })

function Field({ label, required, hint, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-semibold text-slate-600">
        {label}
        {required && <span className="text-accent-500"> *</span>}
      </span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  )
}

function AddEmployee({ onCreated, onCancel }) {
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) return setError('Password must be at least 8 characters.')
    setSaving(true)
    try {
      const user = await createUser({ ...form, name: form.name.trim(), email: form.email.trim() })
      onCreated(user, form.password)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-brand-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold text-ink-900">Add employee</h2>
        <button type="button" onClick={onCancel} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-ink-900">
          <X size={16} /> Cancel
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required>
          <input className={inputCls} value={form.name} onChange={set('name')} required autoFocus />
        </Field>
        <Field label="Login email" required>
          <input type="email" className={inputCls} value={form.email} onChange={set('email')} required placeholder="name@apxinternational.com" />
        </Field>
        <Field label="Role" required hint={ROLES.find((r) => r.value === form.role)?.hint}>
          <select className={inputCls} value={form.role} onChange={set('role')}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Password" required hint="At least 8 characters. Use Generate for a random one.">
          <div className="flex gap-2">
            <input className={`${inputCls} font-mono`} value={form.password} onChange={set('password')} required minLength={8} autoComplete="new-password" />
            <button
              type="button"
              onClick={() => setForm({ ...form, password: generatePassword() })}
              className="shrink-0 rounded-lg border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-100"
            >
              Generate
            </button>
          </div>
        </Field>
      </div>
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent-600">
          {error}
        </p>
      )}
      <div className="mt-5 flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-xl bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 hover:bg-accent-600 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Create account'}
        </button>
      </div>
    </form>
  )
}

export default function Employees() {
  const me = getSession()
  const { confirm } = useDialog()
  const { data, error: loadError, reload } = useApi(listUsers, [])
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [query, setQuery] = useState('')

  if (me?.role !== 'admin') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <ShieldCheck size={36} className="mx-auto text-slate-300" />
        <p className="mt-4 font-semibold text-ink-900">Only admins can manage employee accounts</p>
      </div>
    )
  }

  // Customer-portal logins are managed with the customer, not here.
  const staff = (data ?? []).filter((u) => u.role !== 'customer')
  const q = query.trim().toLowerCase()
  const shown = staff.filter((u) => !q || `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(q))

  async function run(user, action) {
    setError('')
    setBusyId(user.id)
    try {
      await action()
      await reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function changeRole(user, role) {
    if (role === user.role) return
    const ok = await confirm({
      title: `Make ${user.name} ${role === 'admin' ? 'an Admin' : 'Staff'}?`,
      message:
        role === 'admin'
          ? 'Admins can see and change everything, including employee accounts.'
          : 'They will keep daily access but can no longer manage employee accounts.',
      confirmText: 'Change role',
    })
    if (ok) run(user, () => updateUser(user.id, { role }))
  }

  async function toggleActive(user) {
    const disabling = user.isActive
    const ok = await confirm({
      title: `${disabling ? 'Disable' : 'Enable'} ${user.name}?`,
      message: disabling
        ? 'They are signed out at once and cannot sign in until enabled again. Their past work keeps their name.'
        : 'They will be able to sign in again with their current password.',
      confirmText: disabling ? 'Disable account' : 'Enable account',
      danger: disabling,
    })
    if (ok) run(user, () => updateUser(user.id, { isActive: !disabling }))
  }

  async function handleReset(user) {
    const ok = await confirm({
      title: `Reset password for ${user.name}?`,
      message: 'A new random password is created and shown once. Their old password stops working.',
      confirmText: 'Reset password',
    })
    if (!ok) return
    const password = generatePassword()
    run(user, async () => {
      await resetPassword(user.id, password)
      setNotice({ title: 'Password reset', name: user.name, email: user.email, password })
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-ink-900">Employees & Roles</h1>
          <p className="mt-1 text-sm text-slate-500">Login accounts for your staff. Disable an account when someone leaves.</p>
        </div>
        {!adding && (
          <button
            onClick={() => {
              setAdding(true)
              setNotice(null)
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-white shadow-lg shadow-accent-500/25 hover:bg-accent-600"
          >
            <Plus size={18} /> Add employee
          </button>
        )}
      </div>

      {adding && (
        <AddEmployee
          onCancel={() => setAdding(false)}
          onCreated={(user, password) => {
            setAdding(false)
            setNotice({ title: 'Account created', name: user.name, email: user.email, password })
            reload()
          }}
        />
      )}

      {notice && <PasswordNotice key={notice.password} notice={notice} onClose={() => setNotice(null)} />}

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent-600">
          {error}
        </p>
      )}

      {!data ? (
        <LoadState error={loadError} onRetry={reload} />
      ) : (
        <>
          <div className="relative max-w-md">
            <Search size={18} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or email…"
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pr-4 pl-11 text-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
            />
          </div>

          {shown.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
              <UserCog size={36} className="text-slate-300" />
              <p className="mt-4 font-semibold text-ink-900">No matching employees</p>
            </div>
          ) : (
            <div className="relative overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Added</th>
                    <th className="px-4 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shown.map((u) => {
                    const isMe = u.id === me.id
                    const busy = busyId === u.id
                    return (
                      <tr key={u.id} className={u.isActive ? 'hover:bg-slate-50' : 'bg-slate-50/70 text-slate-400'}>
                        <td className="px-4 py-3">
                          <p className={`font-semibold ${u.isActive ? 'text-ink-900' : ''}`}>
                            {u.name}
                            {isMe && <span className="ml-2 rounded-md bg-brand-50 px-1.5 py-0.5 text-xs font-semibold text-brand-600">You</span>}
                          </p>
                          <p className="text-xs text-slate-500">{u.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            aria-label={`Role of ${u.name}`}
                            value={u.role}
                            disabled={busy || isMe}
                            title={isMe ? 'You cannot change your own role' : undefined}
                            onChange={(e) => changeRole(u, e.target.value)}
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-ink-900 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {ROLES.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              u.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {u.isActive ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-500">{new Date(u.createdAt).toLocaleDateString('en-GB')}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            {/* Your own password and status are managed from the profile menu. */}
                            {!isMe && (
                              <>
                                <button
                                  onClick={() => handleReset(u)}
                                  disabled={busy}
                                  title="Reset password"
                                  aria-label={`Reset password for ${u.name}`}
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-500 disabled:opacity-40"
                                >
                                  <KeyRound size={16} />
                                </button>
                                <button
                                  onClick={() => toggleActive(u)}
                                  disabled={busy}
                                  title={u.isActive ? 'Disable account' : 'Enable account'}
                                  aria-label={`${u.isActive ? 'Disable' : 'Enable'} ${u.name}`}
                                  className={`rounded-lg p-1.5 disabled:opacity-40 ${
                                    u.isActive ? 'text-slate-400 hover:bg-red-50 hover:text-accent-500' : 'text-emerald-600 hover:bg-emerald-50'
                                  }`}
                                >
                                  <Power size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
