// #version — SemVer-Vergleich für die Update-Logik (electron-updater).
//
// electron-updater meldet die neueste GitHub-Release-Version. Ein Update-Hinweis
// soll NUR erscheinen, wenn diese echt neuer ist als die laufende App — nicht bei
// jeder Abweichung. Der frühere String-Vergleich (`latest !== current`) hätte sonst
// (a) "8.10.0" als älter denn "8.9.0" einsortiert und (b) eine Dev-/Pre-Release-
// Version, die VOR dem letzten Release liegt, fälschlich als "Update" angeboten
// (Downgrade). Reiner Helper ohne Electron-Import → unit-testbar (tests/).

/** Zerlegt "v8.2.0" / "8.2.0-beta.1" in [major, minor, patch] (Suffixe ignoriert). */
function parseVersion(v: string): [number, number, number] {
  const core = v.trim().replace(/^v/i, '').split(/[-+]/)[0] // Pre-Release/Build abschneiden
  const parts = core.split('.')
  return [parseInt(parts[0], 10) || 0, parseInt(parts[1], 10) || 0, parseInt(parts[2], 10) || 0]
}

/** true, wenn `latest` echt neuer (höher) als `current` ist — numerisch je Segment. */
export function isNewerVersion(latest: string, current: string): boolean {
  if (!latest || !current) return false
  const a = parseVersion(latest)
  const b = parseVersion(current)
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i]
  }
  return false
}
