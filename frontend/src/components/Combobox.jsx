import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

// Text input with a styled suggestion list (replaces <datalist>, whose native arrow can't be styled).
// The user can pick a suggestion or type any other value.
// `describe(option)` adds a grey second line, `emptyText` shows when there is nothing to suggest,
// and `fixed` lets the list escape a scrolling parent (e.g. a wide table).
export default function Combobox({ value, onChange, options, className = '', required, placeholder, describe, emptyText, fixed, ...props }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const [active, setActive] = useState(-1)
  const [typed, setTyped] = useState(false)
  const wrapRef = useRef(null)
  const listRef = useRef(null)
  const listId = useId()

  const q = value.trim().toLowerCase()
  const shown = typed && q ? options.filter((o) => o.toLowerCase().includes(q)) : options

  useEffect(() => {
    if (!open) return
    const close = (e) => wrapRef.current && !wrapRef.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  // A fixed list does not move with the page, so it closes on scroll instead.
  useEffect(() => {
    if (!open || !fixed) return
    const close = (e) => !listRef.current?.contains(e.target) && setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open, fixed])

  useEffect(() => {
    if (active >= 0) listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function show() {
    if (fixed) {
      const r = wrapRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 260) })
    }
    setOpen(true)
    setTyped(false)
    setActive(options.indexOf(value))
  }

  function pick(option) {
    onChange(option)
    setOpen(false)
    setTyped(false)
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) return show()
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((i) => (shown.length ? (i + step + shown.length) % shown.length : -1))
    } else if (e.key === 'Enter' && open && active >= 0 && shown[active]) {
      e.preventDefault()
      pick(shown[active])
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        {...props}
        value={value}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        onFocus={show}
        onClick={() => !open && show()}
        onChange={(e) => {
          onChange(e.target.value)
          setTyped(true)
          setOpen(true)
          setActive(-1)
        }}
        onKeyDown={onKeyDown}
        className={`${className} pr-9`}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Show options"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => (open ? setOpen(false) : (wrapRef.current.querySelector('input').focus(), show()))}
        className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-ink-900"
      >
        <ChevronDown size={16} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && !shown.length && emptyText && !q && (
        <p
          style={fixed ? pos : undefined}
          className={`${fixed ? 'fixed' : 'absolute mt-1 w-full'} z-30 min-w-48 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-xl`}
        >
          {emptyText}
        </p>
      )}
      {open && shown.length > 0 && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          style={fixed ? pos : undefined}
          className={`${fixed ? 'fixed' : 'absolute mt-1 w-full'} z-30 max-h-60 min-w-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl`}
        >
          {shown.map((o, i) => (
            <li
              key={o}
              role="option"
              aria-selected={o === value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.preventDefault()
                pick(o)
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm ${
                i === active ? 'bg-brand-50 text-brand-600' : 'text-ink-900'
              }`}
            >
              <span>
                {o}
                {describe && <span className="block text-xs text-slate-500">{describe(o)}</span>}
              </span>
              {o === value && <Check size={14} className="text-brand-500" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
