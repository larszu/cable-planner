import { useEffect, useState } from 'react'
import { cablePlannerApi } from '../../lib/bridge'
import { useSettingsStore } from '../../store/settingsStore'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
}

type SettingsSection = 'project' | 'rentman' | 'general'

export const SettingsDialog = ({ open, onClose }: SettingsDialogProps) => {
  const [section, setSection] = useState<SettingsSection>('project')

  // Token lives only in local component state — never in global store — to
  // minimise how long the plaintext credential is reachable in memory.
  const [token, setToken] = useState('')
  const hasToken = useSettingsStore((state) => state.hasToken)
  const tokenStatus = useSettingsStore((state) => state.tokenStatus)
  const setHasToken = useSettingsStore((state) => state.setHasToken)
  const setTokenStatus = useSettingsStore((state) => state.setTokenStatus)
  const autosaveIntervalMs = useSettingsStore((state) => state.autosaveIntervalMs)
  const setAutosaveIntervalMs = useSettingsStore((state) => state.setAutosaveIntervalMs)
  const [busy, setBusy] = useState(false)

  // Project metadata (kept in sync with store via local mirror so we can
  // batch-edit without dispatching on every keystroke).
  const metadata = useProjectStore((state) => state.project.metadata)
  const updateProjectMetadata = useProjectStore((state) => state.updateProjectMetadata)
  const openRentmanImport = useUiStore((state) => state.openRentmanImport)
  const [draftMeta, setDraftMeta] = useState(metadata)
  useEffect(() => {
    if (open) setDraftMeta(metadata)
  }, [open, metadata])

  useEffect(() => {
    if (!open) {
      setToken('')
      return
    }
    cablePlannerApi.credentials.getToken().then((stored) => {
      setHasToken(Boolean(stored))
      setToken(stored ?? '')
      setTokenStatus(stored ? 'Token loaded from secure storage.' : 'No token configured')
    })
  }, [open, setHasToken, setTokenStatus])

  if (!open) return null

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

  const persistMeta = () => {
    updateProjectMetadata({
      name: draftMeta.name,
      description: draftMeta.description,
      author: draftMeta.author,
      client: draftMeta.client,
      contractor: draftMeta.contractor,
      projectNumber: draftMeta.projectNumber,
      companyLogo: draftMeta.companyLogo,
      clientLogo: draftMeta.clientLogo,
    })
  }

  /**
   * Read a user-picked image as a data URI so it can travel with the project
   * file (no separate filesystem path to keep in sync). Resolves with `''`
   * if the user cancels — caller treats empty string as "remove logo".
   */
  const readImageAsDataUri = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
      reader.onerror = () => reject(new Error('Konnte Bild nicht lesen'))
      reader.readAsDataURL(file)
    })

  const pickLogo = async (which: 'companyLogo' | 'clientLogo') => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,image/jpeg,image/svg+xml,image/webp'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const dataUri = await readImageAsDataUri(file)
        setDraftMeta((prev) => ({ ...prev, [which]: dataUri }))
      } catch {
        // ignore — file picker already closed
      }
    }
    input.click()
  }

  const navItem = (id: SettingsSection, label: string, icon: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setSection(id)}
      className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm ${
        section === id
          ? 'bg-sky-700 text-white'
          : 'text-slate-300 hover:bg-slate-800'
      }`}
    >
      <span className="text-base">{icon}</span>
      <span>{label}</span>
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="flex w-full max-w-3xl overflow-hidden rounded border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl">
        {/* Sidebar */}
        <aside className="flex w-48 shrink-0 flex-col gap-1 border-r border-slate-800 bg-slate-950/40 p-3">
          <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Einstellungen
          </h3>
          {navItem('project', 'Projekt', '📋')}
          {navItem('rentman', 'Rentman API', '🔌')}
          {navItem('general', 'Allgemein', '⚙')}
        </aside>

        {/* Body */}
        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
            <h2 className="text-base font-semibold">
              {section === 'project' && 'Projekt-Einstellungen'}
              {section === 'rentman' && 'Rentman API'}
              {section === 'general' && 'Allgemein'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
            >
              Schließen
            </button>
          </header>

          <div className="flex-1 overflow-auto p-4">
            {section === 'project' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">
                  Projekt-Metadaten — werden mit der Cable-Planner-Datei gespeichert.
                </p>
                <label className="block text-sm">
                  Projektname
                  <input
                    type="text"
                    value={draftMeta.name}
                    onChange={(e) => setDraftMeta({ ...draftMeta, name: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
                    placeholder="Projektname"
                  />
                </label>
                <label className="block text-sm">
                  Beschreibung
                  <textarea
                    value={draftMeta.description ?? ''}
                    onChange={(e) => setDraftMeta({ ...draftMeta, description: e.target.value })}
                    rows={3}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
                    placeholder="Optionale Projektbeschreibung"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-sm">
                    Auftraggeber (Client)
                    <input
                      type="text"
                      value={draftMeta.client ?? ''}
                      onChange={(e) => setDraftMeta({ ...draftMeta, client: e.target.value })}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
                      placeholder="Endkunde"
                    />
                  </label>
                  <label className="block text-sm">
                    Auftragnehmer (Contractor)
                    <input
                      type="text"
                      value={draftMeta.contractor ?? ''}
                      onChange={(e) => setDraftMeta({ ...draftMeta, contractor: e.target.value })}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
                      placeholder="Ausführende Firma"
                    />
                  </label>
                </div>
                <label className="block text-sm">
                  Autor
                  <input
                    type="text"
                    value={draftMeta.author ?? ''}
                    onChange={(e) => setDraftMeta({ ...draftMeta, author: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
                    placeholder="Dein Name"
                  />
                </label>

                <label className="block text-sm">
                  Projekt-Nr.
                  <input
                    type="text"
                    value={draftMeta.projectNumber ?? ''}
                    onChange={(e) => setDraftMeta({ ...draftMeta, projectNumber: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
                    placeholder="z. B. 2026-042"
                  />
                </label>

                <div className="rounded border border-slate-800 bg-slate-950/40 p-3">
                  <div className="mb-2 text-xs font-semibold text-slate-300">
                    Bauplan-Signatur (Logos)
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {(['companyLogo', 'clientLogo'] as const).map((field) => {
                      const label = field === 'companyLogo' ? 'Auftragnehmer' : 'Kunde'
                      const current = draftMeta[field]
                      return (
                        <div key={field} className="flex flex-col items-center gap-2">
                          <div className="flex h-16 w-full items-center justify-center overflow-hidden rounded border border-slate-700 bg-white/5">
                            {current ? (
                              <img src={current} alt={label} className="max-h-16 max-w-full object-contain" />
                            ) : (
                              <span className="text-[10px] text-slate-500">{label}</span>
                            )}
                          </div>
                          <div className="flex w-full gap-1">
                            <button
                              type="button"
                              onClick={() => pickLogo(field)}
                              className="flex-1 rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
                            >
                              Wählen…
                            </button>
                            {current && (
                              <button
                                type="button"
                                onClick={() =>
                                  setDraftMeta((prev) => ({ ...prev, [field]: undefined }))
                                }
                                title="Logo entfernen"
                                className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-400 hover:bg-red-700 hover:text-white"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <p className="mt-2 text-[10px] text-slate-500">
                    Logos werden als Daten-URI in der Projektdatei gespeichert (PDF-Export &amp;
                    Canvas-Signatur).
                  </p>
                </div>

                <div className="rounded border border-slate-800 bg-slate-950/40 p-3 text-xs">
                  <div className="mb-1 font-semibold text-slate-300">Verknüpftes Rentman-Projekt</div>
                  {metadata.rentmanProjectId ? (
                    <div className="text-slate-400">
                      <span className="text-orange-300">{metadata.rentmanProjectName ?? `Projekt #${metadata.rentmanProjectId}`}</span>
                      <span className="ml-2 text-slate-500">(ID: {metadata.rentmanProjectId})</span>
                    </div>
                  ) : (
                    <div className="text-slate-500">
                      Kein Rentman-Projekt verknüpft. Verknüpfung im Tab „Rentman API“ herstellen.
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setDraftMeta(metadata)}
                    className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600"
                  >
                    Zurücksetzen
                  </button>
                  <button
                    type="button"
                    onClick={persistMeta}
                    className="rounded bg-emerald-600 px-3 py-1 text-sm hover:bg-emerald-500"
                  >
                    Speichern
                  </button>
                </div>
              </div>
            )}

            {section === 'rentman' && (
              <div className="space-y-3">
                <label className="block text-sm">
                  Rentman API Token
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 font-mono text-xs"
                    placeholder="Bearer-Token einfügen"
                    autoComplete="off"
                  />
                </label>

                <div
                  className={`rounded border p-2 text-xs ${
                    hasToken
                      ? 'border-emerald-700/50 bg-emerald-900/20 text-emerald-300'
                      : 'border-slate-700 bg-slate-950/40 text-slate-400'
                  }`}
                >
                  <div>
                    <span className="font-semibold">Status:</span> {tokenStatus}
                  </div>
                  <div className="text-slate-500">Token gespeichert: {hasToken ? 'Ja' : 'Nein'}</div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || !token}
                    onClick={save}
                    className="rounded bg-sky-600 px-3 py-1 text-sm hover:bg-sky-500 disabled:opacity-50"
                  >
                    Token speichern
                  </button>
                  <button
                    type="button"
                    disabled={busy || !hasToken}
                    onClick={test}
                    className="rounded bg-emerald-600 px-3 py-1 text-sm hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Verbindung testen
                  </button>
                  <button
                    type="button"
                    disabled={busy || !hasToken}
                    onClick={remove}
                    className="rounded bg-red-600 px-3 py-1 text-sm hover:bg-red-500 disabled:opacity-50"
                  >
                    Token löschen
                  </button>
                </div>

                <div className="rounded border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-400">
                  <div className="mb-1 font-semibold text-slate-300">API-Endpunkt</div>
                  <code className="text-slate-300">https://api.rentman.net</code>
                </div>

                <div className="rounded border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-300">
                  <div className="mb-2 font-semibold text-slate-200">Projekt-Verknüpfung</div>
                  {metadata.rentmanProjectId ? (
                    <div className="space-y-2">
                      <div className="text-slate-400">
                        Aktuell verknüpft mit{' '}
                        <span className="text-orange-300">
                          {metadata.rentmanProjectName ?? `Projekt #${metadata.rentmanProjectId}`}
                        </span>
                        <span className="ml-2 text-slate-500">(ID {metadata.rentmanProjectId})</span>
                      </div>
                      <button
                        type="button"
                        disabled={!hasToken}
                        onClick={() => {
                          openRentmanImport()
                          onClose()
                        }}
                        className="rounded bg-orange-700 px-3 py-1 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                      >
                        Anderes Rentman-Projekt wählen…
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-slate-500">
                        Noch kein Rentman-Projekt mit diesem Cable-Planner-Projekt verknüpft.
                      </div>
                      <button
                        type="button"
                        disabled={!hasToken}
                        onClick={() => {
                          openRentmanImport()
                          onClose()
                        }}
                        className="rounded bg-orange-700 px-3 py-1 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                        title={hasToken ? 'Rentman-Projekt auswählen' : 'Erst Token speichern'}
                      >
                        Mit Rentman-Projekt verknüpfen…
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {section === 'general' && (
              <div className="space-y-3 text-sm text-slate-300">
                <div className="rounded border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-400">
                  <div className="mb-2 font-semibold text-slate-300">Autosave</div>
                  <label className="block text-sm text-slate-300">
                    Autosave-Intervall (ms)
                    <input
                      type="number"
                      min={100}
                      max={30000}
                      step={100}
                      value={autosaveIntervalMs}
                      onChange={(event) => setAutosaveIntervalMs(Number(event.target.value) || 400)}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
                    />
                  </label>
                  <div className="mt-2 text-[11px] text-slate-500">
                    100 ms bis 30.000 ms. Standard ist 400 ms.
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
