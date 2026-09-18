// ───────────────────────────────────────────────────────────────────────────
// Fotos im Plan (#884).
//
// ─── WOZU ──────────────────────────────────────────────────────────────────
//
// „Man muss für Dokumentationszwecke Fotos hochladen können. Sowohl von der
// Handy Seite aus in den planner als auch vom planner direkt." Ein Foto vom
// Anschlussfeld, vom Verteiler, vom Schaden an der Kiste — es beantwortet
// Fragen, für die kein Feld existiert und nie eines existieren wird.
//
// ─── EIN VERWEIS UND KEINE KOPIE ───────────────────────────────────────────
//
// Das Foto zeigt AUF ein Gerät oder ein Kabel (`zeigtAuf`), es hängt nicht
// darin. Zwei Gründe, und beide sind ADR-001: ein Bild am Gerät wäre beim
// Kopieren des Geräts mitkopiert (und läge dann zweimal im Plan), und eine
// Liste aller Fotos müsste sonst den ganzen Baum ablaufen.
//
// Zeigt es auf nichts, gehört es dem Projekt — „so sah die Halle aus".
//
// ─── DIE GRÖSSE IST TEIL DES MODELLS ───────────────────────────────────────
//
// `bytes` steht im Datensatz und wird nicht jedes Mal aus der Zeichenkette
// gerechnet. Nicht aus Bequemlichkeit: die Fussleiste und der Aufnahme-Weg
// fragen sie bei jeder Änderung, und `dataUri.length` über zwanzig Bilder
// ist bei jedem Tastendruck eine Schleife über mehrere Megabyte.
//
// ─── WAS EIN FOTO NICHT IST ────────────────────────────────────────────────
//
// Eine Messung. Es trägt `aufgenommenAm` nur, wenn die Quelle es hergab —
// ein Zeitstempel „jetzt", der beim Import entsteht, sähe aus wie die
// Aufnahmezeit und wäre die Importzeit.
// ───────────────────────────────────────────────────────────────────────────

/** Worauf ein Foto zeigt. Fehlt es, gehört das Foto dem Projekt. */
export interface FotoZiel {
  equipmentId?: string
  cableId?: string
}

/** Woher das Foto kam. Kein Freitext: davon hängt ab, wem man glaubt. */
export type FotoQuelle = 'planer' | 'handy'

export interface Foto {
  id: string
  /**
   * Das Bild als Data-URI (JPEG), heruntergerechnet beim Aufnehmen.
   *
   * LEER, solange es nicht geladen ist: die Sicherungskopie im Browser trägt
   * die Bilddaten NICHT (siehe `lib/fotoMasse.ts`), und ein Plan, der aus
   * ihr wiederhergestellt wurde, hat die Datensätze ohne ihre Bilder, bis
   * die Ablage sie nachliefert.
   */
  dataUri: string
  breite: number
  hoehe: number
  /** Grösse der Data-URI in Zeichen — praktisch Bytes. */
  bytes: number
  /** Worauf es zeigt. */
  zeigtAuf?: FotoZiel
  quelle: FotoQuelle
  /** Wann aufgenommen — nur, wenn die Quelle es hergab. Nie „jetzt". */
  aufgenommenAm?: string
  /** Wann es in den Plan kam. Das ist eine andere Zahl als oben. */
  hinzugefuegtAm: string
  notiz?: string
}
