import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import LoadState from '../components/LoadState'
import { useApi } from '../hooks/useApi'
import { TrackResult } from '../portal/pages/Track'
import { trackPublic } from '../portal/data'
import { btnPrimary, inputCls } from '../portal/ui'

// Public tracking page: opened from the AWB QR code or a link the customer shares. No sign-in.
// It shows status and history only, never prices or addresses.
export default function PublicTrack() {
  const [params, setParams] = useSearchParams()
  const number = (params.get('no') ?? '').trim()
  const [text, setText] = useState(number)
  const { data: shipment, error, loading, reload } = useApi(() => (number ? trackPublic(number) : Promise.resolve(null)), [number])

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <img src="/apx-logo.svg" alt="APX International" className="h-8" />
          <Link to="/portal/login" className="text-sm font-semibold text-brand-500 hover:text-accent-500">
            Customer sign in
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-900 sm:text-3xl">Track your shipment</h1>
          <p className="mt-1 text-sm text-slate-500">Enter the AWB number printed on your airway bill.</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setParams(text.trim() ? { no: text.trim() } : {})
          }}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. 10257088" className={`${inputCls} py-3`} aria-label="AWB number" />
          <button type="submit" className={`${btnPrimary} py-3`}>
            <MapPin size={16} /> Track
          </button>
        </form>
        {number && (loading || error ? <LoadState error={error} onRetry={reload} /> : <TrackResult number={number} shipment={shipment} />)}
      </main>
    </div>
  )
}
