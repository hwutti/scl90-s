#!/usr/bin/env bash
# =============================================================================
# KDS – Klinisches Dokumentationssystem – Automatisches Installationsskript
# Ubuntu 22.04 / 24.04 LTS
# =============================================================================
set -euo pipefail

LOG_FILE="/var/log/kds-install.log"
exec > >(tee -a "$LOG_FILE") 2>&1

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; echo "[ERROR] $*" >> "$LOG_FILE"; exit 1; }
step()    { echo -e "\n${BOLD}═══ $* ═══${NC}"; }

[[ $EUID -ne 0 ]] && error "Bitte als root ausführen: sudo bash install.sh"

UBUNTU_VERSION=$(lsb_release -rs 2>/dev/null || echo "0")
if [[ "$UBUNTU_VERSION" != "22.04" && "$UBUNTU_VERSION" != "24.04" ]]; then
  warn "Getestet auf Ubuntu 22.04/24.04. Aktuelle Version: $UBUNTU_VERSION"
  read -rp "Trotzdem fortfahren? [j/N] " CONTINUE </dev/tty
  [[ "${CONTINUE,,}" != "j" ]] && exit 0
fi

# =============================================================================
APP_NAME="kds"
APP_USER="kds"
APP_DIR="/opt/kds"
APP_PORT="3000"
DOMAIN=""
DB_NAME="kds_db"
DB_USER="kds_user"
DB_PASS=""
BACKUP_DIR="/var/backups/kds"
BACKUP_KEEP_DAYS="30"
NEXTAUTH_SECRET=""
# =============================================================================

echo ""
echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║   KDS – Klinisches Dokumentationssystem         ║"
echo "  ║   Installation – $(date '+%d.%m.%Y %H:%M')               ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

step "Konfiguration"

# ── Idempotenz: bestehende .env einlesen ──────────────────────────────────────
if [[ -f "$APP_DIR/.env" ]]; then
  info "Bestehende .env gefunden – Werte werden wiederverwendet"
  DB_PASS_EXISTING=$(grep "^DATABASE_URL=" "$APP_DIR/.env" 2>/dev/null | sed 's/.*:\(.*\)@.*/\1/' || echo "")
  NEXTAUTH_SECRET_EXISTING=$(grep "^NEXTAUTH_SECRET=" "$APP_DIR/.env" 2>/dev/null | cut -d= -f2 || echo "")
  [[ -n "$DB_PASS_EXISTING" ]] && DB_PASS="$DB_PASS_EXISTING"
  [[ -n "$NEXTAUTH_SECRET_EXISTING" ]] && NEXTAUTH_SECRET="$NEXTAUTH_SECRET_EXISTING"
fi

if [[ -z "$DOMAIN" ]]; then
  read -rp "Domain (z.B. kds.meinserver.at) oder leer für IP-only: " DOMAIN </dev/tty
fi

if [[ -z "$DB_PASS" ]]; then
  DB_PASS=$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 24)
  info "Neues Datenbankpasswort generiert"
fi

if [[ -z "$NEXTAUTH_SECRET" ]]; then
  NEXTAUTH_SECRET=$(openssl rand -base64 48)
fi

# =============================================================================
step "System-Pakete installieren"
apt-get update -qq
apt-get install -y -qq curl wget gnupg2 lsb-release ca-certificates \
  software-properties-common apt-transport-https \
  nginx postgresql postgresql-contrib \
  python3 python3-pip openssl git unzip unrar

# =============================================================================
step "Node.js 22 installieren"
if ! node --version 2>/dev/null | grep -q "^v22"; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
node --version
npm install -g pnpm@9
pnpm --version

# =============================================================================
step "PostgreSQL konfigurieren"

systemctl enable postgresql
systemctl start postgresql
sleep 2

# User anlegen oder Passwort aktualisieren
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
  info "DB-User $DB_USER existiert – Passwort aktualisieren"
  sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';" \
    || error "Konnte Passwort für $DB_USER nicht setzen"
