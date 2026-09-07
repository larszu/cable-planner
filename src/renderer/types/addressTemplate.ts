// ───────────────────────────────────────────────────────────────────────────
// BEDARF 20 (P1) — schichtbare Adressbereichs-Vorlagen.
//
//   > Layerable address-range templates: a truck/rig standing plan plus a
//   > per-venue overlay, with live conflict validation. Cheap to build,
//   > immediately felt, and something no AV planning tool currently does.
//
// Der Schaden, den die Bedarfs-Datenbank dazu nennt, ist der handfesteste im
// ganzen Netz-Teil: doppelte IPs „could freeze up part of your network", und
// eine nicht zusammenpassende Maske erzeugt den Fehler, den niemand findet —
// „pings from here but not from there".
//
// ─── WARUM ES DAS BIS HEUTE NICHT GAB ──────────────────────────────────────
//
// `lib/addressPlan.ts` (Initiative 8) rechnet seit Langem aus, WELCHES GERAET
// NOCH KEINE ADRESSE HAT. In seinem eigenen Kopf steht, warum es dort aufhoert:
//
//   > WAS HIER BEWUSST NICHT PASSIERT: Adressen VERGEBEN. Woher Subnetze
//   > kommen — abgeleitet oder aus einem projektweiten Pool — ist die offene
//   > Eigentuemer-Frage E-5 […]
//
// E-5 ist am 2026-09-07 entschieden: **abgeleitet UND ein Pool, den der
// Projektleiter fuehrt.** Genau das sind die zwei Ebenen dieser Datei. Der
// stehende Plan IST der Pool des Projektleiters; die Haus-Ebene ist das, was
// vor Ort abgeleitet wird — und sie ueberschreibt.
//
// ─── DIE VOKABEL IST GELIEHEN, ABER GEPRUEFT ───────────────────────────────
//
// `kind: 'container'` heisst dasselbe wie NetBox' Praefix-Status „container":
//
//   > The "container" status indicates that the prefix exists merely as a
//   > container for organizing child prefixes.
//   (netbox-community/netbox, `docs/models/ipam/prefix.md`, gelesen 2026-09-07)
//
// Das Gegenstueck heisst hier `'assignable'` und NICHT `'pool'` — obwohl das
// naheliegt und obwohl der Nutzer bei der E-5-Entscheidung von einem „Pool"
// sprach. Grund: NetBox hat ein Feld `is_pool`, und es bedeutet etwas voellig
// anderes:
//
//   > Designates whether the prefix should be treated as a pool. If selected,
//   > the first and last IP addresses within the prefix (normally reserved as
//   > the network and broadcast addresses, respectively) will be considered
//   > usable.
//
// Dieselbe Wortmarke fuer „hier wird vergeben" zu benutzen, waere die Sorte
// Fehler, die spaeter niemand mehr findet: ein Import aus NetBox oder ein
// Export dorthin haette ein Feld auf ein gleichnamiges mit anderer Bedeutung
// abgebildet. `is_pool` gibt es hier trotzdem — als `firstLastUsable`, mit
// genau der geliehenen Bedeutung und ohne den geliehenen Namen.
//
// ─── WAS DIESE DATEI BEWUSST NICHT TUT ─────────────────────────────────────
//
// Adressen SELBST setzen. Die Ebenen sagen, WOHIN eine Adresse gehoert;
// `proposeReaddress` rechnet aus, WIE sie dort hiesse — und gibt einen
// Vorschlag zurueck, den ein Mensch uebernimmt. Dieselbe Haltung wie bei den
// PTZ-Presets (Bedarf 96): „ein Preset darf nie still ueberschreiben". Und
// dieselbe wie beim Vorbild: NETBOX VERGIBT AUCH NICHT SELBST. Es meldet
// freien Raum, den ein Mensch oder ein API-Aufruf beansprucht.
// ───────────────────────────────────────────────────────────────────────────

import type { NetworkInterfaceRole } from './network'

/**
 * Wozu ein Bereich da ist.
 *
 * `container` — eine Klammer. Sie ordnet Unterbereiche und traegt SELBST keine
 * Geraete. „10.0.0.0/8 ist unser Haus" ist eine Klammer; wer ein Geraet direkt
 * hineinsetzt, hat den Unterbereich vergessen, in den es gehoert.
 *
 * `assignable` — hier wohnen Geraete.
 */
