// ───────────────────────────────────────────────────────────────────────────
// Wie weit reicht diese Adresse? (Bedarf 133, P4)
//
//   > Venue internet is unreliable or absent; cloud-only rundown products are
//   > unusable as the primary show layer on site. BUT managers also need
//   > multi-site and remote viewers, and IMMEDIATELY WANT ACCESS CONTROL when
//   > they get it.
//
// Belege: `cpvalente/ontime#1423` (2025-01-03) — Passwortschutz wird
// ausdrücklich für Aufstellungen verlangt, die „globally available (open
// network or internet)" sind — und `#1547` (2025-03-18), eine Show über zwei
// Standorte mit gemeinsamer Ansicht.
//
// ─── DIE SPANNUNG STEHT IM BEDARF SELBST ───────────────────────────────────
//
// Die Quelle sagt nicht „LAN oder Netz", sondern: BEIDES muss vorgesehen
// sein, und das Zweite zieht sofort eine Zugriffskontrolle nach sich. Genau
// das ist hier gebaut — und zwar so herum, dass der LAN-Weg leicht bleibt und
// der Weg darüber hinaus eine ausdrückliche Entscheidung verlangt.
//
// ─── WAS HIER WIRKLICH DER FEHLER WAR ──────────────────────────────────────
//
// `mobileShareServer` bindet auf `0.0.0.0` und bot bisher JEDE nicht-interne
// IPv4 des Rechners als Freigabe-Adresse an — samt Token in der URL. Auf einem
// Hallen-WLAN ist das genau richtig: kurze Wege, ein QR-Code, fertig.
//
// Steht der Rechner aber an einer öffentlich erreichbaren Adresse — ein
// Hotel-Uplink ohne NAT, ein Uni-Netz mit öffentlichem /16, ein Server mit
// fester IP —, dann war dieselbe Zeile ein Bearer-Token in einer URL im
// offenen Netz. Niemand hatte das entschieden; es ergab sich aus der
// Netzwerkkarte.
//
// Deshalb: Adressen jenseits des LANs werden NICHT ANGEBOTEN, sondern
// ZURÜCKGEHALTEN UND BENANNT. Wer sie braucht, schaltet sie frei — und liest
// dabei, was er tut. Eine Freigabe, die sich aus der Netzwerkkarte ergibt, ist
// keine Entscheidung.
//
// REIN: keine Datei, kein Netz, keine Uhr. Die Adressen kommen von aussen.
// ───────────────────────────────────────────────────────────────────────────

/** Wie weit eine Adresse trägt. */
export type Reach =
  /** Nur dieser Rechner. */
  | 'loopback'
  /** Das lokale Netz — nicht aus dem Internet erreichbar. */
  | 'private'
  /**
   * Alles andere: potenziell aus dem offenen Netz erreichbar.
   *
   * „Potenziell", weil dieser Rechner nicht wissen kann, ob eine Firewall
   * davor steht. Genau deshalb wird die Adresse zurueckgehalten und nicht
   * bewertet: eine Vermutung ueber fremde Netzwerktechnik ist keine
   * Zugriffskontrolle.
   */
  | 'beyond-lan';

export const REACH_LABEL: Readonly<Record<Reach, string>> = {
  loopback: 'nur dieser Rechner',
  private: 'lokales Netz',
  'beyond-lan': 'über das lokale Netz hinaus erreichbar',
};

const oktette = (ip: string): number[] | null => {
  const teile = ip.trim().split('.');
  if (teile.length !== 4) return null;
  const zahlen = teile.map((t) => (/^\d{1,3}$/.test(t) ? Number(t) : NaN));
  return zahlen.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) ? zahlen : null;
};

/**
 * Wie weit traegt diese Adresse?
 *
 * IPv4 nach RFC 1918 (10/8, 172.16/12, 192.168/16), dazu CGNAT (100.64/10,
 * RFC 6598) und Link-Local (169.254/16, RFC 3927) gelten als lokal. IPv6
 * entsprechend: `::1` ist Loopback, `fe80::/10` Link-Local und `fc00::/7`
 * Unique-Local.
 *
 * ALLES ANDERE gilt als „darueber hinaus" — auch eine Adresse, die dieser
 * Rechner nicht einordnen kann. Das ist Absicht: im Zweifel wird
 * ZURUECKGEHALTEN und nicht angeboten. Die andere Richtung waere eine
 * Freigabe aus Unkenntnis.
 */
