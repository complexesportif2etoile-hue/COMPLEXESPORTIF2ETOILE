#!/usr/bin/env bash
# =============================================================================
# list-clients.sh
# Liste tous les clients deployes et leur statut
# Usage: ./scripts/list-clients.sh
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CLIENTS_DIR="$PROJECT_ROOT/clients"

BOLD='\033[1m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo -e "${BOLD}Clients deployes${NC}"
echo "=============================="
echo ""

if [ ! -d "$CLIENTS_DIR" ] || [ -z "$(ls -A "$CLIENTS_DIR"/*.env 2>/dev/null)" ]; then
  echo "  Aucun client deploye."
  echo ""
  echo "  Lancez: ./scripts/deploy-new-client.sh"
  exit 0
fi

count=0
for env_file in "$CLIENTS_DIR"/*.env; do
  client_slug=$(basename "$env_file" .env)

  supabase_url=$(grep "VITE_SUPABASE_URL" "$env_file" | cut -d'=' -f2)
  netlify_url=$(grep "NETLIFY_SITE_URL" "$env_file" | cut -d'=' -f2 || echo "")
  created=$(stat -c %y "$env_file" 2>/dev/null || stat -f %Sm "$env_file" 2>/dev/null | cut -d' ' -f1)

  echo -e "  ${BOLD}${CYAN}${client_slug}${NC}"
  echo -e "    Supabase:   ${supabase_url}"
  if [ -n "$netlify_url" ]; then
    echo -e "    Netlify:    ${GREEN}${netlify_url}${NC}"
  else
    echo -e "    Netlify:    ${YELLOW}(non deploye)${NC}"
  fi
  echo -e "    Config:     clients/${client_slug}.env"
  echo ""

  ((count++)) || true
done

echo -e "  Total: ${BOLD}${count}${NC} client(s)"
echo ""
