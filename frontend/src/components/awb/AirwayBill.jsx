import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'
import { QRCodeSVG } from 'qrcode.react'
import { useAppSettings } from '../../context/AppSettings'
import { calcWeights, formatDimensions, kg, trackingUrl } from '../../lib/awb'
import './airwayBill.css'

function Barcode({ value }) {
  const ref = useRef(null)
  useEffect(() => {
    JsBarcode(ref.current, value, { format: 'CODE128', displayValue: false, height: 34, width: 2, margin: 0 })
  }, [value])
  return <svg ref={ref} className="awb-barcode" />
}

// One labelled value: small grey label above, bold uppercase value.
function Field({ label, children, className = '' }) {
  return (
    <div className={`awb-field ${className}`}>
      <span className="awb-label">{label}</span>
      <span className="awb-value">{children || ' '}</span>
    </div>
  )
}

// Package box: same as Field inside a bordered cell; "dark" fills it navy.
function Box({ label, children, dark, className = '' }) {
  return (
    <div className={`awb-box ${dark ? 'awb-box-dark' : ''} ${className}`}>
      <span className="awb-label">{label}</span>
      <span className="awb-value">{children || ' '}</span>
    </div>
  )
}

// Printable Air Waybill: navy side panel (logo, barcode, route, QR) and shipment details on the right.
export default function AirwayBill({ awb, copyLabel }) {
  const { trackingUrl: trackingPage } = useAppSettings()
  const { shipper, consignee } = awb
  const created = new Date(awb.createdAt)
  const date = created.toLocaleDateString('en-GB')
  const time = created.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  const weights = calcWeights(awb.pieces, awb.actualWeight)

  return (
    <div className="awb-sheet">
      {awb.status === 'Void' && <div className="awb-void">VOID</div>}
      <div className="awb">
        <aside className="awb-side">
          <div className="awb-brand">
            <img src="/apx-logo-light.svg" alt="APX International" />
          </div>

          <div className="awb-number">
            <p className="awb-title">AIRWAY BILL</p>
            <Barcode value={awb.number} />
            <p className="awb-digits">{awb.number}</p>
          </div>

          <div className="awb-side-grid">
            <Field label="Date">{date}</Field>
            <Field label="Time">{time}</Field>
            <Field label="Account #" className="awb-span">{awb.accountNo}</Field>
          </div>

          <div className="awb-route">
            <Field label="Origin" className="awb-place">{shipper.country}</Field>
            <span className="awb-route-icon" aria-hidden="true">✈ ↓</span>
            <Field label="Destination" className="awb-place">{consignee.country}</Field>
          </div>

          <div className="awb-qr">
            <QRCodeSVG value={trackingUrl(awb.number, trackingPage)} size={52} level="M" />
            <span>
              SCAN
              <br />
              TO TRACK
            </span>
          </div>
        </aside>

        <main className="awb-main">
          <header className="awb-head">
            <h2>SHIPMENT DETAILS</h2>
            {copyLabel && <span className="awb-copy">{copyLabel}</span>}
          </header>

          <div className="awb-parties">
            <section className="awb-party">
              <h3>SHIPPER</h3>
              <div className="awb-grid">
                <Field label="Shipper's Name" className="awb-span awb-name">{shipper.name}</Field>
                <Field label="Shipper's Address" className="awb-span">{shipper.address}</Field>
                <Field label="City">{shipper.city}</Field>
                <Field label="Zip Code">{shipper.zip}</Field>
                <Field label="Country">{shipper.country}</Field>
                <Field label="Shipper NTN / CNIC">{shipper.ntnCnic}</Field>
                <Field label="Shipper Email">{shipper.email}</Field>
                <Field label="Shipper's Telephone #">{shipper.phone}</Field>
              </div>
            </section>

            <section className="awb-party awb-party-red">
              <h3>CONSIGNEE</h3>
              <div className="awb-grid">
                <Field label="Consignee Name" className="awb-name">{consignee.name}</Field>
                <Field label="Consignee Company" className="awb-name">{consignee.company}</Field>
                <Field label="Consignee's Address" className="awb-span">{consignee.address}</Field>
                <Field label="City">{consignee.city}</Field>
                <Field label="Zip Code">{consignee.zip}</Field>
                <Field label="Country">{consignee.country}</Field>
                <Field label="Bag Number">{awb.bagNumber}</Field>
                <Field label="Consignee's Email">{consignee.email}</Field>
                <Field label="Consignee's Telephone #">{consignee.phone}</Field>
              </div>
            </section>
          </div>

          <h3 className="awb-section">PACKAGE</h3>
          <div className="awb-package">
            <Box label="Shipper's Reference">{awb.shipperReference}</Box>
            <Box label="Pieces">{awb.pieces.length}</Box>
            <Box label="Weight">{kg(weights.actual)}</Box>
            <Box label="Volumetric Weight">{kg(weights.volumetric)}</Box>
            <Box label="Chargeable Weight" dark>{kg(weights.chargeable)}</Box>
            <Box label="Dimension">{formatDimensions(awb.pieces)}</Box>
            <Box label="Service">{awb.service}</Box>
            <Box label="Fragile">{awb.fragile ? 'Yes' : 'No'}</Box>
            <Box label="Bag Number">{awb.bagNumber}</Box>
            <Box label="Decleared Value" dark>{Number(awb.declaredValue || 0).toFixed(2)}</Box>
          </div>

          <div className="awb-details">
            <Box label="Product Detail">{awb.productDetail}</Box>
            <Box label="Comments">{awb.comments}</Box>
          </div>

          <p className="awb-note">
            <b>NOTE:</b> PLEASE DO NOT ACCEPT, IF THE SHIPMENT IS NOT INTACT.
          </p>
        </main>
      </div>
      <div className="awb-cut" />
    </div>
  )
}
