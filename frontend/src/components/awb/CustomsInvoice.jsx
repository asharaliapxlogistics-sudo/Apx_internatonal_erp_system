import { formatDimensions, itemTotal, itemsTotal } from '../../lib/awb'
import './customsInvoice.css'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const usd = (n) => Number(n || 0).toFixed(2)
const qty = (n) => String(Number(n || 0))

function Party({ title, party, taxId }) {
  return (
    <section className="ci-party">
      <h3>{title}</h3>
      <dl>
        <dt>Name</dt>
        <dd className="ci-wide">{party.name}</dd>
        <dt>Address</dt>
        <dd className="ci-wide">{[party.company, party.address].filter(Boolean).join(', ')}</dd>
        <dt>City</dt>
        <dd>{party.city}</dd>
        <dt>Postal / Zip Code</dt>
        <dd>{party.zip}</dd>
        <dt>Country</dt>
        <dd>{party.country}</dd>
        <dt>Tax ID</dt>
        <dd>{taxId}</dd>
        <dt>Phone</dt>
        <dd className="ci-wide">{party.phone}</dd>
      </dl>
    </section>
  )
}

// Customs invoice that goes with the AWB (A4 portrait). AWBs saved without item lines
// print one line from the product detail and declared value.
export default function CustomsInvoice({ awb }) {
  const items = awb.items?.length
    ? awb.items
    : [{ description: awb.productDetail, hsCode: '', unit: 'Piece(s)', quantity: 1, unitPrice: awb.declaredValue || 0 }]
  const created = new Date(awb.createdAt)
  const date = `${String(created.getDate()).padStart(2, '0')}/${MONTHS[created.getMonth()]}/${created.getFullYear()}`
  const dims = formatDimensions(awb.pieces)

  return (
    <div className="ci-sheet">
      {awb.status === 'Void' && <div className="ci-void">VOID</div>}
      <header className="ci-head">
        <img src="/apx-logo.svg" alt="APX International" className="ci-logo" />
        <div className="ci-title">
          <p className="ci-type">{awb.invoiceType || 'Gift'} invoice</p>
          <p>
            Air waybill number: <b>{awb.number}</b>
          </p>
        </div>
      </header>

      <div className="ci-parties">
        <Party title="Shipper's details" party={awb.shipper} taxId={awb.shipper.ntnCnic} />
        <Party title="Receiver's details" party={awb.consignee} taxId="" />
      </div>

      <table className="ci-items">
        <thead>
          <tr>
            <th>S. No.</th>
            <th className="ci-left">Particulars / Item Description</th>
            <th>HS Code</th>
            <th>Unit of Measure</th>
            <th>Quantity</th>
            <th>Unit Price (USD)</th>
            <th>Total Price (USD)</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i, n) => (
            <tr key={n}>
              <td>{n + 1}</td>
              <td className="ci-left">{i.description}</td>
              <td>{i.hsCode}</td>
              <td>{i.unit}</td>
              <td>{qty(i.quantity)}</td>
              <td className="ci-num">{usd(i.unitPrice)}</td>
              <td className="ci-num">{usd(itemTotal(i))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} className="ci-left">
              <span className="ci-wpx">WPX</span>
              Total pieces: <b>{awb.pieces.length}</b>
              <span className="ci-sep">·</span>
              Total weight: <b>{Number(awb.actualWeight || 0).toFixed(3)} KG</b>
              {dims && (
                <>
                  <span className="ci-sep">·</span>
                  Dimension: <b>{dims}</b>
                </>
              )}
            </td>
            <td className="ci-num">TOTAL</td>
            <td className="ci-num">
              <b>{usd(itemsTotal(items))}</b>
            </td>
          </tr>
        </tfoot>
      </table>

      <section className="ci-undertaking">
        <h3>Undertaking</h3>
        <p>
          I under sign undertake full responsibility of my parcel # {awb.number}, it does not contain any contraband items, narcotics or
          any IATA restricted items, and assure that my parcel contents, declared value and proof of payment are correct and true.
        </p>
        <p>
          In case of any declaration discrepancy and any duty / taxes at the destination, if not paid by the consignee, it will be the
          sole responsibility of the undersigned.
        </p>
      </section>

      <div className="ci-sign">
        <p>
          Shipper&apos;s Signature: <span className="ci-line" />
        </p>
        <p>
          Shipper&apos;s Thumb Impression: <span className="ci-line" />
        </p>
        <p>
          Date: <b>{date}</b>
        </p>
      </div>
    </div>
  )
}
