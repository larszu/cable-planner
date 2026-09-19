// ───────────────────────────────────────────────────────────────────────────
// EIGENE VORLAGEN EINREICHEN — und was vorher geprueft wird (#878)
//
// „Einreichen eigener Vorlagen aus der App (als Datei oder PR), mit
// Quelle/Datenblatt-Link" · „Pruefung vor Aufnahme (Ports, Signaltypen,
// Leistungsaufnahme)" · „‚Geraet tauschen' mit Port-Zuordnung bleibt
// kompatibel".
//
// ─── WAS DIESE DATEI IST UND WAS SIE AUSDRUECKLICH NICHT IST ──────────────
//
// Sie ist der WEG einer Vorlage aus dieser App heraus, und die Pruefung davor.
// Sie ist NICHT der Katalog-Ausbau (erster Punkt des Issues): dafuer braucht
// es Herstellerdatenblaetter, und die sind von hier aus nicht erreichbar.
// Zahlen aus einer Suchergebnis-Zusammenfassung abzuschreiben waere genau das,
// was die Lizenz-Warnung des Issues meint, nur ohne Lizenz — eine Angabe, die
// niemand nachlesen kann.
//
// ─── WARUM DIE QUELLE BLOCKIERT UND DIE LEISTUNG NICHT ────────────────────
//
// Das Issue sagt es selbst: „Lieber Herstellerdatenblaetter als Quelle." Eine
// eingereichte Vorlage OHNE Beleg ist genau das, was der Katalog nicht
// aufnehmen kann — niemand kann sie nachpruefen, und in einem Plan sieht sie
// spaeter aus wie eine gepruefte.
//
// Die Leistungsaufnahme dagegen FEHLT bei manchen Geraeten wirklich (ein
// passiver Splitter hat keine, ein PoE-Geraet nimmt sie aus dem Netz). Sie zu
// erzwingen hiesse, eine Zahl zu erfinden, damit ein Formular zufrieden ist.
// Sie wird deshalb GENANNT und nicht verlangt — und im Katalog steht dann
// „nicht angegeben" statt einer 0, die wie eine Messung aussieht.
//
// ─── UND WARUM DIE PORT-PRUEFUNG SCHAERFER IST, ALS SIE AUSSIEHT ──────────
//
// Der vierte Punkt des Issues („Geraet tauschen bleibt kompatibel") ist keine
// eigene Pruefung, sondern eine FOLGE der dritten. Das Tauschen ordnet Ports
// ueber `(connectorType, aufgeloestes Label)` zu (siehe `previewMapping` in
// `ReplaceDeviceSection` und die Slice dahinter). Eine Vorlage, deren Port
// keinen Steckertyp oder kein Label traegt, faellt dort auf den positionalen
// Rueckfall — und der verkabelt im Zweifel den falschen Anschluss. Genau
// diese beiden Felder verlangt die Pruefung deshalb je Port.
// ───────────────────────────────────────────────────────────────────────────

import type { EquipmentTemplate, Port } from '../types/equipment'
import { resolvePortLabel } from './portLabel'
import { format as einsetzen } from './i18n'

export const EINREICHUNG_FORMAT = 'avplan-device-submission'

/**
 * Erhoehen, sobald ein Feld dazukommt, dessen Fehlen beim Lesen etwas
 * LOESCHT — dieselbe Regel wie beim portablen Lager und beim
 * Intercom-Austausch.
 */
export const EINREICHUNG_VERSION = 1

export type BefundArt =
  | 'ohne-namen'
  | 'ohne-quelle'
  | 'quelle-kein-link'
  | 'ohne-kategorie'
  | 'ohne-ports'
  | 'port-ohne-steckertyp'
  | 'port-ohne-label'
  | 'port-label-doppelt'
  | 'leistung-offen'

export interface EinreichungsBefund {
  art: BefundArt
  /** `true` heisst: so nicht einreichbar. `false` heisst: wird mitgenannt. */
  blockiert: boolean
  /** Port-Id, wenn der Befund an einem Port haengt. */
  portId?: string
  text: string
}

type Uebersetzen = (key: string, fallback?: string) => string
const quelle: Uebersetzen = (_key, fallback) => fallback ?? _key

/**
 * Sieht die Quelle nach einem Datenblatt aus?
 *
 * Geprueft wird, dass es ein ABRUFBARER Ort ist und kein Satz. „Steht im
 * Handbuch" ist keine Quelle im Sinne dieses Issues: niemand kann es
 * aufschlagen. `http(s)` oder ein `www.` reichen — mehr zu verlangen hiesse,
 * eine URL zu validieren, die es erst beim Anklicken gibt.
 */
export const istLink = (s: string | undefined): boolean =>
  !!s && /^(https?:\/\/|www\.)\S+$/i.test(s.trim())

/**
 * Was an einer Vorlage fehlt, bevor sie eingereicht werden kann.
 *
 * Leere Liste heisst: sie darf raus. Blockierende Befunde stehen zuerst —
 * wer die Liste abarbeitet, soll oben anfangen koennen.
 */
