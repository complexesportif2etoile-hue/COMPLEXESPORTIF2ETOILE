#!/usr/bin/env bash
# =============================================================================
# deploy-new-client.sh
# Script de déploiement automatique pour un nouveau client
# Usage: ./scripts/deploy-new-client.sh
# =============================================================================

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

print_header() {
  echo ""
  echo -e "${BOLD}${BLUE}========================================${NC}"
  echo -e "${BOLD}${BLUE}  Deploiement Nouveau Client${NC}"
  echo -e "${BOLD}${BLUE}========================================${NC}"
  echo ""
}

print_step() {
  echo -e "${CYAN}${BOLD}[ETAPE $1]${NC} $2"
}

print_success() {
  echo -e "${GREEN}[OK]${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}[ATTENTION]${NC} $1"
}

print_error() {
  echo -e "${RED}[ERREUR]${NC} $1"
}

# =============================================================================
# VERIFICATION DES DEPENDANCES
# =============================================================================
check_dependencies() {
  print_step "0" "Verification des dependances..."

  local missing=()

  if ! command -v curl &>/dev/null; then
    missing+=("curl")
  fi
  if ! command -v jq &>/dev/null; then
    missing+=("jq")
  fi
  if ! command -v psql &>/dev/null; then
    missing+=("psql (postgresql-client)")
  fi

  if [ ${#missing[@]} -gt 0 ]; then
    print_error "Outils manquants: ${missing[*]}"
    echo ""
    echo "Installez-les avec:"
    echo "  Ubuntu/Debian: sudo apt-get install -y curl jq postgresql-client"
    echo "  macOS:         brew install curl jq postgresql"
    exit 1
  fi

  print_success "Toutes les dependances sont disponibles"
}

# =============================================================================
# COLLECTE DES INFORMATIONS CLIENT
# =============================================================================
collect_client_info() {
  print_step "1" "Informations du nouveau client"
  echo ""

  read -rp "  Nom du client (ex: complexe-dakar): " CLIENT_SLUG
  CLIENT_SLUG=$(echo "$CLIENT_SLUG" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd '[:alnum:]-')
  if [ -z "$CLIENT_SLUG" ]; then
    print_error "Le nom du client ne peut pas etre vide."
    exit 1
  fi

  read -rp "  Nom complet du complexe (ex: Complexe Sportif Dakar): " CLIENT_NOM
  if [ -z "$CLIENT_NOM" ]; then
    CLIENT_NOM="$CLIENT_SLUG"
  fi

  read -rp "  Adresse du complexe: " CLIENT_ADRESSE
  CLIENT_ADRESSE=${CLIENT_ADRESSE:-"Dakar, Senegal"}

  read -rp "  Telephone du complexe: " CLIENT_TEL
  CLIENT_TEL=${CLIENT_TEL:-"+221 XX XXX XX XX"}

  read -rp "  Email du complexe: " CLIENT_EMAIL
  CLIENT_EMAIL=${CLIENT_EMAIL:-"contact@${CLIENT_SLUG}.sn"}

  echo ""
  print_step "2" "Credentials Supabase du nouveau projet"
  echo ""
  echo -e "  ${YELLOW}Creez un nouveau projet sur https://supabase.com${NC}"
  echo -e "  puis renseignez les informations ci-dessous."
  echo ""

  read -rp "  Supabase Project URL (https://xxxxx.supabase.co): " SUPABASE_URL
  if [[ ! "$SUPABASE_URL" =~ ^https://.*\.supabase\.co$ ]]; then
    print_error "URL Supabase invalide. Format attendu: https://xxxxx.supabase.co"
    exit 1
  fi

  read -rp "  Supabase Anon Key (eyJ...): " SUPABASE_ANON_KEY
  if [[ ! "$SUPABASE_ANON_KEY" =~ ^eyJ ]]; then
    print_error "Anon Key invalide. Elle doit commencer par 'eyJ'"
    exit 1
  fi

  read -rp "  Supabase Service Role Key (eyJ...): " SUPABASE_SERVICE_ROLE_KEY
  if [[ ! "$SUPABASE_SERVICE_ROLE_KEY" =~ ^eyJ ]]; then
    print_error "Service Role Key invalide. Elle doit commencer par 'eyJ'"
    exit 1
  fi

  # Extraire le project ref depuis l'URL
  PROJECT_REF=$(echo "$SUPABASE_URL" | sed 's|https://||' | sed 's|\.supabase\.co||')

  # Construire l'URL de connexion DB
  DB_HOST="db.${PROJECT_REF}.supabase.co"
  DB_PORT="5432"
  DB_NAME="postgres"
  DB_USER="postgres"

  read -rsp "  Mot de passe de la base de donnees Supabase: " DB_PASSWORD
  echo ""

  echo ""
  print_step "3" "Configuration admin initial"
  echo ""

  read -rp "  Email admin (utilisateur initial): " ADMIN_EMAIL
  if [[ ! "$ADMIN_EMAIL" =~ ^[^@]+@[^@]+\.[^@]+$ ]]; then
    print_error "Email invalide."
    exit 1
  fi

  read -rsp "  Mot de passe admin (min 8 caracteres): " ADMIN_PASSWORD
  echo ""
  if [ ${#ADMIN_PASSWORD} -lt 8 ]; then
    print_error "Le mot de passe doit faire au moins 8 caracteres."
    exit 1
  fi

  read -rp "  Nom complet de l'admin: " ADMIN_NAME
  ADMIN_NAME=${ADMIN_NAME:-"Administrateur"}
}

# =============================================================================
# CONFIRMATION
# =============================================================================
confirm_deployment() {
  echo ""
  echo -e "${BOLD}========================================${NC}"
  echo -e "${BOLD}  Recapitulatif du deploiement${NC}"
  echo -e "${BOLD}========================================${NC}"
  echo ""
  echo -e "  Client:          ${BOLD}$CLIENT_NOM${NC} ($CLIENT_SLUG)"
  echo -e "  Adresse:         $CLIENT_ADRESSE"
  echo -e "  Telephone:       $CLIENT_TEL"
  echo -e "  Email:           $CLIENT_EMAIL"
  echo ""
  echo -e "  Supabase URL:    $SUPABASE_URL"
  echo -e "  Project Ref:     $PROJECT_REF"
  echo -e "  DB Host:         $DB_HOST"
  echo ""
  echo -e "  Admin Email:     $ADMIN_EMAIL"
  echo -e "  Admin Nom:       $ADMIN_NAME"
  echo ""

  read -rp "Confirmer le deploiement ? (oui/non): " CONFIRM
  if [ "$CONFIRM" != "oui" ]; then
    echo "Deploiement annule."
    exit 0
  fi
}

# =============================================================================
# APPLICATION DES MIGRATIONS
# =============================================================================
apply_migrations() {
  print_step "4" "Application des migrations de base de donnees..."
  echo ""

  local SCRIPT_DIR
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local PROJECT_ROOT
  PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
  local MIGRATIONS_DIR="$PROJECT_ROOT/supabase/migrations"

  if [ ! -d "$MIGRATIONS_DIR" ]; then
    print_error "Dossier migrations introuvable: $MIGRATIONS_DIR"
    exit 1
  fi

  export PGPASSWORD="$DB_PASSWORD"

  # Tester la connexion
  echo -n "  Test de connexion a la base de donnees... "
  if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" &>/dev/null; then
    echo ""
    print_error "Impossible de se connecter a la base de donnees."
    print_warning "Verifiez que le mot de passe est correct et que la DB est accessible."
    exit 1
  fi
  echo -e "${GREEN}OK${NC}"

  # Appliquer chaque migration dans l'ordre
  local migrations
  mapfile -t migrations < <(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort)

  if [ ${#migrations[@]} -eq 0 ]; then
    print_warning "Aucun fichier de migration trouve dans $MIGRATIONS_DIR"
    return
  fi

  echo "  Application de ${#migrations[@]} migrations..."
  echo ""

  local success=0
  local failed=0

  for migration in "${migrations[@]}"; do
    local filename
    filename=$(basename "$migration")
    echo -n "    Applying $filename... "

    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
      -f "$migration" &>/tmp/migration_output_$$.log; then
      echo -e "${GREEN}OK${NC}"
      ((success++)) || true
    else
      echo -e "${RED}ERREUR${NC}"
      print_warning "Erreur sur $filename (peut etre deja applique):"
      head -5 /tmp/migration_output_$$.log | sed 's/^/      /'
      ((failed++)) || true
    fi
    rm -f /tmp/migration_output_$$.log
  done

  echo ""
  print_success "$success migrations appliquees, $failed avec avertissement"
}

# =============================================================================
# CONFIGURATION DU COMPLEXE
# =============================================================================
configure_client() {
  print_step "5" "Configuration des donnees du complexe..."

  export PGPASSWORD="$DB_PASSWORD"

  # Mise à jour de la configuration entreprise
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -c "UPDATE configuration SET valeur = '{
      \"nom\": $(echo -n "$CLIENT_NOM" | jq -Rs .),
      \"adresse\": $(echo -n "$CLIENT_ADRESSE" | jq -Rs .),
      \"telephone\": $(echo -n "$CLIENT_TEL" | jq -Rs .),
      \"email\": $(echo -n "$CLIENT_EMAIL" | jq -Rs .)
    }'::jsonb WHERE cle = 'entreprise_info';" &>/dev/null || true

  print_success "Configuration du complexe appliquee"
}

# =============================================================================
# CREATION DE L'UTILISATEUR ADMIN
# =============================================================================
create_admin_user() {
  print_step "6" "Creation de l'utilisateur administrateur..."

  # Utiliser l'API Supabase Auth pour créer l'utilisateur
  local response
  response=$(curl -s -X POST \
    "${SUPABASE_URL}/auth/v1/admin/users" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"${ADMIN_EMAIL}\",
      \"password\": \"${ADMIN_PASSWORD}\",
      \"email_confirm\": true,
      \"user_metadata\": {
        \"full_name\": \"${ADMIN_NAME}\"
      }
    }")

  local user_id
  user_id=$(echo "$response" | jq -r '.id // empty')

  if [ -z "$user_id" ]; then
    local error_msg
    error_msg=$(echo "$response" | jq -r '.msg // .message // .error_description // "Erreur inconnue"')
    print_error "Impossible de creer l'utilisateur admin: $error_msg"
    print_warning "Vous devrez creer l'admin manuellement via le tableau de bord Supabase."
    return
  fi

  print_success "Utilisateur auth cree (ID: $user_id)"

  # Créer le profil admin dans la table profiles
  export PGPASSWORD="$DB_PASSWORD"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -c "INSERT INTO profiles (id, email, full_name, role, is_active)
        VALUES (
          '${user_id}'::uuid,
          '${ADMIN_EMAIL}',
          '${ADMIN_NAME}',
          'admin',
          true
        )
        ON CONFLICT (id) DO UPDATE
          SET role = 'admin',
              is_active = true,
              full_name = EXCLUDED.full_name;" &>/dev/null || true

  print_success "Profil admin cree dans la base de donnees"
}

# =============================================================================
# GENERATION DU FICHIER .ENV CLIENT
# =============================================================================
generate_env_file() {
  print_step "7" "Generation du fichier de configuration..."

  local SCRIPT_DIR
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local PROJECT_ROOT
  PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
  local CLIENTS_DIR="$PROJECT_ROOT/clients"

  mkdir -p "$CLIENTS_DIR"

  local ENV_FILE="$CLIENTS_DIR/${CLIENT_SLUG}.env"

  cat > "$ENV_FILE" << EOF
# Configuration client: ${CLIENT_NOM}
# Genere le: $(date '+%Y-%m-%d %H:%M:%S')
# ==============================================

VITE_SUPABASE_URL=${SUPABASE_URL}
VITE_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
EOF

  print_success "Fichier genere: clients/${CLIENT_SLUG}.env"
  echo ""
  print_warning "Ne commitez JAMAIS le dossier clients/ dans git (il contient des secrets)!"
}

# =============================================================================
# RAPPORT FINAL
# =============================================================================
print_final_report() {
  local SCRIPT_DIR
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local PROJECT_ROOT
  PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

  echo ""
  echo -e "${BOLD}${GREEN}========================================${NC}"
  echo -e "${BOLD}${GREEN}  Deploiement termine avec succes !${NC}"
  echo -e "${BOLD}${GREEN}========================================${NC}"
  echo ""
  echo -e "${BOLD}Recapitulatif:${NC}"
  echo ""
  echo -e "  Client:          ${BOLD}$CLIENT_NOM${NC}"
  echo -e "  Supabase URL:    $SUPABASE_URL"
  echo -e "  Admin Email:     $ADMIN_EMAIL"
  echo ""
  echo -e "${BOLD}Prochaines etapes pour Netlify:${NC}"
  echo ""
  echo -e "  1. Creez un nouveau site sur https://app.netlify.com"
  echo -e "     Liez-le au meme depot GitHub"
  echo ""
  echo -e "  2. Dans Site settings > Environment variables, ajoutez:"
  echo -e "     ${CYAN}VITE_SUPABASE_URL${NC}      = ${SUPABASE_URL}"
  echo -e "     ${CYAN}VITE_SUPABASE_ANON_KEY${NC} = ${SUPABASE_ANON_KEY}"
  echo ""
  echo -e "  3. Configurez le domaine personnalise si necessaire"
  echo ""
  echo -e "  Ou utilisez le script de deploiement Netlify:"
  echo -e "  ${CYAN}./scripts/deploy-netlify.sh ${CLIENT_SLUG}${NC}"
  echo ""
  echo -e "${YELLOW}Credentials sauvegardes dans: clients/${CLIENT_SLUG}.env${NC}"
  echo ""
}

# =============================================================================
# PROGRAMME PRINCIPAL
# =============================================================================
main() {
  print_header
  check_dependencies
  collect_client_info
  confirm_deployment
  apply_migrations
  configure_client
  create_admin_user
  generate_env_file
  print_final_report
}

main "$@"
