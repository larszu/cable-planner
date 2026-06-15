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
