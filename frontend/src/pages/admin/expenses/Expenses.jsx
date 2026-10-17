import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Printer, Trash2, Wallet, X } from 'lucide-react'
import {
  EXPENSE_CATEGORIES,
  EXPENSE_METHODS,
  createExpense,
  deleteExpense,
  expensesTotal,
  listExpenses,
  updateExpense,
} from '../../../lib/expenses'
import Combobox from '../../../components/Combobox'
import LoadState from '../../../components/LoadState'
import { useDialog } from '../../../context/Dialog'
import { useApi } from '../../../hooks/useApi'
import { money, shortDate } from '../../../lib/invoices'

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none'

// Local calendar date as YYYY-MM-DD (toISOString would give the UTC date).
function localDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function rangeFor(preset) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  switch (preset) {
    case 'today':
      return [localDate(), localDate()]
    case 'yesterday': {
      const d = new Date(y, m, now.getDate() - 1)
      return [localDate(d), localDate(d)]
    }
    case 'month':
      return [localDate(new Date(y, m, 1)), localDate(new Date(y, m + 1, 0))]
    case 'lastMonth':
      return [localDate(new Date(y, m - 1, 1)), localDate(new Date(y, m, 0))]
    default:
      return null
  }
}

const PRESETS = [
  ['today', 'Today'],
  ['yesterday', 'Yesterday'],
  ['month', 'This month'],
  ['lastMonth', 'Last month'],
  ['custom', 'Custom'],
]

const emptyForm = () => ({
  date: localDate(),
  category: '',
  description: '',
  amount: '',
  method: 'Cash',
  paidTo: '',
})

