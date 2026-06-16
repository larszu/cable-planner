# Modulares UI — Konzept

Cable-Planner wächst (Show/Event, Festinstallation, QR/Mobile, Rentman,
künftig Rental/Lager). Damit die Oberfläche nicht zur „eierlegenden
Wollmilchsau" wird, sollen Funktionsbereiche als **ein-/ausschaltbare Module**
laufen. Dieses Dokument hält das UX-Konzept fest (recherche-gestützt) und die
Umsetzung in der bestehenden Architektur.

## Ziel

- Schlanke Oberfläche je nach Anwendungsfall, **ohne Funktionen zu löschen**.
- Beim ersten Start eine **leichte** Abfrage „wofür nutzt du die App?", die ein
  passendes Modul-Preset setzt — überspringbar, kein Tutorial-Zwang.
- Module jederzeit unter **Einstellungen → Module** umschaltbar.

## Recherche-Erkenntnisse (Kurzform)

1. **„Module togglen" ist erprobt** — ClickUp *ClickApps* sind die Blaupause:
   kleine Funktionspakete, per Toggle aktivierbar; Oberfläche bleibt schlank,
   nichts wird gelöscht.
2. **Grundprinzip Progressive Disclosure** — Selten-/Fortgeschrittenes erst
   zeigen, wenn relevant. Modul-Toggles = nutzergesteuerte Progressive
   Disclosure.
3. **Intent-Onboarding funktioniert** (HubSpot/Canva): nach **Rolle/Use-Case**
   fragen, nicht nach Feature-Liste; auf **2–3 Optionen** begrenzen.
4. **NN/g-Warnung**: Onboarding, das man vor der Nutzung wegklicken muss, wird
   übersprungen → **kurz, begründet, überspringbar** halten.
5. **Schattenseite Modularität**: versteckte Funktionen (vgl. VS Code, ~40 %
   genutzt). Ausgeschaltetes darf nicht unauffindbar werden.

Quellen: NN/g „Onboarding: Skip it When Possible" + „Mobile-App Onboarding";
ClickUp „Intro to ClickApps"; IxDF/UXPin „Progressive Disclosure"; Chameleon
„User Onboarding Best Practices".

## Designentscheidungen

### 1. Kein Pflicht-Wizard
Erststart zeigt **einen** überspringbaren Dialog mit *einer* Intent-Frage
(Mehrfachauswahl). „Später entscheiden" ist gleichwertig sichtbar. Ohne
Antwort gilt der Default (Kern an, neue/nische Module aus).

### 2. Presets statt Einzel-Häkchen (im Onboarding)
| Preset | aktiviert zusätzlich zum Kern |
|---|---|
| **Show/Event** | Mobile-Companion, Rentman |
| **Festinstallation** | Festinstallation (Lebenszyklus/Asset/QR/Übergabe/Feld-Rückkanal) |
| **Rental/Vermietung** | Rental/Lager, Rentman |

Der **Kern** (Canvas, Geräte/Kabel, Properties, Export/PDF) ist immer an und
kein Modul.

### 3. Dauerhafter Schaltplatz: Einstellungen → Module
ClickApps-artige Liste mit Toggle + Ein-Satz-Beschreibung je Modul. Das ist
die durchsuchbare, sichtbare Heimat (gegen „versteckte Features").

### 4. Discoverability-Sicherung
Ausgeschaltete Module verschwinden aus Menü/Panels, **aber** das Onboarding
und der Module-Tab bleiben die offensichtliche Stelle, sie wieder zu
aktivieren. (Optional später: dezenter „+ Modul aktivieren"-Hinweis an
leeren Stellen — kein Dauer-Nag.)

### 5. Granularität & Datensicherheit (Invariante)
- **Modul-An/Aus = pro Installation** (`settingsStore`, localStorage), denn es
  ist eine Nutzer-Vorliebe, **nicht** Teil der Projektdatei.
- Module steuern **nur die UI-Sichtbarkeit**. Die `.cableplan`-Daten bleiben
  immer vollständig — ein Plan öffnet auf jeder Installation, egal welche
  Module dort an sind. **Kein Datenverlust durch ein ausgeschaltetes Modul.**
- Der **Projekt-Typ** (Show/Festinstallation/Rental) kann *pro Projekt* das
  passende Preset **vorschlagen** (späterer Schritt), erzwingt aber nichts.

## Module (Erst-Taxonomie)

| ModuleId | Label | Inhalt | Default |
|---|---|---|---|
| `festinstallation` | Festinstallation | Lebenszyklus/Service, Asset-Register/QR, Übergabe-Doku, Feld-Rückkanal | an |
| `mobile` | Mobile-Companion | Handy-Patchliste, Check-off, QR-Scan, Feld-Meldungen | an |
| `rentman` | Rentman | Import/Export-Kopplung | aus¹ |
| `rental` | Rental / Lager | Bestand, Eigentum/Verfügbarkeit, Mietkalkulation (Phase 2+) | aus |

Defaults sind so gewählt, dass **bestehende Installationen nichts verlieren**
(alles bisher Sichtbare bleibt an; nur das neue `rental` startet aus und wird
über Onboarding/Settings angeboten).

¹ `rentman` war schon vorher opt-in über ein eigenes uiStore-Flag
(`rentmanEnabled`, Default aus). Dieses Flag wurde **vollständig ins
Modul-System migriert** (`useModule('rentman')`); der frühere Wert wird beim
ersten Laden einmalig aus dem uiStore übernommen, sodass niemand seine
Rentman-Einstellung verliert. Der Integrations-Tab schreibt jetzt dasselbe
Modul-Flag.

## Umsetzung in der Architektur

- `lib/modules.ts` — Registry: `ModuleId`, `MODULES` (Metadaten),
  `PRESETS`, `DEFAULT_ENABLED`. Framework-frei, testbar.
- `settingsStore` — `enabledModules: Record<ModuleId, boolean>` +
  `onboardingDone: boolean` + Setter (`setModuleEnabled`, `applyModulePreset`,
  `setOnboardingDone`), persistiert wie die übrigen Settings.
- `useModule(id)` — Hook für konditionales Rendern von Menüeinträgen,
  Panels und Dialogen.
- `ModuleOnboardingDialog` — überspringbarer Erststart-Dialog (Presets).
- Settings-Tab **„Module"** — Dauer-Schaltplatz.

### Umsetzungs-Reihenfolge
1. Registry + Store-Flags + `useModule` (+ Tests).
2. Settings-Tab „Module".
3. Überspringbarer Erststart-Dialog (Presets).
4. **Ein** Modul als Referenz konditional verdrahten (Festinstallation:
   Menüeintrag „Doku & Übergabe").
5. Restliche Module nach und nach hinter `useModule` hängen.

## Fallstricke (bewusst vermeiden)
- ❌ Pflicht-Setup-Wizard mit langer Feature-Liste.
- ❌ Module, die Projektdaten wegblenden/entfernen statt nur UI.
- ❌ Ausgeschaltetes unauffindbar machen.
