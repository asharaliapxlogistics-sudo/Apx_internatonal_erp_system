import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import ChangePasswordDialog from '../../components/ChangePasswordDialog'
import { usePortalAccount } from '../PortalAccount'
import { Card, PageHeader, PreviewNote, btnSecondary } from '../ui'

const when = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never')

export default function Account() {
  const { company, team, user, preview } = usePortalAccount()
  const [changingPassword, setChangingPassword] = useState(false)
  const address = [company.address, company.city, company.zip, company.country].filter(Boolean).join(', ')

  return (
    <div className="space-y-6">
      {preview && <PreviewNote>Preview with a sample company. Customers see their own profile and team here.</PreviewNote>}
      <PageHeader
        title="Account & users"
        subtitle="Your company profile and the people who can sign in."
        actions={
          <button type="button" className={btnSecondary} onClick={() => setChangingPassword(true)}>
            <KeyRound size={16} /> Change my password
          </button>
        }
      />

      <Card title="Company profile" subtitle="To change these details, contact APX so your invoices stay correct.">
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Company', company.name],
            ['Account number', company.accountNo],
            ['Contact person', company.contactPerson],
            ['Phone', company.phone],
            ['Email', company.email],
            ['NTN', company.ntn],
            ['Address', address],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs font-semibold text-slate-500 uppercase">{k}</dt>
              <dd className="mt-0.5 font-medium text-ink-900">{v || '—'}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card title="Users" subtitle="Everyone here sees this company's shipments and invoices only. To add or remove someone, contact APX.">
        <ul className="-mx-5 divide-y divide-slate-100">
          {team.map((u) => (
            <li key={u.id} className={`flex items-center gap-3 px-5 py-3 ${u.isActive ? '' : 'opacity-60'}`}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand-600">{u.name.slice(0, 2).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink-900">
                  {u.name}
                  {u.id === user.id && <span className="ml-2 rounded-md bg-brand-50 px-1.5 py-0.5 text-xs font-semibold text-brand-600">You</span>}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {u.email} · last sign-in {when(u.lastLogin)}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                {u.isActive ? 'Active' : 'Disabled'}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {changingPassword && <ChangePasswordDialog onClose={() => setChangingPassword(false)} />}
    </div>
  )
}
