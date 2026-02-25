#!/usr/bin/env bash
# =============================================================================
# update-all-clients.sh
# Redeploie l'application sur TOUS les clients Netlify existants
# Usage: ./scripts/update-all-clients.sh
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CLIENTS_DIR="$PROJECT_ROOT/clients"

BOLD='\033[1m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo -e "${BOLD}Mise a jour de tous les clients${NC}"
echo "=============================="
echo ""

if [ ! -d "$CLIENTS_DIR" ] || [ -z "$(ls -A "$CLIENTS_DIR"/*.env 2>/dev/null)" ]; then
  echo "Aucun client trouve. Lancez d'abord deploy-new-client.sh"
  exit 0
fi

# Lister les clients avec Netlify configuré
clients_with_netlify=()
for env_file in "$CLIENTS_DIR"/*.env; do
  client_slug=$(basename "$env_file" .env)
  if grep -q "NETLIFY_SITE_ID" "$env_file" 2>/dev/null; then
    clients_with_netlify+=("$client_slug")
  fi
done

if [ ${#clients_with_netlify[@]} -eq 0 ]; then
  echo -e "${YELLOW}Aucun client avec deploiement Netlify configure.${NC}"
  echo "Lancez: ./scripts/deploy-netlify.sh <client-slug>"
  exit 0
fi

echo "Clients qui seront mis a jour:"
for client in "${clients_with_netlify[@]}"; do
  echo -e "  - ${CYAN}${client}${NC}"
done
echo ""

read -rp "Confirmer la mise a jour de ${#clients_with_netlify[@]} client(s) ? (oui/non): " CONFIRM
if [ "$CONFIRM" != "oui" ]; then
  echo "Annule."
  exit 0
fi

echo ""

success=0
failed=0

for client in "${clients_with_netlify[@]}"; do
  echo -e "${BOLD}>> Deploiement: ${CYAN}${client}${NC}"

  if "$SCRIPT_DIR/deploy-netlify.sh" "$client"; then
    echo -e "   ${GREEN}Succes${NC}"
    ((success++)) || true
  else
    echo -e "   ${RED}Echec${NC}"
    ((failed++)) || true
  fi
  echo ""
done

echo -e "${BOLD}Resultat: ${GREEN}${success} succes${NC}, ${RED}${failed} echecs${NC}"
echo ""