function Field({ label, required, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-semibold text-slate-600">
        {label}
        {required && <span className="text-accent-500"> *</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

export default function Expenses() {
  const { data, error: loadError, reload } = useApi(() => listExpenses(), [])
  const all = data ?? []
  const [saving, setSaving] = useState(false)
  const { confirm } = useDialog()
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const [preset, setPreset] = useState('month')
  const [custom, setCustom] = useState(() => rangeFor('month'))
  const [category, setCategory] = useState('All')
  const formRef = useRef(null)

  const [from, to] = preset === 'custom' ? custom : rangeFor(preset)
  const inRange = all.filter((e) => e.date >= from && e.date <= to)
  const shown = inRange
    .filter((e) => category === 'All' || e.category === category)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))

  const byDay = shown.reduce((acc, e) => {
    ;(acc[e.date] ??= []).push(e)
    return acc
  }, {})

  const byCategory = Object.entries(
    inRange.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + (Number(e.amount) || 0)
      return acc
    }, {}),
  ).sort((a, b) => b[1] - a[1])
  const periodTotal = expensesTotal(inRange)
  const todayTotal = expensesTotal(all.filter((e) => e.date === localDate()))

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  function resetForm() {
    setForm(emptyForm())
    setEditingId(null)
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const data = { ...form, amount: Number(form.amount), category: form.category.trim() }
    setSaving(true)
    try {
      if (editingId) await updateExpense(editingId, data)
      else await createExpense(data)
    } catch (err) {
      setSaving(false)
      return setError(err.message)
    }
    setSaving(false)
    reload()
    resetForm()
  }

  function startEdit(x) {
    setEditingId(x.id)
    setForm({
      date: x.date,
      category: x.category,
      description: x.description,
      amount: String(x.amount),
      method: x.method,
      paidTo: x.paidTo,
    })
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function handleDelete(x) {
    const ok = await confirm({
      title: 'Delete this expense?',
      message: `"${x.description || x.category}" of Rs ${money(x.amount)} on ${shortDate(x.date)} will be removed permanently.`,
      confirmText: 'Delete',
      danger: true,
    })
    if (!ok) return
    setError('')
    try {
      await deleteExpense(x.id)
    } catch (err) {
      return setError(err.message)
    }
    if (editingId === x.id) resetForm()
    reload()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-ink-900">Office Expenses</h1>
          <p className="mt-1 text-sm text-slate-500">
            Today: <span className="font-bold text-ink-900">Rs {money(todayTotal)}</span>
          </p>
        </div>
      </div>

      {/* Entry form */}
      <form ref={formRef} onSubmit={handleSubmit} className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold text-ink-900">{editingId ? 'Edit expense' : 'Add expense'}</h2>
          {editingId && (
            <button type="button" onClick={resetForm} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-ink-900">
              <X size={16} /> Cancel edit
            </button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Field label="Date" required>
            <input type="date" className={inputCls} value={form.date} onChange={set('date')} max={localDate()} required />
          </Field>
          <Field label="Category" required className="lg:col-span-2">
            <Combobox
              className={inputCls}
              options={EXPENSE_CATEGORIES}
              placeholder="e.g. Fuel"
              value={form.category}
              onChange={(v) => setForm({ ...form, category: v })}
              required
            />
          </Field>
          <Field label="Description" className="lg:col-span-3">
            <input className={inputCls} placeholder="e.g. Petrol for pickup bike" value={form.description} onChange={set('description')} />
          </Field>
          <Field label="Amount (PKR)" required>
            <input type="number" min="1" step="any" className={`${inputCls} font-semibold`} value={form.amount} onChange={set('amount')} required />
          </Field>
          <Field label="Payment method">
            <select className={inputCls} value={form.method} onChange={set('method')}>
              {EXPENSE_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="Paid to" className="lg:col-span-4">
            <input className={inputCls} placeholder="e.g. PSO Gulshan" value={form.paidTo} onChange={set('paidTo')} />
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
            {editingId ? 'Save changes' : (
              <>
                <Plus size={16} /> Add expense
              </>
            )}
          </button>
        </div>
      </form>

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPreset(key)}
              className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                preset === key ? 'bg-ink-950 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" className={`${inputCls} w-40`} value={custom[0]} onChange={(e) => setCustom([e.target.value, custom[1]])} />
            <span className="text-sm text-slate-400">to</span>
            <input type="date" className={`${inputCls} w-40`} value={custom[1]} onChange={(e) => setCustom([custom[0], e.target.value])} />
          </div>
        )}
        <select className={`${inputCls} lg:ml-auto lg:w-56`} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
          <option value="All">All categories</option>
          {[...new Set([...EXPENSE_CATEGORIES, ...all.map((e) => e.category)])].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Day-wise list */}
        <section className="space-y-4 xl:col-span-2">
          {!data ? (
            <LoadState error={loadError} onRetry={reload} />
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
              <Wallet size={36} className="text-slate-300" />
              <p className="mt-4 font-semibold text-ink-900">No expenses in this period</p>
            </div>
          ) : (
            Object.entries(byDay).map(([day, items]) => (
              <div key={day} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between bg-slate-50 px-5 py-2.5">
                  <p className="text-sm font-bold text-ink-900">
                    {new Date(`${day}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  <p className="text-sm font-bold text-ink-900">Rs {money(expensesTotal(items))}</p>
                </div>
                <ul className="divide-y divide-slate-100">
                  {items.map((x) => (
                    <li key={x.id} className={`flex items-center gap-4 px-5 py-3 ${editingId === x.id ? 'bg-brand-50/60' : ''}`}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-ink-900">
                          {x.description || x.category}
                          <span className="ml-2 text-xs font-semibold text-slate-400">{x.number}</span>
                        </p>
                        <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600">{x.category}</span>
                          <span>{x.method}</span>
                          {x.paidTo && <span>· {x.paidTo}</span>}
                        </p>
                      </div>
                      <p className="font-bold whitespace-nowrap text-ink-900">Rs {money(x.amount)}</p>
                      <div className="flex gap-1">
                        <Link
                          to={`/admin/expenses/${x.id}/receipt`}
                          aria-label="Print receipt"
                          title="Receipt"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-ink-900"
                        >
                          <Printer size={16} />
                        </Link>
                        <button
                          onClick={() => startEdit(x)}
                          aria-label="Edit expense"
                          title="Edit"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-500"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(x)}
                          aria-label="Delete expense"
                          title="Delete"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-accent-500"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>

        {/* Summary */}
        <aside className="h-fit space-y-4">
          <div className="relative overflow-hidden rounded-2xl bg-ink-950 p-5 text-white">
            <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-accent-500/40 blur-2xl" />
            <p className="relative text-sm text-slate-300">
              Total · {from === to ? shortDate(from) : `${shortDate(from)} – ${shortDate(to)}`}
            </p>
            <p className="relative mt-1 text-3xl font-extrabold">Rs {money(periodTotal)}</p>
            <p className="relative mt-1 text-xs text-slate-400">
              {inRange.length} {inRange.length === 1 ? 'entry' : 'entries'}
            </p>
          </div>

          {byCategory.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 font-bold text-ink-900">By category</h2>
              <ul className="space-y-3">
                {byCategory.map(([cat, amt]) => (
                  <li key={cat}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-slate-600">{cat}</span>
                      <span className="font-bold text-ink-900">Rs {money(amt)}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${(amt / periodTotal) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
