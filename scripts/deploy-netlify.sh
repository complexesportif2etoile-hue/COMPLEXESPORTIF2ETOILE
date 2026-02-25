#!/usr/bin/env bash
# =============================================================================
# deploy-netlify.sh
# Deploie l'application sur un nouveau site Netlify pour un client existant
# Usage: ./scripts/deploy-netlify.sh <client-slug>
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

print_header() {
  echo ""
  echo -e "${BOLD}${BLUE}========================================${NC}"
  echo -e "${BOLD}${BLUE}  Deploiement Netlify${NC}"
  echo -e "${BOLD}${BLUE}========================================${NC}"
  echo ""
}

print_step() {
  echo -e "${CYAN}${BOLD}[ETAPE $1]${NC} $2"
}

print_success() {
  echo -e "${GREEN}[OK]${NC} $1"
}

print_error() {
  echo -e "${RED}[ERREUR]${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}[ATTENTION]${NC} $1"
}

# =============================================================================
# VERIFICATION
# =============================================================================
check_dependencies() {
  local missing=()
  if ! command -v curl &>/dev/null; then missing+=("curl"); fi
  if ! command -v jq &>/dev/null; then missing+=("jq"); fi
  if ! command -v zip &>/dev/null; then missing+=("zip"); fi
  if ! command -v node &>/dev/null; then missing+=("node"); fi
  if ! command -v npm &>/dev/null; then missing+=("npm"); fi

  if [ ${#missing[@]} -gt 0 ]; then
    print_error "Outils manquants: ${missing[*]}"
    exit 1
  fi
}

# =============================================================================
# CHARGEMENT CONFIG CLIENT
# =============================================================================
load_client_config() {
  local CLIENT_SLUG="$1"
  local ENV_FILE="$PROJECT_ROOT/clients/${CLIENT_SLUG}.env"

  if [ ! -f "$ENV_FILE" ]; then
    print_error "Fichier de configuration introuvable: clients/${CLIENT_SLUG}.env"
    echo ""
    echo "Clients disponibles:"
    ls "$PROJECT_ROOT/clients/"*.env 2>/dev/null | xargs -I{} basename {} .env | sed 's/^/  - /' || echo "  (aucun)"
    exit 1
  fi

  # Charger les variables
  set -a
  source "$ENV_FILE"
  set +a

  print_success "Configuration chargee pour: $CLIENT_SLUG"
}

# =============================================================================
# COLLECTE DU TOKEN NETLIFY
# =============================================================================
get_netlify_token() {
  print_step "1" "Token Netlify"
  echo ""

  if [ -n "$NETLIFY_AUTH_TOKEN" ]; then
    print_success "Token Netlify trouve dans l'environnement"
    return
  fi

  echo -e "  Obtenez votre token sur: ${CYAN}https://app.netlify.com/user/applications/personal${NC}"
  echo ""
  read -rsp "  Token Netlify (Personal access token): " NETLIFY_AUTH_TOKEN
  echo ""

  if [ -z "$NETLIFY_AUTH_TOKEN" ]; then
    print_error "Token Netlify requis."
    exit 1
  fi
}

# =============================================================================
# COMPILATION DU PROJET
# =============================================================================
build_project() {
  print_step "2" "Compilation du projet..."

  cd "$PROJECT_ROOT"

  # Injecter les variables d'environnement pour le build
  export VITE_SUPABASE_URL
  export VITE_SUPABASE_ANON_KEY

  echo "  Installation des dependances..."
  npm ci --silent

  echo "  Build en cours..."
  npm run build

  print_success "Build termine dans le dossier dist/"
}

# =============================================================================
# CREATION DU SITE NETLIFY
# =============================================================================
create_netlify_site() {
  local CLIENT_SLUG="$1"

  print_step "3" "Creation du site Netlify..."

  local response
  response=$(curl -s -X POST \
    "https://api.netlify.com/api/v1/sites" \
    -H "Authorization: Bearer ${NETLIFY_AUTH_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"terrain-${CLIENT_SLUG}\",
      \"custom_domain\": null
    }")

  NETLIFY_SITE_ID=$(echo "$response" | jq -r '.id // empty')
  NETLIFY_SITE_URL=$(echo "$response" | jq -r '.ssl_url // .url // empty')
  NETLIFY_SITE_NAME=$(echo "$response" | jq -r '.name // empty')

  if [ -z "$NETLIFY_SITE_ID" ]; then
    local error
    error=$(echo "$response" | jq -r '.message // .error // "Erreur inconnue"')
    print_error "Impossible de creer le site Netlify: $error"

    # Essayer de trouver un site existant
    echo "  Recherche d'un site existant avec ce nom..."
    local sites
    sites=$(curl -s \
      "https://api.netlify.com/api/v1/sites?filter=all" \
      -H "Authorization: Bearer ${NETLIFY_AUTH_TOKEN}")

    NETLIFY_SITE_ID=$(echo "$sites" | jq -r ".[] | select(.name == \"terrain-${CLIENT_SLUG}\") | .id" | head -1)

    if [ -n "$NETLIFY_SITE_ID" ]; then
      NETLIFY_SITE_URL=$(echo "$sites" | jq -r ".[] | select(.id == \"${NETLIFY_SITE_ID}\") | .ssl_url")
      NETLIFY_SITE_NAME="terrain-${CLIENT_SLUG}"
      print_warning "Site existant trouve, mise a jour en cours..."
    else
      exit 1
    fi
  fi

  print_success "Site Netlify: $NETLIFY_SITE_NAME ($NETLIFY_SITE_URL)"
}

# =============================================================================
# CONFIGURATION DES VARIABLES D'ENVIRONNEMENT NETLIFY
# =============================================================================
set_netlify_env_vars() {
  print_step "4" "Configuration des variables d'environnement Netlify..."

  curl -s -X PUT \
    "https://api.netlify.com/api/v1/sites/${NETLIFY_SITE_ID}/env" \
    -H "Authorization: Bearer ${NETLIFY_AUTH_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"VITE_SUPABASE_URL\": \"${VITE_SUPABASE_URL}\",
      \"VITE_SUPABASE_ANON_KEY\": \"${VITE_SUPABASE_ANON_KEY}\"
    }" &>/dev/null || true

  print_success "Variables d'environnement configurees"
}

# =============================================================================
# DEPLOIEMENT DU BUILD
# =============================================================================
deploy_build() {
  print_step "5" "Deploiement du build..."

  local DIST_DIR="$PROJECT_ROOT/dist"

  if [ ! -d "$DIST_DIR" ]; then
    print_error "Dossier dist/ introuvable. Le build a-t-il reussi ?"
    exit 1
  fi

  # Créer une archive zip du build
  local ZIP_FILE="/tmp/netlify-deploy-$$.zip"
  cd "$DIST_DIR"
  zip -r "$ZIP_FILE" . -x "*.DS_Store" &>/dev/null
  cd "$PROJECT_ROOT"

  # Déployer via l'API Netlify
  local response
  response=$(curl -s -X POST \
    "https://api.netlify.com/api/v1/sites/${NETLIFY_SITE_ID}/deploys" \
    -H "Authorization: Bearer ${NETLIFY_AUTH_TOKEN}" \
    -H "Content-Type: application/zip" \
    --data-binary "@${ZIP_FILE}")

  rm -f "$ZIP_FILE"

  local deploy_id
  deploy_id=$(echo "$response" | jq -r '.id // empty')
  local deploy_url
  deploy_url=$(echo "$response" | jq -r '.deploy_ssl_url // .ssl_url // empty')

  if [ -z "$deploy_id" ]; then
    local error
    error=$(echo "$response" | jq -r '.message // "Erreur inconnue"')
    print_error "Deploiement echoue: $error"
    exit 1
  fi

  # Attendre que le deploiement soit pret
  echo -n "  Attente du deploiement"
  local max_attempts=30
  local attempt=0
  local state=""

  while [ $attempt -lt $max_attempts ]; do
    sleep 3
    state=$(curl -s \
      "https://api.netlify.com/api/v1/sites/${NETLIFY_SITE_ID}/deploys/${deploy_id}" \
      -H "Authorization: Bearer ${NETLIFY_AUTH_TOKEN}" | jq -r '.state // "unknown"')

    if [ "$state" = "ready" ]; then
      echo ""
      break
    elif [ "$state" = "error" ]; then
      echo ""
      print_error "Le deploiement a echoue (state: error)"
      exit 1
    fi

    echo -n "."
    ((attempt++)) || true
  done

  if [ "$state" != "ready" ]; then
    echo ""
    print_warning "Timeout - le deploiement est peut-etre encore en cours"
  fi

  DEPLOY_URL="${deploy_url:-$NETLIFY_SITE_URL}"
  print_success "Deploiement effectue!"
}

# =============================================================================
# MISE A JOUR DU FICHIER CLIENT
# =============================================================================
update_client_config() {
  local CLIENT_SLUG="$1"
  local ENV_FILE="$PROJECT_ROOT/clients/${CLIENT_SLUG}.env"

  # Ajouter l'URL Netlify au fichier client si absente
  if ! grep -q "NETLIFY_SITE_URL" "$ENV_FILE" 2>/dev/null; then
    echo "" >> "$ENV_FILE"
    echo "# Deploiement Netlify" >> "$ENV_FILE"
    echo "NETLIFY_SITE_ID=${NETLIFY_SITE_ID}" >> "$ENV_FILE"
    echo "NETLIFY_SITE_NAME=${NETLIFY_SITE_NAME}" >> "$ENV_FILE"
    echo "NETLIFY_SITE_URL=${NETLIFY_SITE_URL}" >> "$ENV_FILE"
    print_success "Informations Netlify sauvegardees dans clients/${CLIENT_SLUG}.env"
  fi
}

# =============================================================================
# RAPPORT FINAL
# =============================================================================
print_final_report() {
  local CLIENT_SLUG="$1"

  echo ""
  echo -e "${BOLD}${GREEN}========================================${NC}"
  echo -e "${BOLD}${GREEN}  Deploiement Netlify termine !${NC}"
  echo -e "${BOLD}${GREEN}========================================${NC}"
  echo ""
  echo -e "  Client:     ${BOLD}${CLIENT_SLUG}${NC}"
  echo -e "  Site:       ${CYAN}${NETLIFY_SITE_URL}${NC}"
  echo -e "  Supabase:   ${VITE_SUPABASE_URL}"
  echo ""
  echo -e "  Pour deployer une mise a jour du code:"
  echo -e "  ${CYAN}./scripts/deploy-netlify.sh ${CLIENT_SLUG}${NC}"
  echo ""
}

# =============================================================================
# PROGRAMME PRINCIPAL
# =============================================================================
main() {
  print_header

  local CLIENT_SLUG="$1"

  if [ -z "$CLIENT_SLUG" ]; then
    echo "Usage: $0 <client-slug>"
    echo ""
    echo "Clients disponibles:"
    ls "$PROJECT_ROOT/clients/"*.env 2>/dev/null | xargs -I{} basename {} .env | sed 's/^/  - /' || echo "  (aucun - lancez d'abord deploy-new-client.sh)"
    exit 1
  fi

  check_dependencies
  load_client_config "$CLIENT_SLUG"
  get_netlify_token
  build_project
  create_netlify_site "$CLIENT_SLUG"
  set_netlify_env_vars
  deploy_build
  update_client_config "$CLIENT_SLUG"
  print_final_report "$CLIENT_SLUG"
}

main "$@"
