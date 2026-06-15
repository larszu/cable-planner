import { defineConfig } from 'vitest/config'

// Test-Suite-Konfiguration. Bewusst getrennt von der App-/Build-Config:
// die Tests liegen unter tests/ (außerhalb der Emit-tsconfigs, damit kein
// Test-File in dist/ landet) und decken die reine Logik ab — keine React-
// Komponenten, daher kein react-Plugin nötig.
//
// environment: 'happy-dom' weil mehrere Renderer-Module beim Import den
// Zustand-Store nachziehen, der localStorage/window beim Laden anfasst.
export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    globals: false,
    restoreMocks: true,
  },
})
