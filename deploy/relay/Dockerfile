# Signaling-Relay fuer die Live-Zusammenarbeit (#869). Nur das eine Skript
# und `ws` — nicht die App: das Image bleibt klein, und auf dem Server liegt
# nichts, was Plaene kennt.
# Gebaut mit dem Repo-Stamm als Kontext: docker build -f deploy/relay/Dockerfile .
FROM node:24-alpine
WORKDIR /app
RUN npm init -y >/dev/null && npm install --omit=dev --no-audit --no-fund ws@8.21.0 && npm cache clean --force
COPY scripts/signaling-server.mjs ./
USER node
ENV PORT=4444 HOST=0.0.0.0 TRUST_PROXY=1
EXPOSE 4444
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "require('net').connect(4444,'127.0.0.1').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))"
CMD ["node", "signaling-server.mjs"]
