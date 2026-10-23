import { Plus, Trash2 } from 'lucide-react'
import Combobox from '../Combobox'
import { INVOICE_TYPES, UNITS, emptyItem, itemTotal, itemsTotal } from '../../lib/awb'

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none'
const errCls = 'border-accent-500 bg-red-50/40 focus:border-accent-500 focus:ring-red-100'

const usd = (n) => Number(n || 0).toFixed(2)

// Customs invoice type and item lines (used on the new AWB form and on the AWB's customs invoice page).
export default function CustomsItems({ invoiceType, onInvoiceTypeChange, items, onItemsChange, errors = {} }) {
  const setItem = (n, key) => (e) => onItemsChange(items.map((i, j) => (j === n ? { ...i, [key]: e.target?.value ?? e } : i)))

  return (
    <div className="space-y-3">
      <label className="block max-w-xs">
        <span className="text-xs font-semibold text-slate-600">Invoice type</span>
        <select className={`${inputCls} mt-1`} value={invoiceType} onChange={(e) => onInvoiceTypeChange(e.target.value)}>
          {INVOICE_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="text-left text-xs font-semibold text-slate-500">
            <tr>
              <th className="w-8 py-2">#</th>
              <th className="min-w-[240px] py-2 pr-2">Description</th>
              <th className="w-36 py-2 pr-2">HS code</th>
              <th className="w-32 py-2 pr-2">Unit</th>
              <th className="w-24 py-2 pr-2">Quantity</th>
              <th className="w-28 py-2 pr-2">Unit price (USD)</th>
              <th className="w-24 py-2 text-right">Total (USD)</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {items.map((i, n) => {
              const cls = `${inputCls} ${errors[`item.${n}`] ? errCls : ''}`
              return (
                <tr key={n} className="align-top">
                  <td className="py-1.5 pt-3.5 text-xs font-semibold text-slate-500">{n + 1}</td>
                  <td className="py-1.5 pr-2">
                    <input data-field={`item.${n}`} className={cls} value={i.description} onChange={setItem(n, 'description')} placeholder="e.g. MENS SWEATER" maxLength={190} />
                    {errors[`item.${n}`] && (
                      <p role="alert" className="mt-1 text-xs font-medium text-accent-600">
                        {errors[`item.${n}`]}
                      </p>
                    )}
                  </td>
                  <td className="py-1.5 pr-2">
                    <input className={inputCls} value={i.hsCode} onChange={setItem(n, 'hsCode')} placeholder="6110309100" maxLength={20} />
                  </td>
                  <td className="py-1.5 pr-2">
                    <Combobox className={inputCls} options={UNITS} value={i.unit} onChange={setItem(n, 'unit')} />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input className={cls} type="number" min="0" step="any" value={i.quantity} onChange={setItem(n, 'quantity')} />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input className={cls} type="number" min="0" step="any" value={i.unitPrice} onChange={setItem(n, 'unitPrice')} />
                  </td>
                  <td className="py-1.5 pt-3.5 text-right font-semibold text-ink-900">{usd(itemTotal(i))}</td>
                  <td className="py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => onItemsChange(items.length > 1 ? items.filter((_, j) => j !== n) : [{ ...emptyItem }])}
                      aria-label={`Remove item ${n + 1}`}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-accent-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onItemsChange([...items, { ...emptyItem }])}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-brand-500 hover:bg-brand-50"
        >
          <Plus size={16} /> Add item
        </button>
        <p className="text-sm text-slate-600">
          Invoice total <span className="ml-1 font-bold text-ink-900">USD {usd(itemsTotal(items))}</span>
        </p>
      </div>
    </div>
  )
}
