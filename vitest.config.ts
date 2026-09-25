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
    // ─── WARUM DIE GRENZE HOEHER LIEGT ALS DIE VORGABE (2026-09-25) ─────────
    //
    // Vitest gibt einem Test 5000 ms. Das reichte, bis der Katalog wuchs:
    // `projectStore` legt beim Laden die ausgelieferten Vorlagen zusammen und
    // zieht dafuer JEDEN Katalog mit — inzwischen 1832 Eintraege aus 25
    // Modulen. Jeder Test, der den Store importiert, bezahlt das.
    //
    // GEMESSEN: einzeln laufen diese Tests in unter 3 s durch. Im vollen Lauf
    // mit 295 Dateien fielen bei drei aufeinanderfolgenden Laeufen jeweils
    // VIER BIS FUENF aus — und jedes Mal ANDERE, je nachdem, welcher Arbeiter
    // gerade uebersetzt. `templateSaveMerge`, `groupPresetSaveFields`,
    // `intercomSlot`, `lifecycleDocs`, `templateIdentity`.
    //
    // Ein Fehlschlag, der beim naechsten Lauf einen anderen Test trifft, ist
    // kein Befund; er ist Rauschen, das echte Befunde unglaubwuerdig macht.
    // 30 s ist nicht „grosszuegig", sondern der Abstand zur gemessenen
    // Wirklichkeit. Wer den Wert senken will, misst vorher.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