export type AddressRangeKind = 'container' | 'assignable'

export const ADDRESS_RANGE_KINDS: ReadonlyArray<AddressRangeKind> = ['container', 'assignable']

export interface AddressRange {
  /** Datensatz-Id. Innerhalb einer Ebene eindeutig, ueber Ebenen hinweg NICHT. */
  id: string
  /**
   * DER SCHLUESSEL, AN DEM DIE EBENEN SICH TREFFEN.
   *
   * Er ist das einzige, was zwischen dem stehenden Plan und der Haus-Ebene
   * gleich sein MUSS: die Haus-Ebene ersetzt den stehenden Bereich mit
   * demselben Schluessel und laesst alle anderen stehen.
   *
   * WARUM NICHT `role`. Weil vier Medien-Bereiche auf zwei Medien-Rollen
   * fallen: ein Aufbau mit Dante primaer/sekundaer UND ST-2110 rot/blau hat
   * vier Bereiche, die alle `media-primary` oder `media-secondary` sind.
   * Ein Schluessel je Rolle koennte diese vier nicht auseinanderhalten, und
   * die Haus-Ebene wuesste nicht, welchen sie ersetzt.
   *
   * WARUM NICHT `id`. Weil die beiden Ebenen unabhaengig entstehen — der
   * stehende Plan einmal fuer den Wagen, die Haus-Ebene vor Ort — und eine
   * zufaellige Id sich nicht wiederfinden laesst.
   *
   * Das Vorbild traegt denselben Gedanken: NetBox' `Role` ist „the
   * user-defined functional role assigned to the prefix", ein eigenes Objekt
   * neben Status und Praefix.
   */
  key: string
  /** Wie er im Gespraech heisst („Dante primaer", „2110 rot", „Haus-Steuerung"). */
  name: string
  /**
   * Wofuer er da ist — dieselbe Vokabel wie an der Schnittstelle und im
   * Segment. Kein zweiter Satz Woerter fuer dieselbe Sache.
   *
   * `unspecified` ist erlaubt und kein Fehler. Ein Bereich, dessen Zweck
   * niemand gesagt hat, nimmt an der Rollen-Pruefung einfach nicht teil.
   */
  role: NetworkInterfaceRole
  /** Der Bereich in CIDR-Schreibweise. Beim Laden auf die Netz-Adresse gerundet. */
  cidr: string
  kind: AddressRangeKind
  /** Die VLAN-Id, in der der Bereich liegt — falls der Plan sie kennt. */
  vlanId?: number
  /** Das Gateway IN diesem Bereich, als Adresse. */
  gateway?: string
  /**
   * NetBox' `is_pool`, mit NetBox' Bedeutung: erste und letzte Adresse des
   * Bereichs sind benutzbar (NAT-Pools, Punkt-zu-Punkt).
   *
   * Wofuer es hier gebraucht wird: ohne dieses Feld lehnte
   * `proposeReaddress` einen voellig richtigen Vorschlag ab, weil er auf der
   * Netz- oder Broadcast-Adresse landet — auf einem NAT-Pool ist genau das
   * erlaubt. Ein Werkzeug, das eine richtige Konfiguration verweigert, wird
   * umgangen.
   */
  firstLastUsable?: boolean
  note?: string
}

/**
 * Welche Ebene.
 *
 * `standing` — der Plan, der am Wagen haengt und jede Produktion ueberlebt.
 * `venue`    — was das Haus stellt oder was vor Ort abgeleitet wurde. Sie
 *              gewinnt, denn sie ist die juengere Auskunft.
 */
export type AddressLayerKind = 'standing' | 'venue'

export const ADDRESS_LAYER_KINDS: ReadonlyArray<AddressLayerKind> = ['standing', 'venue']

export interface AddressLayer {
  id: string
  kind: AddressLayerKind
  /** „Uebertragungswagen 2", „Stadthalle, Auskunft Haustechnik vom 3.9." */
  name: string
  ranges: AddressRange[]
}

/** Was auf dem Blatt steht, wo nichts festgehalten wurde. */
export const NO_RANGE_NAME = 'ohne Namen'
export const NO_LAYER_NAME = 'ohne Namen'
export const NO_GATEWAY_IN_RANGE = 'kein Gateway geplant'
