import { Link, useParams } from 'react-router-dom'
import LoadState from '../../../components/LoadState'
import { useApi } from '../../../hooks/useApi'
import { getInvoice } from '../../../lib/invoices'
import InvoiceForm from './InvoiceForm'

// Edit an issued invoice in the same form as a new one.
export default function InvoiceEdit() {
  const { id } = useParams()
  const { data: invoice, error, reload } = useApi(() => getInvoice(id), [id])

  if (error?.status === 404) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <p className="font-semibold text-ink-900">Invoice not found</p>
        <Link to="/admin/billing" className="mt-3 inline-block text-sm font-semibold text-brand-500">
          Back to Billing & Invoices
        </Link>
      </div>
    )
  }
  if (!invoice) return <LoadState error={error} onRetry={reload} />
  return <InvoiceForm key={invoice.id} existing={invoice} />
}
