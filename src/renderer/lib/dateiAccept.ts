/**
 * #1197 — iOS/iPadOS-Safari bildet `accept` auf Uniform Type Identifiers ab.
 * Eine Endung, die das System nicht kennt (`.cableplan`, `.cpviewer`), hat
 * dort keinen UTI; die Datei erscheint in der Dateien-App ausgegraut und
 * laesst sich nicht waehlen. Das betrifft auch `.json`-Alternativen nicht,
 * weil die Projektdatei eben `.cableplan` heisst.
 *
 * Auf iOS lassen wir `accept` deshalb weg. Was gewaehlt wird, prueft ohnehin
 * der Parser dahinter (JSON.parse, Schema-Heilung).
 */
export const istIOS = (nav: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'> | undefined =
  typeof navigator === 'undefined' ? undefined : navigator): boolean => {
  if (!nav) return false
  if (/iPad|iPhone|iPod/.test(nav.userAgent)) return true
  // iPadOS 13+ meldet sich als „MacIntel“, hat aber einen Touchscreen.
  return nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1
}

export const dateiAccept = (
  accept: string,
  nav?: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'>,
): string => (istIOS(nav ?? (typeof navigator === 'undefined' ? undefined : navigator)) ? '' : accept)
