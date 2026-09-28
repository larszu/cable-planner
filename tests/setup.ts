import { Window as HappyDomWindow } from 'happy-dom'

// happy-dom implementiert window.matchMedia nicht; Theme-/Store-Code beim
// Modul-Import greift teils darauf zu. Minimaler No-op-Stub als Sicherheitsnetz,
// damit der Import der Renderer-Module nicht an einer fehlenden Browser-API
// scheitert.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

// ───────────────────────────────────────────────────────────────────────────
// `localStorage` WAR GLOBAL NICHT DA — 18 Testdateien, 83 Tests, alle mit
// „Cannot read properties of undefined (reading 'clear')".
//
// Der Grund steht in der Warnung, die Node daneben ausgibt:
//
//   ExperimentalWarning: localStorage is not available because
//   --localstorage-file was not provided.
//
// Node bringt seit 22 ein EIGENES `globalThis.localStorage` mit, als
// Getter/Setter-Paar. Ohne `--localstorage-file` gibt der Getter `undefined`
// zurueck, und der Setter nimmt nichts an — die happy-dom-Umgebung legt ihre
// Fassung also zwar hin, aber sie kommt nie wieder heraus. Nachgemessen:
// `typeof globalThis.localStorage` ist `undefined`, und der Eigenschafts-
// Deskriptor traegt `get`/`set` statt eines Werts.
//
// DESHALB `defineProperty` MIT `value` UND NICHT EINE ZUWEISUNG: nur das
// ersetzt das Getter-Paar. Eine Zuweisung liefe weiter in Nodes Setter und
// aendert nichts — genau daran ist die happy-dom-Umgebung schon gescheitert.
//
// Die Ablage kommt aus einem eigenen happy-dom-Fenster: eine nachgebaute
// Storage waere eine zweite Fassung derselben Sache und wuerde beim naechsten
// Sonderfall (`key()`, `length`, Zahlen als Schluessel) anders antworten als
// die, gegen die die Anwendung im Browser laeuft.
// ───────────────────────────────────────────────────────────────────────────
const nodeGetter = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')?.get
if (nodeGetter) {
  const ablage = new HappyDomWindow()
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value: ablage[name],
    })
    if (typeof window !== 'undefined' && window !== (globalThis as unknown)) {
      Object.defineProperty(window, name, {
        configurable: true,
        writable: true,
        value: ablage[name],
      })
    }
  }
}
