import { Construction } from 'lucide-react'

export default function ComingSoon({ module }) {
  const Icon = module.icon
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="rounded-xl bg-brand-50 p-2.5 text-brand-500">
          <Icon size={22} />
        </span>
        <h1 className="text-3xl font-extrabold text-ink-900">{module.label}</h1>
      </div>

      <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
        <Construction size={36} className="text-slate-300" />
        <p className="mt-4 font-semibold text-ink-900">Coming soon</p>
        <p className="mt-1 max-w-sm text-sm text-slate-500">This module hasn&apos;t been built yet.</p>
      </div>
    </div>
  )
}