else
  info "DB-User $DB_USER anlegen"
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS' CREATEDB;" \
    || error "Konnte $DB_USER nicht anlegen"
fi

# Datenbank anlegen wenn nicht vorhanden
if sudo -u postgres psql -lqt | cut -d\| -f1 | grep -qw "$DB_NAME"; then
  info "Datenbank $DB_NAME existiert bereits"
else
  info "Datenbank $DB_NAME anlegen"
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" \
    || error "Konnte $DB_NAME nicht anlegen"
fi

# Rechte setzen
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;"
sudo -u postgres psql -d "$DB_NAME" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;"
sudo -u postgres psql -d "$DB_NAME" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;"

# Verbindung aktiv prüfen
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
info "Teste Datenbankverbindung..."
if ! PGPASSWORD="$DB_PASS" psql -U "$DB_USER" -h localhost -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
  error "Datenbankverbindung fehlgeschlagen! Bitte PostgreSQL-Konfiguration prüfen."
fi
success "Datenbankverbindung erfolgreich"

# =============================================================================
step "Anwendungsverzeichnis vorbereiten"

if [[ ! -d "$APP_DIR" ]]; then
  git clone https://github.com/hwutti/scl90-s.git "$APP_DIR"
else
  info "Verzeichnis $APP_DIR existiert – git pull"
  cd "$APP_DIR" && git pull
fi

# System-User
if ! id "$APP_USER" &>/dev/null; then
  useradd --system --home "$APP_DIR" --shell /bin/bash "$APP_USER"
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# =============================================================================
step ".env Datei erstellen"

APP_URL="${DOMAIN:+https://$DOMAIN}"
APP_URL="${APP_URL:-http://localhost:$APP_PORT}"

cat > "$APP_DIR/.env" << ENV_EOF
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}
NEXTAUTH_URL=${APP_URL}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
NODE_ENV=production
JITSI_BASE_URL=https://meet.jit.si
ENV_EOF

chmod 600 "$APP_DIR/.env"
chown "$APP_USER:$APP_USER" "$APP_DIR/.env"
success ".env erstellt"

# =============================================================================
step "Node-Abhängigkeiten installieren"
cd "$APP_DIR"

# pnpm-lock.yaml prüfen
if [[ ! -f "pnpm-lock.yaml" ]]; then
  warn "pnpm-lock.yaml fehlt – führe pnpm install aus (ohne )"
  sudo -u "$APP_USER" bash -c "cd $APP_DIR && pnpm install --no-frozen-lockfile" \
    || error "pnpm install fehlgeschlagen"
else
  info "pnpm-lock.yaml vorhanden – nutze "
  sudo -u "$APP_USER" bash -c "cd $APP_DIR && pnpm install " \
    || error "pnpm install  fehlgeschlagen"
fi
success "Abhängigkeiten installiert"

# =============================================================================
step "Prisma Schema anwenden"
cd "$APP_DIR"

info "Prisma validate..."
sudo -u "$APP_USER" bash -c "
  set -a; source $APP_DIR/.env; set +a
  cd $APP_DIR
  export DATABASE_URL='postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}'
  npx prisma validate
" || error "Prisma validate fehlgeschlagen"
success "Prisma Schema valide"

info "Prisma generate..."
sudo -u "$APP_USER" bash -c "
  set -a; source $APP_DIR/.env; set +a
  cd $APP_DIR
  npx prisma generate
" || error "Prisma generate fehlgeschlagen"
success "Prisma Client generiert"

info "Prisma db push..."
sudo -u "$APP_USER" bash -c "
  set -a; source $APP_DIR/.env; set +a
  cd $APP_DIR
  export DATABASE_URL='postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}'
  npx prisma db push --accept-data-loss
" || error "Prisma db push fehlgeschlagen"
success "Datenbank-Schema angewendet"

