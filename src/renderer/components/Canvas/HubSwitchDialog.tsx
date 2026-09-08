import { useMemo, useState } from 'react'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { useDialogA11y } from '../../hooks/useDialogA11y'
import { PanelHint } from '../shared/PanelHint'
import { usePatternStore } from '../../store/patternStore'
import { usePatternRouting } from '../../hooks/usePattern'
import { cablePlannerApi } from '../../lib/bridge'
import {
  auftragHindernis,
  eintraegeFuerAuftrag,
  hubAuftraege,
  schaltbareWege,
  sendebereit,
  type HubAuftrag,
} from '../../lib/hubSwitchPlan'
import { useTranslation } from '../../lib/i18n'

/**
 * „Diesen Weg schalten" — der Eingriff an der Kreuzschiene (B-42, Ink. 3).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WARUM DAS HIER EIN DIALOG IST UND KEIN KNOPF AM KNOTEN
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Die Rückmeldung vom Rundgang sitzt bewusst direkt am Knoten: sie ist
 * harmlos und soll keine Reibung haben. Hier ist es umgekehrt. Ein Klick
 * schickt einen Befehl an eine laufende Anlage; ein kleiner Knopf neben
 * anderen kleinen Knöpfen wird irgendwann versehentlich getroffen, und was
 * dann passiert, sieht man erst auf dem Monitor im Nebenraum.
 *
 * Deshalb: eigener Dialog, die Folgen im Klartext, der tatsächlich gesendete
 * Text sichtbar, und ein Haken, den man setzen muss. Der Haken ist keine
 * Zierde — er ist die Stelle, an der jemand merkt, dass „Ausgang 3" der
 * Sendeausgang ist.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WAS GESCHALTET WIRD — UND WAS AUSDRÜCKLICH NICHT
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Gesendet werden GENAU die Kreuzpunkte, über die der gewählte Weg läuft.
 * Nicht das ganze geplante Routing des Geräts: das setzte auch jeden
 * Ausgang, über den in diesem Moment niemand nachgedacht hat.
 * `buildCrosspointCommand` hat deshalb kein `totalOutputs` und keinen
 * Default; ein nicht genannter Ausgang kommt im Block nicht vor und bleibt
 * an der Kreuzschiene unangetastet.
 *
 * DER PLAN WIRD NICHT ANGEFASST. Auch nicht „zur Sicherheit gleichziehen".
 * Der Plan ist die Absicht, die Kreuzschiene ein Zustand; zöge das Senden
 * den Plan mit, gäbe es hinterher keine Abweichung mehr zu sehen — und
 * genau die zu sehen ist der Grund, warum der Plan neben der Anlage steht
 * (ADR-001).
 *
 * WAS BLEIBT, ist ein Eintrag je Kreuzpunkt in `project.hubSwitches`: wer
 * wann was geschaltet hat, auch wenn es scheiterte. Nach einer Sendung, in
 * der etwas Falsches im Bild war, ist das die einzige Spur.
 */
