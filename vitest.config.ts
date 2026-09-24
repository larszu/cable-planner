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
    // ─── WARUM DIE GRENZE HOEHER LIEGT ALS DIE VORGABE (2026-09-24) ─────────
    //
    // Vitest gibt einem Test 5000 ms. Das reichte, bis die Katalog-Uebernahme
    // kam: `easySchematicCatalog.ts` ist 5,2 MB und 103 000 Zeilen, und JEDER
    // Test, der `projectStore` importiert, zieht ihn mit — der Store legt die
    // ausgelieferten Vorlagen beim Laden zusammen.
    //
    // GEMESSEN: einzeln laufen diese Tests in unter 5 s durch. Im vollen Lauf
    // mit 294 Dateien fielen drei bis vier von ihnen mit
    // `Test timed out in 5000ms` — und zwar wechselnde, je nachdem, welcher
    // Arbeiter gerade den grossen Katalog uebersetzt. Ein Fehlschlag, der
    // beim naechsten Lauf einen anderen Test trifft, ist kein Befund; er ist
    // Rauschen, das echte Befunde unglaubwuerdig macht.
    //
    // 30 s ist nicht „grosszuegig", sondern der Abstand zur gemessenen
    // Wirklichkeit. Wer den Wert eines Tages senken will, misst vorher.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
