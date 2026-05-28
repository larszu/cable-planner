#!/usr/bin/env bash
# cleanup-old-releases.sh
#
# Löscht alle Cable-Planner GitHub-Releases + Tags AUSSER:
#   v8.0.8, v8.0.9, v8.0.10, v8.0.11, v8.1.0
#
# Voraussetzungen:
#   - gh CLI installiert + eingeloggt (`gh auth login`)
#   - Schreibrechte auf larszu/cable-planner
#   - Im Zweifel erst trockenlaufen via DRY_RUN=1
#
# Aufruf:
#   DRY_RUN=1 ./scripts/cleanup-old-releases.sh   # nur anzeigen
#   ./scripts/cleanup-old-releases.sh             # tatsaechlich loeschen

set -euo pipefail

REPO="larszu/cable-planner"
KEEP=("v8.0.8" "v8.0.9" "v8.0.10" "v8.0.11" "v8.1.0")
DRY_RUN="${DRY_RUN:-0}"

# Sanity-Check: gh + auth + repo zugreifbar
command -v gh >/dev/null || { echo "FEHLER: gh CLI nicht installiert" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "FEHLER: gh nicht eingeloggt — gh auth login" >&2; exit 1; }
gh repo view "$REPO" >/dev/null 2>&1 || { echo "FEHLER: Zugriff auf $REPO nicht moeglich" >&2; exit 1; }

is_keep() {
  local t="$1"
  for k in "${KEEP[@]}"; do [[ "$t" == "$k" ]] && return 0; done
  return 1
}

# 1) Releases loeschen (gh release delete loescht auch die Asset-Files,
#    laesst aber den Tag stehen — den raeumen wir in Schritt 2 auf).
echo "=== Schritt 1: alte Releases loeschen ==="
mapfile -t ALL_RELEASES < <(gh release list --repo "$REPO" --limit 200 --json tagName --jq '.[].tagName')
echo "Gefundene Releases: ${#ALL_RELEASES[@]}"

del_count=0
for tag in "${ALL_RELEASES[@]}"; do
  if is_keep "$tag"; then
    echo "  KEEP   $tag"
    continue
  fi
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "  DRY    delete release $tag"
  else
    echo "  DELETE release $tag"
    gh release delete "$tag" --repo "$REPO" --yes >/dev/null 2>&1 || \
      echo "    (release $tag konnte nicht geloescht werden)"
  fi
  del_count=$((del_count + 1))
done
echo "Releases zu loeschen: $del_count"
echo

# 2) Tags auf Remote loeschen (lokale Tags sind via diesem Repo-Clone
#    schon weg, falls du den cable-planner Workspace nutzt).
echo "=== Schritt 2: alte Tags vom Remote loeschen ==="
mapfile -t ALL_TAGS < <(gh api -X GET "repos/$REPO/tags?per_page=100" --paginate --jq '.[].name')
echo "Gefundene Tags: ${#ALL_TAGS[@]}"

del_tags=0
for tag in "${ALL_TAGS[@]}"; do
  if is_keep "$tag"; then
    echo "  KEEP   $tag"
    continue
  fi
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "  DRY    delete tag $tag"
  else
    echo "  DELETE tag $tag"
    gh api -X DELETE "repos/$REPO/git/refs/tags/$tag" >/dev/null 2>&1 || \
      echo "    (tag $tag konnte nicht geloescht werden)"
  fi
  del_tags=$((del_tags + 1))
done
echo "Tags zu loeschen: $del_tags"
echo

if [[ "$DRY_RUN" == "1" ]]; then
  echo "DRY_RUN — nichts wurde tatsaechlich geloescht."
  echo "Zum scharfschalten:   ./scripts/cleanup-old-releases.sh"
else
  echo "Fertig. Verbleibend sollten nur ${KEEP[*]} sein."
fi
