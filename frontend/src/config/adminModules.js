import {
  BarChart3,
  Building2,
  FileText,
  LayoutDashboard,
  MapPinned,
  MessageSquareWarning,
  Receipt,
  ScrollText,
  Settings,
  UserCog,
  Wallet,
} from 'lucide-react'

// Admin Portal modules from the APX System Features spec (Part A), grouped for the sidebar.
// `ready: false` modules show a "Coming soon" page until they are built.
// `adminOnly` modules are hidden from staff.
export const moduleGroups = [
  {
    label: 'Overview',
    modules: [{ path: '/admin', label: 'Dashboard', icon: LayoutDashboard, ready: true }],
  },
  {
    label: 'Operations',
    modules: [
      { path: '/admin/awb', label: 'Air Waybills', icon: FileText, ready: true },
      { path: '/admin/billing', label: 'Billing & Invoices', icon: Receipt, ready: true },
      { path: '/admin/customers', label: 'Customers', icon: Building2, ready: true },
      { path: '/admin/customer-addresses', label: 'Customer Addresses', icon: MapPinned, ready: true },
      { path: '/admin/expenses', label: 'Office Expenses', icon: Wallet, ready: true },
      { path: '/admin/shipments', label: 'Shipments & Tracking', icon: ScrollText, ready: true },
    ],
  },
  {
    label: 'Administration',
    modules: [
      { path: '/admin/complaints', label: 'Complaints', icon: MessageSquareWarning, ready: true },
      { path: '/admin/employees', label: 'Employees & Roles', icon: UserCog, ready: true, adminOnly: true },
      { path: '/admin/reports', label: 'Reports', icon: BarChart3, ready: true, adminOnly: true },
      { path: '/admin/settings', label: 'Settings & Audit Log', icon: Settings, ready: true, adminOnly: true },
    ],
  },
]

export const allModules = moduleGroups.flatMap((g) => g.modules)
