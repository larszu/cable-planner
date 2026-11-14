// ───────────────────────────────────────────────────────────────────────────
// Anhänge am Projekt: Messprotokolle, Herstellerunterlagen,
// Konfigurations-Sicherungen.
//
// Die Datei selbst liegt neben dem Projekt in `Anhaenge/` und wird von
// `src/main/services/attachmentStore.ts` geschrieben; hier steht, was im
// Projekt davon bleibt — Hash, Name, relativer Pfad, Größe, Zeitpunkt — und
// wozu die Datei gehört. KEINE Dateiinhalte im Projekt, aus demselben Grund
// wie bei den Belegen (`types/receipt.ts`).
//
// `AnhangDatei` ist eine ABSCHRIFT von `AttachmentFile` in main; main und
// Renderer teilen keine Typen. `tests/anhaenge.test.ts` prüft, dass beide
// dieselben Felder haben.
// ───────────────────────────────────────────────────────────────────────────

export interface AnhangDatei {
  /** SHA-256 des Inhalts — die Identität der Datei. */
  sha256: string
  /** Wie die Datei beim Nutzer hieß (bereinigt). Nur zur Anzeige. */
  fileName: string
  /** Pfad relativ zum Projektverzeichnis. Nie absolut. */
  storedAs: string
  mediaType: string
  bytes: number
  /** Wann sie angehängt wurde (ISO). */
  addedAt: string
}

export type AnhangArt = 'messprotokoll' | 'herstellerunterlage' | 'konfig-backup' | 'sonstiges'

export const ANHANG_ARTEN: readonly AnhangArt[] = ['messprotokoll', 'herstellerunterlage', 'konfig-backup', 'sonstiges']

/** Kanonisch deutsch — für die gestempelte Liste. Die Oberfläche übersetzt selbst. */
export const ANHANG_ART_LABEL: Readonly<Record<AnhangArt, string>> = {
  messprotokoll: 'Test report',
  herstellerunterlage: 'Manufacturer document',
  'konfig-backup': 'Configuration backup',
  sonstiges: 'Other',
}

export interface ProjektAnhang {
  id: string
  art: AnhangArt
  /** Wie der Anhang in der Liste heißen soll. Leer → der Dateiname. */
  titel: string
  datei: AnhangDatei
  /**
   * Wozu die Datei gehört. Ohne → zur Anlage. #1186: auch ein RAUM
   * (`LocationFrame.id`) und ein GERÄTETYP (`deviceTypeId`) — ein Datenblatt
   * gilt für jedes Gerät des Typs, ein Foto vom Bodentank für den Raum.
   */
  ziel?: { type: AnhangZielArt; id: string }
  /** #1186 — Schlagworte zum Wiederfinden („Rack A", „Abnahme", „Angebot"). */
  schlagworte?: string[]
}

export type AnhangZielArt = 'cable' | 'equipment' | 'location' | 'deviceType'
export const ANHANG_ZIEL_ARTEN: readonly AnhangZielArt[] = ['cable', 'equipment', 'location', 'deviceType']

/** Warum eine Datei nicht angenommen wurde — dieselben Gründe wie in main. */
export type AnhangAblehnung =
  | 'no-project-path'
  | 'not-a-file'
  | 'too-large'
  | 'unsupported-type'
  | 'unreadable'
  | 'outside-project'

export type AnhangErgebnis = { ok: true; file: AnhangDatei } | { ok: false; reason: AnhangAblehnung }
