import { AlertTriangle, Loader2, RotateCw } from 'lucide-react'

// Shown while a page's data is loading, or when loading failed.
export default function LoadState({ error, onRetry }) {
  if (error) {
    return (
      <div role="alert" className="flex flex-col items-center rounded-2xl border border-red-200 bg-white px-6 py-12 text-center">
        <AlertTriangle size={32} className="text-accent-500" />
        <p className="mt-3 font-semibold text-ink-900">Could not load this page</p>
        <p className="mt-1 max-w-md text-sm text-slate-500">{error.message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100"
          >
            <RotateCw size={16} /> Try again
          </button>
        )}
      </div>
    )
  }
  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-16 text-sm text-slate-500">
      <Loader2 size={18} className="animate-spin" /> Loading…
    </div>
  )
}
