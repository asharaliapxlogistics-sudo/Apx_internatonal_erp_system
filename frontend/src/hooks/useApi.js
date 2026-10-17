import { useCallback, useEffect, useRef, useState } from 'react'

// Loads data from the API when the component mounts and whenever `deps` change.
//   const { data, error, loading, reload, setData } = useApi(() => listCustomers(), [])
// Responses that arrive after a newer request started are ignored.
export function useApi(fetcher, deps) {
  const [state, setState] = useState({ data: undefined, error: null, loading: true })
  const latest = useRef(0)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const reload = useCallback(() => {
    const call = ++latest.current
    setState((s) => ({ ...s, error: null, loading: true }))
    return fetcherRef.current().then(
      (data) => call === latest.current && setState({ data, error: null, loading: false }),
      (error) => call === latest.current && setState((s) => ({ ...s, error, loading: false })),
    )
  }, [])

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  // Accepts a value or an updater, like useState.
  const setData = useCallback((data) => setState((s) => ({ ...s, data: typeof data === 'function' ? data(s.data) : data })), [])
  return { ...state, reload, setData }
}