# Prüfen ob zentrale Tabellen existieren
info "Prüfe ob zentrale Tabellen existieren..."
for TABLE in User Patient TherapySession Transaction; do
  if PGPASSWORD="$DB_PASS" psql -U "$DB_USER" -h localhost -d "$DB_NAME" \
      -c "\dt" 2>/dev/null | grep -qi "\"$TABLE\""; then
    success "Tabelle $TABLE vorhanden"
  else
    warn "Tabelle $TABLE nicht gefunden – Schema möglicherweise unvollständig"
  fi
done

# =============================================================================
step "Seed: Basisdaten anlegen"

info "Prüfe ob User-Tabelle existiert..."
if ! PGPASSWORD="$DB_PASS" psql -U "$DB_USER" -h localhost -d "$DB_NAME" \
    -c "SELECT COUNT(*) FROM \"User\";" > /dev/null 2>&1; then
  error "User-Tabelle nicht vorhanden – Prisma db push war nicht erfolgreich!"
fi

info "Seed ausführen..."
sudo -u "$APP_USER" bash -c "
  set -a; source $APP_DIR/.env; set +a
  cd $APP_DIR
  export DATABASE_URL='postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}'
  npx tsx prisma/seed.ts
" || error "Seed fehlgeschlagen – Installation abgebrochen"
success "Seed erfolgreich"

# =============================================================================
step "Next.js Build"
info "Starte Build (kann 2-5 Minuten dauern)..."
sudo -u "$APP_USER" bash -c "
  set -a; source $APP_DIR/.env; set +a
  cd $APP_DIR
  export DATABASE_URL='postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}'
  pnpm build
" || error "Build fehlgeschlagen"
success "Build erfolgreich"

# =============================================================================
step "systemd Service einrichten"

cat > /etc/systemd/system/kds.service << SERVICE_EOF
[Unit]
Description=KDS – Klinisches Dokumentationssystem
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
Environment=LANG=C.UTF-8
Environment=LC_ALL=C.UTF-8
ExecStart=/usr/local/bin/pnpm start
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=kds

[Install]
WantedBy=multi-user.target
SERVICE_EOF

systemctl daemon-reload
systemctl enable kds
systemctl restart kds

# Healthcheck mit Retry
info "Warte auf Service-Start..."
HEALTHY=false
for i in $(seq 1 30); do
  sleep 2
  if curl -sf "http://127.0.0.1:$APP_PORT" > /dev/null 2>&1; then
    HEALTHY=true
    break
  fi
  echo -n "."
done
echo ""

if [[ "$HEALTHY" != "true" ]]; then
  warn "Service antwortet nicht auf Port $APP_PORT – Journal:"
  journalctl -u kds -n 30 --no-pager
  error "Healthcheck fehlgeschlagen. Bitte Log prüfen: journalctl -u kds -f"
fi
success "Service läuft und antwortet auf Port $APP_PORT"

# =============================================================================
step "Nginx konfigurieren"

NGINX_CONF="/etc/nginx/sites-available/kds"
cat > "$NGINX_CONF" << NGINX_EOF
server {
    listen 80;
    server_name ${DOMAIN:-_};

    location /_next/static/ {
        alias $APP_DIR/.next/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_cache_bypass \$http_upgrade;
        client_max_body_size 50M;
    }
}
NGINX_EOF

ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/kds
rm -f /etc/nginx/sites-enabled/default

nginx -t || error "Nginx Konfiguration ungültig"
systemctl enable nginx
systemctl reload nginx
success "Nginx konfiguriert und neu geladen"

# =============================================================================
step "Backup einrichten"
mkdir -p "$BACKUP_DIR"
# Verzeichnis wird sowohl vom Cron-Job (User postgres) als auch vom manuellen
# "Backup erstellen"-Button in der Web-UI (läuft als User $APP_USER) beschrieben.
# Gemeinsame Gruppe mit Schreibrecht + Setgid, damit beide Seiten unabhängig
# voneinander Dateien anlegen können (sonst: EACCES beim manuellen Backup).
groupadd -f kds-backup
usermod -aG kds-backup "$APP_USER"
usermod -aG kds-backup postgres
chgrp kds-backup "$BACKUP_DIR"
chmod 2775 "$BACKUP_DIR"

