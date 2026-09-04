# Eigener Relay für Zugriff über Mobilfunk (Selbst-Hosting)

Die Planer (Cable / Light / MultiCam) synchronisieren live über **y-webrtc** —
die Geräte verbinden sich **peer-to-peer** (WebRTC), die Plandaten laufen also
**nicht** über einen zentralen Server. Nötig ist nur ein kleiner **Signaling-
Relay**, der die Verbindung vermittelt. Über **mobile Daten** funktioniert das,
sobald dieser Relay öffentlich erreichbar ist.

Grundsatz: **Jeder hostet seinen eigenen Relay** — keine Abhängigkeit von einem
fremden Dienst, DSGVO-freundlich, volle Kontrolle. Ohne eigenen Relay greifen
die öffentlichen y-webrtc-Server (Default) — okay zum Testen, nicht für Produktiv.

## 1. Relay starten

Der Relay ist ein einzelnes Node-Skript ohne Electron-Abhängigkeit:

```bash
# aus dem Repo:
PORT=4444 npm run relay
# oder direkt (nur `ws` als Dependency nötig):
PORT=4444 node scripts/signaling-server.mjs
```

Er hört auf `ws://0.0.0.0:4444` und vermittelt nur Signaling (Räume/Topics).

## 2. Öffentlich + verschlüsselt erreichbar machen (wss://)

Mobile Browser verlangen **wss://** (TLS). Stelle den Relay hinter einen
Reverse-Proxy mit Zertifikat (z. B. Caddy — automatisches Let's-Encrypt):

```
# Caddyfile
relay.example.com {
    reverse_proxy 127.0.0.1:4444
}
```

Alternativ nginx mit `proxy_pass` + `Upgrade`/`Connection`-Headern für WebSocket.
Als Dauerläufer: systemd-Service oder `pm2 start scripts/signaling-server.mjs`.

## 3. TURN für Mobilfunk-NAT (empfohlen)

Im Mobilfunk (Carrier-Grade-NAT) klappt reines STUN oft nicht — dann kommt keine
P2P-Verbindung zustande. Abhilfe: ein eigener **TURN-Server** (coturn):

```bash
# grob:
apt install coturn
# /etc/turnserver.conf: realm, listening-port=3478, lt-cred-mech, user=...:...
```

Die TURN-Zugangsdaten trägst du in der App unter **Zusammenarbeit →
STUN-/TURN-Server** ein — eine Zeile je Server, Felder mit `|` getrennt:

```
stun:stun.example.com:3478
turn:turn.example.com:3478|benutzer|geheim
turns:turn.example.com:5349|benutzer|geheim
```

Getrennt wird mit `|` und nicht mit `:` oder `@`, weil coturn-Passwörter aus
`lt-cred-mech` beides regelmäßig enthalten. Eine Zeile ohne bekanntes Schema —
oder ein `turn:` ohne Zugangsdaten, das jede Allocation abwiese — meldet das
Panel als „Nicht verwertbar", statt sie stillschweigend zu verwerfen.

**Jeder Teilnehmer trägt seinen eigenen TURN-Server ein.** Die Zugangsdaten
bleiben auf dem jeweiligen Rechner: sie stehen weder im Einladungslink noch in
der mDNS-Ankündigung der Session. Ein Einladungslink wird in einen Chat
gepastet — ein TURN-Passwort, das dort mitfährt, ist damit veröffentlicht.

Ohne eingetragene Server gelten die Default-STUN-Server von y-webrtc. Die
reichen im WLAN meist; zwischen zwei Netzen hinter symmetrischem NAT reichen
sie nicht.

## 4. In der App eintragen

**Zusammenarbeit** (Collab-Panel) → **Signaling-Server**:

```
wss://relay.example.com
```

Alle Teilnehmer tragen denselben Relay + denselben **Raum** ein → sie finden sich
auch über Mobilfunk. Der **„Nur lokal"-Schalter** ignoriert jeden Remote-Relay
und nutzt ausschließlich das lokale Netz (mDNS/LAN) — für sensible Umgebungen.

## Sicherheit

- Der Relay sieht **keine Plandaten** (nur verschlüsselte WebRTC-Handshakes).
- Der **Raumname** ist das gemeinsame Geheimnis — wähle einen nicht-ratbaren
  Namen (und optional das Collab-Passwort). Wer Raum + Relay kennt, kann
  mitmachen.
- Für maximale Abschottung: **„Nur lokal"** aktivieren — dann verlässt nichts das
  LAN.