export function classifyAddress(ip: string): Reach {
  const roh = ip.trim().toLowerCase();
  if (!roh) return 'beyond-lan';

  // IPv6 zuerst: eine Zone-Id (`fe80::1%eth0`) gehoert zur Adresse.
  if (roh.includes(':')) {
    const ohneZone = roh.split('%')[0];
    if (ohneZone === '::1') return 'loopback';
    if (/^fe[89ab][0-9a-f]:/.test(ohneZone)) return 'private';
    if (/^f[cd][0-9a-f]{2}:/.test(ohneZone)) return 'private';
    // IPv4-mapped (`::ffff:192.168.1.5`) wird als das behandelt, was es ist.
    const eingebettet = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ohneZone);
    if (eingebettet) return classifyAddress(eingebettet[1]);
    return 'beyond-lan';
  }

  const o = oktette(roh);
  if (!o) return 'beyond-lan';
  const [a, b] = o;
  if (a === 127) return 'loopback';
  if (a === 10) return 'private';
  if (a === 192 && b === 168) return 'private';
  if (a === 172 && b >= 16 && b <= 31) return 'private';
  if (a === 100 && b >= 64 && b <= 127) return 'private';
  if (a === 169 && b === 254) return 'private';
  return 'beyond-lan';
}

export interface WithheldAddress {
  address: string;
  reach: Reach;
  reason: string;
}

export interface ShareAddresses {
  /** Adressen, unter denen die Freigabe angeboten wird. */
  offered: string[];
  /** Adressen, die es gibt und die NICHT angeboten werden — mit Grund. */
  withheld: WithheldAddress[];
  /** Ob mindestens eine zurueckgehaltene Adresse ueber das LAN hinausreicht. */
  hasBeyondLan: boolean;
}

/**
 * Der Satz, der die Freigabe erklaert.
 *
 * Steht im Modul und nicht nur im Kommentar, damit die Oberflaeche ihn zeigen
 * kann, ohne ihn ein zweites Mal zu formulieren — und damit er nur an EINER
 * Stelle geaendert werden muss, wenn sich die Regel aendert.
 */
export const BEYOND_LAN_REASON =
  'Diese Adresse ist möglicherweise aus dem offenen Netz erreichbar. Das '
  + 'Freigabe-Token steht in der URL, und ein Token in einer URL ist im offenen '
  + 'Netz keine Zugriffskontrolle: wer den Link weitergibt oder mitliest, hat '
  + 'Zugang. Freigabe hier ausdrücklich einschalten, wenn das gewollt ist.';

/**
 * Welche Adressen angeboten werden — und welche nicht.
 *
 * DIE ENGSTELLE. Beide Listen entstehen hier, aus derselben Einordnung: zwei
 * Rechnungen koennten sich widersprechen, und dann stuende eine Adresse oben
 * als angeboten und unten als zurueckgehalten.
 *
 * `allowBeyondLan` ist eine AUSDRUECKLICHE Entscheidung des Nutzers und hat
 * deshalb keinen Vorgabewert im Aufruf-Sinn: ohne sie bleibt es beim LAN. Eine
 * Freigabe, die sich aus der Netzwerkkarte ergibt, ist keine Entscheidung.
 */
export function shareAddresses(
  addresses: readonly string[],
  opts: { allowBeyondLan: boolean },
): ShareAddresses {
  const offered: string[] = [];
  const withheld: WithheldAddress[] = [];
  for (const ip of addresses) {
    const reach = classifyAddress(ip);
    if (reach !== 'beyond-lan' || opts.allowBeyondLan) {
      offered.push(ip);
      continue;
    }
    withheld.push({ address: ip, reach, reason: BEYOND_LAN_REASON });
  }
  return { offered, withheld, hasBeyondLan: withheld.length > 0 };
}
