import { useEffect, useState } from 'react'
import { cablePlannerApi } from '../../lib/bridge'
import { useSettingsStore } from '../../store/settingsStore'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
}

export const SettingsDialog = ({ open, onClose }: SettingsDialogProps) => {
  // Token lives only in local component state — never in global store — to
  // minimise how long the plaintext credential is reachable in memory.
  const [token, setToken] = useState('')
  const hasToken = useSettingsStore((state) => state.hasToken)
  const tokenStatus = useSettingsStore((state) => state.tokenStatus)
  const setHasToken = useSettingsStore((state) => state.setHasToken)
  const setTokenStatus = useSettingsStore((state) => state.setTokenStatus)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) {
      // Wipe the token from memory when the dialog closes.
      setToken('')
      return
    }

    cablePlannerApi.credentials.getToken().then((stored) => {
      setHasToken(Boolean(stored))
      setToken(stored ?? '')
      setTokenStatus(stored ? 'Token loaded from secure storage.' : 'No token configured')
    })
  }, [open, setHasToken, setTokenStatus])

  if (!open) {
    return null
  }

  const save = async () => {
    setBusy(true)
    try {
      await cablePlannerApi.credentials.saveToken(token)
      setHasToken(true)
      setTokenStatus('Token saved securely.')
    } catch (error) {
      setTokenStatus(error instanceof Error ? error.message : 'Could not save token')
    } finally {
      setBusy(false)
    }
  }

  const test = async () => {
    setBusy(true)
    try {
      const result = await cablePlannerApi.credentials.testToken()
      setTokenStatus(result.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await cablePlannerApi.credentials.deleteToken()
      setToken('')
      setHasToken(false)
      setTokenStatus('Token deleted.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="w-full max-w-xl rounded border border-slate-700 bg-slate-900 p-4 text-slate-100">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Settings</h3>
          <button type="button" onClick={onClose} className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600">
            Close
          </button>
        </div>

        <label className="mb-2 block text-sm">
          Rentman API Token
          <input
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
            placeholder="Paste bearer token"
            autoComplete="off"
          />
        </label>

        <div className="mb-2 text-xs text-slate-300">Status: {tokenStatus}</div>
        <div className="mb-3 text-xs text-slate-400">Stored token: {hasToken ? 'Yes' : 'No'}</div>

        <div className="flex gap-2 text-sm">
          <button type="button" disabled={busy} onClick={save} className="rounded bg-sky-600 px-3 py-1 hover:bg-sky-500">
            Save Token
          </button>
          <button type="button" disabled={busy} onClick={test} className="rounded bg-emerald-600 px-3 py-1 hover:bg-emerald-500">
            Test Token
          </button>
          <button type="button" disabled={busy} onClick={remove} className="rounded bg-red-600 px-3 py-1 hover:bg-red-500">
            Delete Token
          </button>
        </div>
      </div>
    </div>
  )
}
