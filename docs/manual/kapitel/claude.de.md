## Claude (MCP)

Claude beantwortet Fragen zum offenen Plan — Geräte, Anschlüsse, Signalwege,
Kabel und Plan-Check.

**Auf diesem Rechner**

1. *Einstellungen → MCP* → einschalten. Der Server hört nur auf `127.0.0.1` und
   nutzt ein Kopplungs-Token aus dem Schlüsselbund.
2. Den dort angezeigten Befehl kopieren, zum Beispiel:

   ```
   claude mcp add --transport http cable-planner http://127.0.0.1:<port>/mcp --header "Authorization: Bearer <token>"
   ```

3. Standard ist Lesen. **Schreiben** ist ein zweiter Schalter: Claude kann dann
   Kabel verbinden und entfernen, Kabelangaben setzen und Geräte umbenennen.
   Jeder Aufruf ist ein Rückgängig-Schritt und steht unter **Was Claude
   geändert hat**.

**Von claude.ai, vom Telefon oder einem anderen Rechner**

1. Projekt in die Cloud legen (*Datei → Cloud & Lese-Link…*).
2. In claude.ai: *Settings → Connectors → Add custom connector* mit
   `https://devices.zumpelars.de/mcp`, dann mit dem Konto der
   Gerätebibliothek anmelden.
3. Nur lesend, nur über die eigenen Cloud-Projekte. Trennen unter *Konto →
   Sicherheit → Verbundene Apps* auf devices.zumpelars.de.

Schaltbefehle für ATEM oder Videohub werden nie angeboten.
