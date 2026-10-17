import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import LoadState from '../../../components/LoadState'
import { useCustomerFilter } from '../../../context/CustomerFilter'
import { useDialog } from '../../../context/Dialog'
import { CUSTOMER_TYPES, deleteCustomer } from '../../../lib/customers'

export default function CustomerList() {
  const { customers: all, customersLoaded, customersError, reloadCustomers } = useCustomerFilter()
  const { confirm } = useDialog()
  const [query, setQuery] = useState('')
  const [type, setType] = useState('All')
  const [error, setError] = useState('')
  const q = query.trim().toLowerCase()

  const customers = all.filter(
    (c) =>
      (type === 'All' || c.type === type) &&
      (!q ||
        [c.accountNo, c.name, c.contactPerson, c.phone, c.email, c.city, c.ntn, c.cnic]
          .join(' ')
          .toLowerCase()
          .includes(q)),
  )

  async function handleDelete(c) {
    const ok = await confirm({
      title: `Delete ${c.name}?`,
      message: `Customer ${c.accountNo} will be removed permanently. This cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    })
    if (!ok) return
    setError('')
    try {
      await deleteCustomer(c.id)
      reloadCustomers()
    } catch (err) {
      setError(err.message)
    }
  }

  const counts = Object.fromEntries(CUSTOMER_TYPES.map((t) => [t, all.filter((c) => c.type === t).length]))
  if (!customersLoaded) return <LoadState error={customersError} onRetry={reloadCustomers} />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-ink-900">Customers</h1>
          <p className="mt-1 text-sm text-slate-500">
            {all.length} {all.length === 1 ? 'customer' : 'customers'}
          </p>
        </div>
        <Link
          to="/admin/customers/new"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 hover:bg-accent-600"
        >
          <Plus size={18} /> Add Customer
        </Link>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative max-w-md flex-1">
          <Search size={18} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, account #, phone, city, NTN…"
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pr-4 pl-11 text-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {['All', ...CUSTOMER_TYPES].map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                type === t ? 'bg-ink-950 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-100'
              }`}
            >
              {t}
              <span className={`ml-1.5 text-xs ${type === t ? 'text-slate-300' : 'text-slate-400'}`}>
                {t === 'All' ? all.length : counts[t]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent-600">
          {error}
        </p>
      )}

      {customers.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <Building2 size={36} className="text-slate-300" />
          <p className="mt-4 font-semibold text-ink-900">{all.length ? 'No matching customers' : 'No customers yet'}</p>
          {!all.length && (
            <Link to="/admin/customers/new" className="mt-2 text-sm font-semibold text-brand-500 hover:text-accent-500">
              Add the first customer
            </Link>
          )}
        </div>
      ) : (
        <div className="relative overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">Account #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold whitespace-nowrap text-brand-500">{c.accountNo}</td>
                  <td className="px-4 py-3">
                    <Link to={`/admin/customers/${c.id}`} className="font-semibold text-ink-900 hover:text-accent-500">
                      {c.name}
                    </Link>
                    {(c.contactPerson || c.email) && (
                      <p className="text-xs text-slate-500">{c.contactPerson || c.email}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">{c.type}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{c.phone}</td>
                  <td className="px-4 py-3">{c.city}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Link
                        to={`/admin/customers/${c.id}`}
                        aria-label={`Edit ${c.name}`}
                        title="Edit"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-500"
                      >
                        <Pencil size={16} />
                      </Link>
                      <button
                        onClick={() => handleDelete(c)}
                        aria-label={`Delete ${c.name}`}
                        title="Delete"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-accent-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
