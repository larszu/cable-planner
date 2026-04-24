## v0.2.4 - Bugfix release

### Fixes
- **Textfelder im 'Neues Projekt'-Dialog funktionieren jetzt wieder.** Ein `useEffect` setzte bei jedem Eltern-Re-Render alle Eingabefelder zur`ueck, sodass gedruckte Zeichen sofort verschwanden. Der Dialog merkt sich `initial` jetzt in einer Ref und reagiert nur noch auf Oeffnen/Schliessen.
- **Neues Projekt entfernt den Autosave.** `clear()` wischt jetzt auch `cable-planner:projectAutosave` aus dem localStorage, damit beim naechsten Start nicht wieder die alten Geraete auftauchen.
- **Canvas wird beim 'Neues Projekt' sofort zurueckgesetzt.** Der Meta-Dialog oeffnet jetzt gegen ein leeres Projekt, was auch die Text-Eingabe-Regression oben zuverlaessig ausschliesst.

### Hinweis zu vorhandenen Installationen
Das App-Daten-Verzeichnis `%APPDATA%\cable-planner\` bleibt beim De-/Neuinstallieren erhalten. Wer auf v0.2.4 updatet und nach wie vor alte Geraete im Canvas sieht, kann einmal 'Neues Projekt' waehlen - ab dann ist der Autosave sauber.

### Downloads
- `Cable Planner-0.2.4-x64.exe` - NSIS-Installer (signiert)
- `Cable Planner-0.2.4-portable.exe` - portable EXE
