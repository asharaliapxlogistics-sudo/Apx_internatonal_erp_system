import { Navigate, Route, Routes } from 'react-router-dom'
import { allModules } from './config/adminModules'
import AdminLayout from './layouts/AdminLayout'
import { getSession } from './lib/auth'
import Login from './pages/Login'
import AwbForm from './pages/admin/awb/AwbForm'
import AwbList from './pages/admin/awb/AwbList'
import AwbView from './pages/admin/awb/AwbView'
import InvoiceForm from './pages/admin/billing/InvoiceForm'
import InvoiceList from './pages/admin/billing/InvoiceList'
import InvoiceView from './pages/admin/billing/InvoiceView'
import ComingSoon from './pages/admin/ComingSoon'
import CustomerForm from './pages/admin/customers/CustomerForm'
import CustomerAddresses from './pages/admin/addresses/CustomerAddresses'
import ComplaintList from './pages/admin/complaints/ComplaintList'
import ComplaintView from './pages/admin/complaints/ComplaintView'
import CustomerList from './pages/admin/customers/CustomerList'
import ExpenseReceipt from './pages/admin/expenses/ExpenseReceipt'
import Expenses from './pages/admin/expenses/Expenses'
import Employees from './pages/admin/employees/Employees'
import Reports from './pages/admin/reports/Reports'
import Settings from './pages/admin/settings/Settings'
import ShipmentList from './pages/admin/shipments/ShipmentList'
import ShipmentView from './pages/admin/shipments/ShipmentView'
import Dashboard from './pages/admin/Dashboard'
import PublicTrack from './pages/PublicTrack'
import PortalLayout from './portal/PortalLayout'
import Account from './portal/pages/Account'
import PortalInvoices from './portal/pages/Invoices'
import PortalInvoiceView from './portal/pages/InvoiceView'
import Overview from './portal/pages/Overview'
import { ShipmentDetail, ShipmentList as PortalShipments } from './portal/pages/Shipments'
import TodayAddresses from './portal/pages/TodayAddresses'
import { ComplaintDetail as PortalComplaintDetail, ComplaintList as PortalComplaints } from './portal/pages/Complaints'
import Track from './portal/pages/Track'

// Admin screens: APX staff only. Customers are sent to their portal.
function RequireAuth({ children }) {
  const session = getSession()
  if (!session) return <Navigate to="/login" replace />
  return session.role === 'customer' ? <Navigate to="/portal" replace /> : children
}

// Customer portal: customers, plus staff previewing it.
function RequirePortal({ children }) {
  return getSession() ? children : <Navigate to="/portal/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/portal/login" element={<Login portal />} />
      <Route path="/track" element={<PublicTrack />} />
      {/* QR codes on AWBs printed before the fix point here. */}
      <Route path="/tracking" element={<PublicTrack />} />
      <Route
        path="/portal"
        element={
          <RequirePortal>
            <PortalLayout />
          </RequirePortal>
        }
      >
        <Route index element={<Overview />} />
        <Route path="shipments" element={<PortalShipments />} />
        <Route path="shipments/:number" element={<ShipmentDetail />} />
        <Route path="track" element={<Track />} />
        <Route path="today" element={<TodayAddresses />} />
        <Route path="complaints" element={<PortalComplaints />} />
        <Route path="complaints/:id" element={<PortalComplaintDetail />} />
        <Route path="invoices" element={<PortalInvoices />} />
        <Route path="invoices/:id" element={<PortalInvoiceView />} />
        <Route path="account" element={<Account />} />
      </Route>
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="awb" element={<AwbList />} />
        <Route path="awb/new" element={<AwbForm />} />
        <Route path="awb/:number" element={<AwbView />} />
        <Route path="billing" element={<InvoiceList />} />
        <Route path="billing/new" element={<InvoiceForm />} />
        <Route path="billing/:id" element={<InvoiceView />} />
        <Route path="customers" element={<CustomerList />} />
        <Route path="customer-addresses" element={<CustomerAddresses />} />
        <Route path="complaints" element={<ComplaintList />} />
        <Route path="complaints/:id" element={<ComplaintView />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="employees" element={<Employees />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
        <Route path="shipments" element={<ShipmentList />} />
        <Route path="shipments/:number" element={<ShipmentView />} />
        <Route path="expenses/:id/receipt" element={<ExpenseReceipt />} />
        <Route path="customers/new" element={<CustomerForm />} />
        <Route path="customers/:id" element={<CustomerForm key="edit" />} />
        {allModules
          .filter((m) => !m.ready)
          .map((m) => (
            <Route key={m.path} path={m.path.replace('/admin/', '')} element={<ComingSoon module={m} />} />
          ))}
      </Route>
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}
