import { useLayoutEffect, useRef } from 'react'
import { calcWeights } from '../../lib/awb'
import { carrierFor } from '../../lib/tracking'
import './shippingLabel.css'

// Shrinks the text inside a box until it fits; maxLines lets long services wrap (e.g. DIRECT USA DUTY PAID FEDEX ECONOMY).
function FitText({ children, className, maxLines = 1 }) {
  const boxRef = useRef(null)
  const textRef = useRef(null)
  useLayoutEffect(() => {
    const box = boxRef.current
    const text = textRef.current
    box.style.fontSize = ''
    let size = parseFloat(getComputedStyle(box).fontSize)
    const max = box.clientWidth - 12
    while ((text.offsetWidth > max || text.offsetHeight > size * 1.25 * maxLines) && size > 8) {
      size -= 1
      box.style.fontSize = `${size}px`
    }
  }, [children, maxLines])
  return (
    <div ref={boxRef} className={className}>
      <span ref={textRef} style={{ display: 'inline-block' }}>
        {children}
      </span>
    </div>
  )
}

const join = (...parts) => parts.filter(Boolean).join(', ')

// 4x6 inch thermal sticker for the parcel; service and carrier come from the AWB.
export default function ShippingLabel({ awb }) {
  const { shipper, consignee } = awb
  const date = new Date(awb.createdAt).toLocaleDateString('en-GB')
  const weight = calcWeights(awb.pieces, awb.actualWeight).actual
  const carrier = carrierFor({ awb }).toUpperCase() || 'APX'

  return (
    <div className="lbl">
      {awb.status === 'Void' && <div className="lbl-void">VOID</div>}
      <div className="lbl-head">
        <img src="/apx-logo.svg" alt="APX International" />
        <div className="lbl-tag">
          <b>APX INTERNATIONAL</b>
          Courier &amp; Logistics
        </div>
      </div>

      <div className="lbl-svc">
        <FitText className="lbl-carrier">{carrier}</FitText>
        <div className="lbl-meta">
          <div className="lbl-web">apxintl.net</div>
          <b>APX SHIPMENT</b>
          <div>Pieces: {awb.pieces.length}</div>
          <div>Weight: {Number(weight.toFixed(3))} kg</div>
          <div className="lbl-paid">
            APX PAID
            {awb.accountNo && <small>Acc: {awb.accountNo}</small>}
          </div>
          <div className="lbl-date">{date}</div>
        </div>
      </div>

      <FitText className="lbl-bar" maxLines={2}>{awb.service}</FitText>

      <div className="lbl-from">
        <div>
          {shipper.name}
          <br />
          {shipper.address}
          <br />
          {join(shipper.city, shipper.zip)}
          <br />
          {shipper.country}
          {shipper.phone && (
            <>
              <br />
              PHONE: {shipper.phone}
            </>
          )}
        </div>
        <div className="lbl-created">Created {date}</div>
      </div>

      <div className="lbl-to">
        <div className="lbl-to-tag">SHIP TO:</div>
        {consignee.name}
        {consignee.company && consignee.company !== consignee.name && (
          <>
            <br />
            {consignee.company}
          </>
        )}
        {awb.shipperReference && (
          <>
            <br />
            REF: {awb.shipperReference}
          </>
        )}
        <br />
        {consignee.address}
        <br />
        {join(consignee.city, consignee.zip)}
        <br />
        {consignee.country}
      </div>

      <div className="lbl-track">
        <div className="lbl-track-tag">APX TRACKING #</div>
        <FitText className="lbl-track-no">{awb.number}</FitText>
      </div>

      <div className="lbl-foot">
        <span>{consignee.phone && `Ph: ${consignee.phone}`}</span>
        <span>www.apxintl.net</span>
      </div>
    </div>
  )
}
