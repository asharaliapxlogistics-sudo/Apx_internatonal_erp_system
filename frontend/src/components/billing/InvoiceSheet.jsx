import { useAppSettings } from '../../context/AppSettings'
import { amountInWords } from '../../lib/amountInWords'
import { useCustomerFilter } from '../../context/CustomerFilter'
import { invoiceTotals, monthLabel, money, shortDate } from '../../lib/invoices'
import './invoiceSheet.css'

// Printable monthly invoice (A4 portrait) with the APX letterhead.
// `customer` is passed by the portal, which has no admin customer list.
export default function InvoiceSheet({ invoice, customer: given }) {
  const { company } = useAppSettings()
  const t = invoiceTotals(invoice)
  const filter = useCustomerFilter()
  const customer = given ?? filter?.customers.find((c) => c.id === invoice.customerId)
  const issued = invoice.createdAt.slice(0, 10)

  return (
    <div className="inv-sheet">
      <header className="inv-top">
        <img src="/apx-logo.svg" alt="APX International" className="inv-logo" />
        <div className="inv-company">
          <p className="inv-company-name">{company.name}</p>
          <p>{company.office}</p>
          <p>TEL # {company.phone}</p>
          {company.email && <p>{company.email}</p>}
          {company.ntn && <p>NTN: {company.ntn}</p>}
        </div>
      </header>
      <div className="inv-band" />

      <section className="inv-meta">
        <div className="inv-billto">
          <p className="inv-eyebrow">Bill to</p>
          <p className="inv-customer">M/S. {invoice.customerName}</p>
          {customer?.address && <p>{customer.address}</p>}
          {customer && (customer.city || customer.country) && (
            <p>{[customer.city, customer.country].filter(Boolean).join(', ')}</p>
          )}
          {customer?.phone && <p>Tel: {customer.phone}</p>}
          {customer?.ntn && <p>NTN: {customer.ntn}</p>}
        </div>

        <div className="inv-details">
          <h1 className="inv-title">INVOICE</h1>
          <dl>
            <dt>Invoice #</dt>
            <dd>{invoice.number}</dd>
            <dt>Account #</dt>
            <dd>{invoice.accountNo}</dd>
            <dt>Billing month</dt>
            <dd>{monthLabel(invoice.month)}</dd>
            <dt>Invoice date</dt>
            <dd>{shortDate(issued)}</dd>
          </dl>
        </div>
      </section>

      <table className="inv-table">
        <thead>
          <tr>
            <th className="c">S.#</th>
            <th>Date</th>
            <th>Tracking #</th>
            <th className="c">Nature</th>
            <th>Service</th>
            <th>Country</th>
            <th>Consignee Name</th>
            <th className="r">Weight</th>
            <th className="r">Amount (Rs)</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((l, i) => (
            <tr key={i}>
              <td className="c muted">{i + 1}</td>
              <td className="nowrap">{shortDate(l.date)}</td>
              <td className="mono">{l.tracking}</td>
              <td className="c">{l.nature}</td>
              <td className="upper">{l.service}</td>
              <td className="upper">{l.country}</td>
              <td className="upper">{l.consignee}</td>
              <td className="r nowrap">{l.weight !== '' && l.weight != null ? `${l.weight} KG` : ''}</td>
              <td className="r strong">{money(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="inv-summary">
        <div className="inv-words">
          <p className="inv-eyebrow">Amount payable in words</p>
          <p className="inv-words-text">Rupees {amountInWords(t.payable)} Only</p>
          <p className="inv-count">
            {invoice.lines.length} {invoice.lines.length === 1 ? 'shipment' : 'shipments'} this month
          </p>
        </div>

        <dl className="inv-totals">
          <div>
            <dt>Total invoice amount</dt>
            <dd>{money(t.total)}</dd>
          </div>
          <div>
            <dt>Previous balance</dt>
            <dd>{money(invoice.prevBalance)}</dd>
          </div>
          <div>
            <dt>Received amount</dt>
            <dd>{invoice.received ? `− ${money(invoice.received)}` : money(0)}</dd>
          </div>
          <div className="inv-grand">
            <dt>Total payable</dt>
            <dd>Rs {money(t.payable)}</dd>
          </div>
        </dl>
      </section>

      <section className="inv-sign">
        <div>
          <p className="inv-sign-name">{invoice.preparedBy}</p>
          <p className="inv-sign-line">Prepared by</p>
        </div>
        <div>
          <p className="inv-sign-name">&nbsp;</p>
          <p className="inv-sign-line">Customer signature &amp; stamp</p>
        </div>
      </section>

      <footer className="inv-foot">
        <p>Thank you for shipping with APX International.</p>
        <p>Please quote the invoice number with your payment. This is a computer-generated invoice.</p>
      </footer>
    </div>
  )
}
