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
    // ─── WARUM DIE GRENZE HOEHER LIEGT ALS DIE VORGABE (2026-09-28) ─────────
    //
    // Vitest gibt einem Test 5000 ms. Das reicht nicht mehr: `projectStore`
    // legt beim Laden `EINGEBAUTER_KATALOG` zusammen und zieht dafuer JEDEN
    // Katalog mit — inzwischen 1831 Eintraege aus 27 Modulen. Jeder Test, der
    // den Store importiert, bezahlt das.
    //
    // GEMESSEN: `templateIdentity` laeuft ALLEIN in 2,3 s durch und faellt,
    // sobald `rentmanCableMap` daneben laeuft (zusammen 11,99 s fuer 25
    // Tests). Im vollen Lauf traf es bei aufeinanderfolgenden Durchgaengen
    // jeweils ANDERE Dateien — `templateSaveMerge`, `groupPresetSaveFields`,
    // `intercomSlot`, `lifecycleDocs`.
    //
    // Ein Fehlschlag, der beim naechsten Lauf einen anderen Test trifft, ist
    // kein Befund; er ist Rauschen, das echte Befunde unglaubwuerdig macht.
    // 30 s ist nicht „grosszuegig", sondern der Abstand zur gemessenen
    // Wirklichkeit. Wer den Wert senken will, misst vorher.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Node ab 25 bringt ein eigenes `localStorage` mit, und ohne
    // `--localstorage-file` ist es leer (`undefined`). Es verdeckt das von
    // happy-dom: unter Node 26 scheiterten 17 Testdateien an
    // `localStorage.clear()`. Node 22 und 24 (CI) kennen den Schalter
    // ebenfalls; dort ist Webstorage ohnehin aus.
    execArgv: ['--no-experimental-webstorage'],
  },
})
