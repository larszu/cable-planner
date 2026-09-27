#!/bin/bash
# Einmalige Einrichtung von Signaling-Relay + coturn (cable-planner #869) auf
# dem lz-share-VPS. Idempotent; als root. Aendert lz-share an genau zwei
# Stellen, beide vorher gesichert (wie setup-server.sh der Geraetebibliothek):
#   /opt/pingvin/Caddyfile            + Block relay.zumpelars.de
#   /opt/pingvin/docker-compose.yml   caddy tritt dem Netz relay_edge bei
# Und an einer Stelle die Geraetebibliothek: TURN_SECRET in /opt/devices/.env,
# damit sie angemeldeten Konten Zugangsdaten ausstellen kann.
#
#   curl -fsSL https://raw.githubusercontent.com/larszu/cable-planner/main/deploy/relay/setup-relay.sh | bash
#   (oder nach dem Clone: bash /opt/relay-src/deploy/relay/setup-relay.sh)
set -euo pipefail
# Oeffentliches Repo: kein Deploy-Key noetig, nur lesend ueber https.
REPO=https://github.com/larszu/cable-planner.git
STAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p /opt/relay/certs
if [ ! -d /opt/relay-src/.git ]; then
  git clone --depth 50 --filter=blob:none --sparse "$REPO" /opt/relay-src
  git -C /opt/relay-src sparse-checkout set deploy/relay scripts
fi
install -m 755 /opt/relay-src/deploy/relay/relay-deploy /usr/local/bin/relay-deploy
cp -n /opt/relay-src/deploy/relay/compose.yml /opt/relay/compose.yml

# Ein Secret fuer beide Seiten. Liegt nur in den beiden .env (Modus 600).
if [ ! -f /opt/relay/.env ]; then
  install -m 600 /dev/null /opt/relay/.env
  echo "TURN_SECRET=$(openssl rand -hex 32)" >> /opt/relay/.env
  echo "REALM=relay.zumpelars.de" >> /opt/relay/.env
fi
SECRET=$(grep '^TURN_SECRET=' /opt/relay/.env | cut -d= -f2)
if [ -f /opt/devices/.env ] && ! grep -q "^TURN_SECRET=$SECRET\$" /opt/devices/.env; then
  sed -i '/^TURN_SECRET=/d; /^TURN_HOST=/d' /opt/devices/.env
  { echo "TURN_SECRET=$SECRET"; echo "TURN_HOST=relay.zumpelars.de"; } >> /opt/devices/.env
  (cd /opt/devices && docker compose up -d 2>&1 | tail -1)
fi

docker network inspect relay_edge >/dev/null 2>&1 || docker network create relay_edge

cd /opt/pingvin
if ! grep -q 'relay.zumpelars.de' Caddyfile; then
  cp -a Caddyfile "Caddyfile.bak-$STAMP"
  { echo; cat /opt/relay-src/deploy/relay/Caddyfile.snippet; } >> Caddyfile
fi
if ! grep -q relay_edge docker-compose.yml; then
  cp -a docker-compose.yml "docker-compose.yml.bak-$STAMP"
  python3 - <<'PY'
p = '/opt/pingvin/docker-compose.yml'
s = open(p).read()
s = s.replace("networks: [netz, devices_edge]\n    depends_on: [pingvin]", "networks: [netz, devices_edge, relay_edge]\n    depends_on: [pingvin]")
s = s.replace("  devices_edge:\n    external: true\n", "  devices_edge:\n    external: true\n  relay_edge:\n    external: true\n")
open(p, 'w').write(s)
PY
  grep -q 'devices_edge, relay_edge' docker-compose.yml || { echo "compose edit failed — Caddy-Netze von Hand ergaenzen"; exit 1; }
fi

# Firewall: TURN braucht UDP/TCP 3478, TLS 5349 und den Relay-Bereich.
if command -v ufw >/dev/null && ufw status | grep -q 'Status: active'; then
  ufw allow 3478/udp; ufw allow 3478/tcp; ufw allow 5349/tcp; ufw allow 49160:49200/udp
else
  echo "HINWEIS: ufw ist nicht aktiv. Falls eine andere Firewall laeuft (auch im Lima-Panel):"
  echo "         3478/udp+tcp, 5349/tcp, 49160-49200/udp freigeben."
fi

# Zertifikat: Caddy holt es fuer relay.zumpelars.de, relay-deploy kopiert es
# fuer coturn. Taeglich pruefen, coturn nur bei neuem Zertifikat neu starten.
echo '17 4 * * * root /usr/local/bin/relay-deploy --certs >> /var/log/relay-deploy.log 2>&1' > /etc/cron.d/relay-certs

echo "Setup fertig. Weiter:"
echo "  1. DNS: A-Record relay.zumpelars.de -> $(ip -4 route get 1.1.1.1 | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}') (Lima-Panel)"
echo "  2. cd /opt/pingvin && docker compose up -d --force-recreate caddy   (Caddy ins neue Netz + neuer Block)"
echo "  3. relay-deploy"
