import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, ArrowRight, Eye, EyeOff, Globe2, Lock, PackageCheck, ShieldCheck, UserRound } from 'lucide-react'
import { WEBSITE_URL } from '../config/site'
import { getSession, login } from '../lib/auth'

const highlights = [
  { icon: Globe2, value: '200+', label: 'Countries served' },
  { icon: PackageCheck, value: '1990', label: 'Delivering since' },
  { icon: ShieldCheck, value: '24/7', label: 'Shipment visibility' },
]

// Where each kind of account lands after signing in.
export const homeFor = (session) => (session?.role === 'customer' ? '/portal' : '/admin')

const TEXT = {
  staff: {
    badge: 'Staff only',
    headline: ['Every shipment, ', 'one control room.'],
    blurb: 'Bookings, air waybills, customs, billing and tracking for every APX customer, managed from a single portal.',
    kicker: 'Admin Portal',
    intro: 'Sign in with your APX staff account to continue.',
    placeholder: 'e.g. ali_staff',
    footer: 'Authorized personnel only.',
    switch: { question: 'Are you a customer?', label: 'Customer portal login', to: '/portal/login' },
  },
  portal: {
    badge: 'Customers',
    headline: ['Send, track and pay, ', 'all in one place.'],
    blurb: 'Send your daily addresses, follow every parcel, print airway bills and see your invoices, any time.',
    kicker: 'Customer Portal',
    intro: 'Sign in with the account APX created for your company.',
    placeholder: 'Your username',
    footer: 'Need an account? Contact APX International.',
    switch: { question: 'Are you APX staff?', label: 'Admin portal login', to: '/login' },
  },
}

export default function Login({ portal = false }) {
  const text = TEXT[portal ? 'portal' : 'staff']
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const session = getSession()
  if (session) return <Navigate to={homeFor(session)} replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const user = await login(username, password, remember)
      navigate(homeFor(user), { replace: true })
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-ink-950 text-white lg:flex lg:flex-col">
        <div className="grid-bg absolute inset-0" />
        <img
          src="/world-dots.svg"
          alt=""
          className="pointer-events-none absolute top-1/2 left-1/2 w-[140%] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-25"
        />
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="absolute -right-24 -bottom-32 h-96 w-96 rounded-full bg-accent-500/25 blur-3xl" />

        <div className="relative flex flex-1 flex-col justify-between p-12 xl:p-16">
          <a href={WEBSITE_URL} className="w-fit">
            <img src="/apx-logo-light.svg" alt="APX International" className="h-10" />
          </a>

          <div className="max-w-md">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold tracking-wide text-slate-200 uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />
              {text.badge}
            </span>
            <h2 className="mt-5 text-4xl leading-tight font-extrabold xl:text-5xl">
              {text.headline[0]}
              <span className="text-gradient">{text.headline[1]}</span>
            </h2>
            <p className="mt-4 text-slate-300">
              {text.blurb}
            </p>
          </div>

          <ul className="grid grid-cols-3 gap-4">
            {highlights.map(({ icon: Icon, value, label }) => (
              <li key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <Icon size={20} className="text-accent-400" />
                <p className="mt-3 text-2xl font-bold">{value}</p>
                <p className="text-xs text-slate-400">{label}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Form panel */}
      <section className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <a href={WEBSITE_URL} className="block w-fit lg:hidden">
            <img src="/apx-logo.svg" alt="APX International" className="h-10" />
          </a>

          <a
            href={WEBSITE_URL}
            className="group mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand-500 lg:mt-0"
          >
            <ArrowLeft size={14} className="transition group-hover:-translate-x-0.5" />
            Back to website
          </a>

          <p className="mt-6 text-sm font-semibold text-accent-500">{text.kicker}</p>
          <h1 className="mt-1 text-3xl font-extrabold text-ink-900">Welcome back</h1>
          <p className="mt-2 text-sm text-slate-500">{text.intro}</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && (
              <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent-600">
                <AlertCircle size={18} />
                {error}
              </p>
            )}

            <label className="block">
              <span className="text-sm font-semibold text-ink-900">Username</span>
              <div className="relative mt-1.5">
                <UserRound size={18} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder={text.placeholder}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pr-4 pl-11 text-sm text-ink-900 transition placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100 focus:outline-none"
                />
              </div>
            </label>

            <label className="block">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-ink-900">Password</span>
                <a href="#" className="text-xs font-semibold text-brand-500 hover:text-accent-500">
                  Forgot password?
                </a>
              </div>
              <div className="relative mt-1.5">
                <Lock size={18} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pr-11 pl-11 text-sm text-ink-900 transition placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-ink-900"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-accent-500"
              />
              Keep me signed in
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-accent-500 py-3 font-semibold text-white shadow-lg shadow-accent-500/25 transition hover:bg-accent-600 disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight size={18} className="transition group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          {/* The other sign-in page, for people who landed on the wrong one. */}
          <Link
            to={text.switch.to}
            className="group mt-6 flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm transition hover:border-brand-500 hover:bg-brand-50"
          >
            <span className="text-slate-600">
              {text.switch.question} <span className="font-semibold text-brand-500 group-hover:text-accent-500">{text.switch.label}</span>
            </span>
            <ArrowRight size={16} className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-accent-500" />
          </Link>

          <p className="mt-10 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} APX International. {text.footer}
          </p>
        </div>
      </section>
    </div>
  )
}