cat > /etc/cron.d/kds-backup << CRON_EOF
0 2 * * * postgres pg_dump $DB_NAME | gzip > $BACKUP_DIR/kds_\$(date +\%Y\%m\%d_\%H\%M).sql.gz && find $BACKUP_DIR -name "*.sql.gz" -mtime +$BACKUP_KEEP_DAYS -delete
CRON_EOF

# =============================================================================
step "Update-Skript erstellen"

cat > "$APP_DIR/update.sh" << 'UPDATE_EOF'
#!/usr/bin/env bash
set -euo pipefail
APP_DIR="/opt/kds"
APP_USER="kds"

RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
step()    { echo -e "\n${BOLD}▶ $*${NC}"; }
success() { echo -e "${GREEN}✓ $*${NC}"; }
error()   { echo -e "${RED}✗ $*${NC}"; exit 1; }

cd "$APP_DIR"

step "Git Pull"
git pull origin main
COMMIT=$(git log -1 --format="%h %s")

step "Prisma Client generieren"
sudo -u "$APP_USER" bash -c "set -a; source $APP_DIR/.env; set +a; cd $APP_DIR && npx prisma generate" \
  || error "Prisma generate fehlgeschlagen"
success "Prisma Client generiert"

step "Datenbank-Schema migrieren"
sudo -u "$APP_USER" bash -c "set -a; source $APP_DIR/.env; set +a; cd $APP_DIR && npx prisma db push --accept-data-loss" \
  2>&1 | grep -v "^$" || error "Prisma db push fehlgeschlagen"
success "Schema aktualisiert"

step "Seed: Basisdaten prüfen"
sudo -u "$APP_USER" bash -c "set -a; source $APP_DIR/.env; set +a; cd $APP_DIR && npx tsx prisma/seed.ts" \
  && success "Alle Basisdaten vorhanden – Seed übersprungen" \
  || error "Seed fehlgeschlagen"

step "Next.js Build"
sudo -u "$APP_USER" bash -c "set -a; source $APP_DIR/.env; set +a; cd $APP_DIR && pnpm build" \
  || error "Build fehlgeschlagen"
success "Build erfolgreich"

step "Service neu starten"
systemctl restart kds
sleep 5

step "Healthcheck"
for i in $(seq 1 15); do
  sleep 2
  if curl -sf "http://127.0.0.1:3000" > /dev/null 2>&1; then
    echo ""
    echo "═══════════════════════════════════════════"
    success "Update abgeschlossen ✓"
    echo "  $COMMIT"
    echo "═══════════════════════════════════════════"
    systemctl status kds --no-pager -l | head -10
    exit 0
  fi
  echo -n "."
done
echo ""
error "Healthcheck fehlgeschlagen nach Update. Journal: journalctl -u kds -n 50"
UPDATE_EOF

chmod +x "$APP_DIR/update.sh"

# =============================================================================
ADMIN_PASS="Admin1234!"
echo ""
echo -e "${BOLD}${GREEN}"
echo "╔══════════════════════════════════════════════════════╗"
echo "║        KDS Installation erfolgreich! ✓              ║"
echo "╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo "  URL:              ${APP_URL}"
echo "  Admin-Login:      admin@scl90s.local"
echo "  Admin-Passwort:   ${ADMIN_PASS}"
echo ""
echo "  Datenbank:        ${DB_NAME}"
echo "  DB-User:          ${DB_USER}"
echo "  DB-Passwort:      ${DB_PASS}"
echo ""
echo "  Log:              $LOG_FILE"
echo "  Update:           sudo bash $APP_DIR/update.sh"
echo "  Service:          sudo systemctl status kds"
echo "  Journal:          sudo journalctl -u kds -f"
echo ""
echo -e "${YELLOW}WICHTIG: Passwörter notieren und sicher aufbewahren!${NC}"
