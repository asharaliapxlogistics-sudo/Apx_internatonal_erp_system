// SAMPLE DATA for the customer portal preview. Replaced by real API calls once the portal backend exists.

export const account = {
  company: 'Acme Garments (Pvt) Ltd',
  accountNo: 'APX-1001',
  contactPerson: 'Imran Qureshi',
  email: 'imran@acmegarments.pk',
  phone: '0300-1234567',
  address: 'Plot 12, Sector 7-A, Korangi Industrial Area',
  city: 'Karachi',
  country: 'Pakistan',
  ntn: '1234567-8',
}

export const users = [
  { id: 'u1', name: 'Imran Qureshi', email: 'imran@acmegarments.pk', role: 'Owner', active: true, lastLogin: '2026-10-11T09:12:00Z' },
  { id: 'u2', name: 'Sana Khalid', email: 'sana@acmegarments.pk', role: 'Booking clerk', active: true, lastLogin: '2026-10-10T14:40:00Z' },
  { id: 'u3', name: 'Bilal Hassan', email: 'bilal@acmegarments.pk', role: 'Booking clerk', active: false, lastLogin: '2026-08-02T11:05:00Z' },
]

const ev = (status, at, location, remarks = '') => ({ status, at, location, remarks })

export const shipments = [
  {
    number: '10257091', date: '2026-10-11', consignee: 'Tariq Mahmood', city: 'Birmingham', country: 'United Kingdom',
    service: 'Direct UK DPD', pieces: 2, weight: 24, contents: 'WOMENS DRESS', status: 'Booked',
    events: [ev('Booked', '2026-10-11T10:05', 'Karachi', 'Booked online')],
  },
  {
    number: '10257088', date: '2026-10-09', consignee: 'Omar Farooq', city: 'Dubai', country: 'United Arab Emirates',
    service: 'DHL Express', pieces: 1, weight: 6.5, contents: 'BED SHEETS', status: 'In transit',
    events: [
      ev('Booked', '2026-10-09T11:20', 'Karachi'),
      ev('Picked up', '2026-10-09T16:45', 'Korangi, Karachi'),
      ev('Departed origin', '2026-10-10T03:10', 'Karachi Airport (KHI)'),
      ev('In transit', '2026-10-10T09:30', 'Dubai (DXB)'),
    ],
  },
  {
    number: '10257084', date: '2026-10-06', consignee: 'Saira Begum', city: 'Manchester', country: 'United Kingdom',
    service: 'Direct UK DPD', pieces: 3, weight: 41, contents: 'MENS JACKETS', status: 'Customs hold',
    events: [
      ev('Booked', '2026-10-06T09:00', 'Karachi'),
      ev('Picked up', '2026-10-06T15:30', 'Korangi, Karachi'),
      ev('Departed origin', '2026-10-07T02:40', 'Karachi Airport (KHI)'),
      ev('Arrived destination', '2026-10-08T07:15', 'Manchester (MAN)'),
      ev('Customs hold', '2026-10-08T13:00', 'Manchester (MAN)', 'Commercial invoice needed'),
    ],
  },
  {
    number: '10257079', date: '2026-10-02', consignee: 'Emma Thompson', city: 'Glasgow', country: 'United Kingdom',
    service: 'Direct UK DPD', pieces: 1, weight: 12, contents: 'WOMENS DRESS', status: 'Delivered',
    events: [
      ev('Booked', '2026-10-02T10:10', 'Karachi'),
      ev('Picked up', '2026-10-02T17:00', 'Korangi, Karachi'),
      ev('Departed origin', '2026-10-03T03:00', 'Karachi Airport (KHI)'),
      ev('Arrived destination', '2026-10-04T08:20', 'London Heathrow (LHR)'),
      ev('Customs cleared', '2026-10-04T15:45', 'London Heathrow (LHR)'),
      ev('Out for delivery', '2026-10-06T08:30', 'Glasgow'),
      ev('Delivered', '2026-10-06T13:12', 'Glasgow', 'Received by E. Thompson'),
    ],
  },
  {
    number: '10257071', date: '2026-09-27', consignee: 'Tariq Mahmood', city: 'Birmingham', country: 'United Kingdom',
    service: 'Direct UK DPD', pieces: 4, weight: 58, contents: 'WOMENS DRESS, BED SHEETS', status: 'Delivered',
    events: [
      ev('Booked', '2026-09-27T12:00', 'Karachi'),
      ev('Departed origin', '2026-09-28T03:00', 'Karachi Airport (KHI)'),
      ev('Delivered', '2026-10-01T11:40', 'Birmingham', 'Received by T. Mahmood'),
    ],
  },
]

export const invoices = [
  { id: 'i3', number: 'INV-00042', month: '2026-10', issued: '2026-10-01', amount: 18000, paid: 10000, balance: 43000, status: 'Partial' },
  { id: 'i2', number: 'INV-00031', month: '2026-09', issued: '2026-09-01', amount: 65000, paid: 30000, balance: 35000, status: 'Partial' },
  { id: 'i1', number: 'INV-00019', month: '2026-08', issued: '2026-08-01', amount: 52500, paid: 52500, balance: 0, status: 'Paid' },
]