export function HubSwitchDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslation()
  const routing = usePatternRouting()
  const quelleId = usePatternStore((s) => s.quelleId)
  const recordHubSwitch = useProjectStore((s) => s.recordHubSwitch)
  const { panelRef, titleId, dialogProps } = useDialogA11y(true, onClose)

  const [zielId, setZielId] = useState<string>('')
  const [verstanden, setVerstanden] = useState(false)
  const [wer, setWer] = useState('')
  const [port, setPort] = useState('9990')
  const [laeuft, setLaeuft] = useState(false)
  const [meldungen, setMeldungen] = useState<{ ok: boolean; text: string }[]>([])

  // Nur Wege, auf denen es überhaupt etwas zu schalten gibt. Ein Weg ohne
  // Kreuzschiene ist fest verkabelt — dort ist „schalten" keine Möglichkeit,
  // und ihn trotzdem anzubieten hiesse, eine Wirkung zu versprechen.
  const wege = useMemo(() => schaltbareWege(routing.ziele), [routing.ziele])
  const gewaehlt = wege.find((z) => z.id === zielId)
  const auftraege: HubAuftrag[] = useMemo(
    () => (gewaehlt ? hubAuftraege(gewaehlt.kreuzpunkte) : []),
    [gewaehlt],
  )
  const hindernisse = auftraege.map(auftragHindernis).filter((h): h is string => h !== null)

  const schalten = async () => {
    if (!sendebereit(auftraege, verstanden)) return
    const portNum = parseInt(port, 10)
    if (!Number.isInteger(portNum) || portNum <= 0) {
      setMeldungen([{ ok: false, text: t('canvas.hubSwitch.badPort', 'Ungültiger Port.') }])
      return
    }
    setLaeuft(true)
    setMeldungen([])
    const gesammelt: { ok: boolean; text: string }[] = []
    for (const auftrag of auftraege) {
      let ok = false
      let message: string
      try {
        const antwort = await cablePlannerApi.videohub.sendRouting({
          host: auftrag.ipAddress,
          port: portNum,
          block: auftrag.block,
        })
        ok = antwort.ok
        message = antwort.message
      } catch (e) {
        message = e instanceof Error ? e.message : String(e)
      }
      // Der Zeitpunkt kommt HIER, einmal je Auftrag — der Store nimmt keine
      // Uhr. WELCHE Eintraege daraus werden, entscheidet
      // `eintraegeFuerAuftrag`; dort ist am Verhalten geprueft, dass auch der
      // gescheiterte Versuch einen bekommt.
      const at = new Date().toISOString()
      for (const eintrag of eintraegeFuerAuftrag(
        auftrag,
        { ok, message },
        { at, ...(quelleId ? { quelleId } : {}), ...(wer ? { by: wer } : {}) },
      )) {
        recordHubSwitch(eintrag)
      }
      gesammelt.push({ ok, text: `${auftrag.equipmentName}: ${message || (ok ? 'OK' : 'Fehler')}` })
    }
    setMeldungen(gesammelt)
    setLaeuft(false)
  }

  const bereit = sendebereit(auftraege, verstanden)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div
        ref={panelRef}
        aria-labelledby={titleId}
        {...dialogProps}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded border border-cp-border bg-cp-surface-1 p-4 text-cp-text"
      >
        <h3 id={titleId} className="mb-2 text-cp-lg font-semibold">
          {t('canvas.hubSwitch.title', 'Weg schalten')}
        </h3>

        {/* Der erste Satz steht, der Rest klappt auf — dieselbe Regel wie
            ueberall: die Begruendung gehoert dorthin, wo jemand sie sucht.
            Der WARNENDE Satz ist hier der erste und bleibt deshalb sichtbar. */}
        <PanelHint
          className="mb-3 rounded border border-cp-danger/50 bg-cp-danger/10 p-2 text-[12px] text-cp-text-secondary"
          text={t(
            'canvas.hubSwitch.warning',
            'Das ist ein Eingriff in die laufende Anlage, keine Anzeige. Gesendet werden nur die unten aufgeführten Kreuzpunkte; alle anderen Ausgänge bleiben unberührt. Der Plan ändert sich dadurch nicht.',
          )}
        />

        {wege.length === 0 ? (
          <p className="text-[12px] text-cp-text-muted">
            {t(
              'canvas.hubSwitch.nothing',
              'Auf keinem Weg dieser Quelle liegt eine Kreuzschiene — es gibt nichts zu schalten.',
            )}
          </p>
        ) : (
          <div className="flex-1 overflow-auto">
            <label className="block text-[12px]">
              {t('canvas.hubSwitch.pick', 'Wohin soll das Bild?')}
              <select
                value={zielId}
                onChange={(e) => {
                  setZielId(e.target.value)
                  setVerstanden(false)
                  setMeldungen([])
                }}
                className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2"
              >
                <option value="">{t('canvas.hubSwitch.pickNone', 'bitte wählen')}</option>
                {wege.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.equipmentName} · {z.portName}
                  </option>
                ))}
              </select>
            </label>

            {gewaehlt && (
              <div className="mt-3 space-y-3">
                <div className="text-[11px] text-cp-text-muted">{gewaehlt.weg}</div>
                {auftraege.map((a) => (
                  <div key={a.equipmentId} className="rounded border border-cp-border p-2">
                    <div className="text-[12px] font-semibold">{a.equipmentName}</div>
                    <ul className="mt-1 list-disc pl-5 text-[12px]">
                      {a.klartext.map((zeile, i) => (
                        <li key={i}>{zeile}</li>
                      ))}
                    </ul>
                    {/* Der tatsaechlich gesendete Text, wortwoertlich. Wer
                        einen Befehl an eine laufende Anlage bestaetigt, soll
                        ihn lesen koennen und nicht nur seine Beschreibung. */}
                    <pre className="mt-2 overflow-x-auto rounded bg-cp-surface-3 p-2 text-[11px] leading-tight">
                      {a.block}
                    </pre>
                    <div className="mt-1 text-[11px] text-cp-text-muted">
                      {a.ipAddress
                        ? `${a.ipAddress}:${port}`
                        : t('canvas.hubSwitch.noIp', 'keine IP-Adresse hinterlegt')}
                    </div>
                  </div>
                ))}

                {hindernisse.map((h, i) => (
                  <div key={i} className="text-[12px] text-cp-warn">
                    {h}
                  </div>
                ))}

                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-[12px]">
                    {t('canvas.hubSwitch.port', 'Port')}
                    <input
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      className="ml-1 w-20 rounded border border-cp-border bg-cp-surface-3 px-1 py-0.5"
                    />
                  </label>
                  <label className="text-[12px]">
                    {t('canvas.hubSwitch.by', 'Wer schaltet')}
                    <input
                      value={wer}
                      onChange={(e) => setWer(e.target.value)}
                      placeholder={t('canvas.hubSwitch.byPlaceholder', 'Name (optional)')}
                      className="ml-1 rounded border border-cp-border bg-cp-surface-3 px-1 py-0.5"
                    />
                  </label>
                </div>

                <label className="flex items-start gap-2 text-[12px]">
                  <input
                    type="checkbox"
                    checked={verstanden}
                    onChange={(e) => setVerstanden(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    {t(
                      'canvas.hubSwitch.confirm',
                      'Ich habe gelesen, welche Ausgänge umgeschaltet werden, und schalte an der laufenden Anlage.',
                    )}
                  </span>
                </label>

                {meldungen.map((m, i) => (
                  <div
                    key={i}
                    className={`text-[12px] ${m.ok ? 'text-emerald-400' : 'text-cp-danger'}`}
                  >
                    {m.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="av-focus rounded border border-cp-border px-3 py-1 text-[12px] hover:bg-cp-surface-3"
          >
            {t('canvas.hubSwitch.close', 'Schliessen')}
          </button>
          <button
            type="button"
            disabled={!bereit || laeuft}
            onClick={schalten}
            className="av-focus rounded border border-cp-danger px-3 py-1 text-[12px] text-cp-danger disabled:opacity-40"
          >
            {laeuft
              ? t('canvas.hubSwitch.sending', 'sendet …')
              : t('canvas.hubSwitch.send', 'jetzt schalten')}
          </button>
        </div>
      </div>
    </div>
  )
}