export function pruefeVorlage(v: EquipmentTemplate, t: Uebersetzen = quelle): EinreichungsBefund[] {
  const out: EinreichungsBefund[] = []

  if (!v.name?.trim()) {
    out.push({ art: 'ohne-namen', blockiert: true, text: t('submit.noName', 'The template has no name.') })
  }
  if (!v.category?.trim()) {
    out.push({
      art: 'ohne-kategorie',
      blockiert: true,
      text: t('submit.noCategory', 'No category — without one the template cannot be found in the library.'),
    })
  }

  const url = v.manufacturerUrl?.trim()
  if (!url) {
    out.push({
      art: 'ohne-quelle',
      blockiert: true,
      text: t('submit.noSource', 'No source: a template without a datasheet link cannot be checked by anyone — and in a plan it later looks like a checked one.'),
    })
  } else if (!istLink(url)) {
    out.push({
      art: 'quelle-kein-link',
      blockiert: true,
      text: t('submit.sourceNotALink', 'The source is not a link. "It is in the manual" is not a source: nobody can open it.'),
    })
  }

  // Ein- und Ausgaenge zusammen: das Tauschen sieht beide Listen, und ein
  // Geraet, dessen Ausgaenge vollstaendig sind und dessen Eingaenge nicht,
  // verkabelt sich beim Tausch zur Haelfte falsch.
  const ports: Port[] = [...(v.inputs ?? []), ...(v.outputs ?? [])]
  if (ports.length === 0) {
    out.push({
      art: 'ohne-ports',
      blockiert: true,
      text: t('submit.noPorts', 'No ports — there would be nothing to cable.'),
    })
  }

  const labels = new Map<string, number>()
  for (const p of ports) {
    if (!p.connectorType) {
      out.push({
        art: 'port-ohne-steckertyp',
        blockiert: true,
        portId: p.id,
        text: t('submit.portNoConnector', 'Port without a connector type. "Replace device" matches by connector type — without it it falls back to position, and that cables the wrong socket.'),
      })
    }
    const label = resolvePortLabel(p).text.trim()
    if (!label) {
      out.push({
        art: 'port-ohne-label',
        blockiert: true,
        portId: p.id,
        text: t('submit.portNoLabel', 'Port without a label. Same reason: the match runs over connector type AND label.'),
      })
      continue
    }
    const key = `${p.connectorType ?? ''}|${label.toLowerCase()}`
    labels.set(key, (labels.get(key) ?? 0) + 1)
  }
  for (const [key, n] of labels) {
    if (n > 1) {
      // Ein Schluessel, ein ganzer Satz: die Wortstellung gehoert zur
      // Sprache, und zwei aneinandergesetzte `t()` ergeben in der naechsten
      // keinen Satz mehr.
      out.push({
        art: 'port-label-doppelt',
        blockiert: false,
        text: einsetzen(
          t('submit.portLabelTwice', 'Two ports share connector type and label "{label}" ({n}x). Replace device then takes the first free one.'),
          { label: key.split('|')[1] ?? '', n },
        ),
      })
    }
  }

  // Nicht blockierend, mit Absicht: ein passiver Splitter hat keine
  // Leistungsaufnahme, und ein PoE-Geraet nimmt sie aus dem Netz. Eine Zahl
  // zu erzwingen hiesse, eine zu erfinden.
  if (v.powerWatts === undefined || v.powerWatts === null) {
    out.push({
      art: 'leistung-offen',
      blockiert: false,
      text: t('submit.noPower', 'Power draw not stated. That is allowed — it stays "not stated" in the catalogue instead of a 0 that looks measured.'),
    })
  }

  return [...out.filter((b) => b.blockiert), ...out.filter((b) => !b.blockiert)]
}

/** Darf diese Vorlage raus? */
export const einreichbar = (v: EquipmentTemplate): boolean =>
  !pruefeVorlage(v).some((b) => b.blockiert)

export interface EinreichungsEintrag {
  vorlage: EquipmentTemplate
  /** Die Hinweise, die nicht blockierten — sie fahren MIT. */
  hinweise: string[]
}

export interface Uebersprungen {
  name: string
  gruende: string[]
}

export interface Einreichung {
  format: typeof EINREICHUNG_FORMAT
  version: number
  exportedAt: string
  app: string
  appVersion: string
  /** Wer einreicht. Freiwillig, und deshalb optional. */
  absender?: string
  eintraege: EinreichungsEintrag[]
  /**
   * Was NICHT mitging, mit Grund.
   *
   * Steht in der DATEI und nicht nur im Fenster: wer sie weitergibt, gibt
   * mit weiter, dass etwas fehlt. Eine Einreichung, die still die Haelfte
   * weglaesst, sieht vollstaendig aus.
   */
  uebersprungen: Uebersprungen[]
}

export function baueEinreichung(
  vorlagen: readonly EquipmentTemplate[],
  meta: { app: string; appVersion: string; absender?: string; jetzt?: Date },
  t: Uebersetzen = quelle,
): Einreichung {
  const eintraege: EinreichungsEintrag[] = []
  const uebersprungen: Uebersprungen[] = []

  for (const v of vorlagen) {
    const befunde = pruefeVorlage(v, t)
    const blockierend = befunde.filter((b) => b.blockiert)
    if (blockierend.length > 0) {
      uebersprungen.push({ name: v.name?.trim() || '—', gruende: blockierend.map((b) => b.text) })
      continue
    }
    eintraege.push({ vorlage: v, hinweise: befunde.map((b) => b.text) })
  }

  return {
    format: EINREICHUNG_FORMAT,
    version: EINREICHUNG_VERSION,
    exportedAt: (meta.jetzt ?? new Date()).toISOString(),
    app: meta.app,
    appVersion: meta.appVersion,
    ...(meta.absender?.trim() ? { absender: meta.absender.trim() } : {}),
    eintraege,
    uebersprungen,
  }
}
