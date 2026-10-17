import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AlertTriangle, HelpCircle } from 'lucide-react'

// App-styled replacements for window.confirm / window.prompt.
//   const { confirm, prompt } = useDialog()
//   if (!(await confirm({ title, message, confirmText: 'Delete', danger: true }))) return
//   const reason = await prompt({ title, label, inputType: 'number' })  // null when cancelled
const DialogContext = createContext(null)

function DialogBox({ dialog, onClose }) {
  const [value, setValue] = useState(dialog.defaultValue ?? '')
  const inputRef = useRef(null)
  const confirmRef = useRef(null)
  const isPrompt = dialog.kind === 'prompt'
  const Icon = dialog.danger ? AlertTriangle : HelpCircle

  useEffect(() => {
    ;(isPrompt ? inputRef : confirmRef).current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose(isPrompt ? null : false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isPrompt, onClose])

  function submit(e) {
    e.preventDefault()
    if (isPrompt) {
      if (dialog.required !== false && !String(value).trim()) return inputRef.current?.focus()
      onClose(String(value).trim())
    } else {
      onClose(true)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={() => onClose(isPrompt ? null : false)} />
      <form
        onSubmit={submit}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex gap-4">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
              dialog.danger ? 'bg-red-50 text-accent-500' : 'bg-brand-50 text-brand-500'
            }`}
          >
            <Icon size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="dialog-title" className="text-lg font-bold text-ink-900">
              {dialog.title}
            </h2>
            {dialog.message && <p className="mt-1 text-sm text-slate-500">{dialog.message}</p>}
            {isPrompt && (
              <label className="mt-4 block">
                {dialog.label && <span className="text-xs font-semibold text-slate-600">{dialog.label}</span>}
                <input
                  ref={inputRef}
                  type={dialog.inputType ?? 'text'}
                  min={dialog.inputType === 'number' ? '0' : undefined}
                  step={dialog.inputType === 'number' ? 'any' : undefined}
                  placeholder={dialog.placeholder}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
                />
              </label>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onClose(isPrompt ? null : false)}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            {dialog.cancelText ?? 'Cancel'}
          </button>
          <button
            ref={confirmRef}
            type="submit"
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg ${
              dialog.danger
                ? 'bg-accent-500 shadow-accent-500/25 hover:bg-accent-600'
                : 'bg-ink-950 shadow-ink-950/20 hover:bg-ink-800'
            }`}
          >
            {dialog.confirmText ?? 'OK'}
          </button>
        </div>
      </form>
    </div>
  )
}

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null)
  const resolver = useRef(null)

  const open = useCallback(
    (kind, options) =>
      new Promise((resolve) => {
        resolver.current = resolve
        setDialog({ ...options, kind, id: Date.now() })
      }),
    [],
  )

  const close = useCallback((result) => {
    resolver.current?.(result)
    resolver.current = null
    setDialog(null)
  }, [])

  const confirm = useCallback((options) => open('confirm', options), [open])
  const prompt = useCallback((options) => open('prompt', options), [open])

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}
      {dialog && <DialogBox key={dialog.id} dialog={dialog} onClose={close} />}
    </DialogContext.Provider>
  )
}

export function useDialog() {
  return useContext(DialogContext)
}
