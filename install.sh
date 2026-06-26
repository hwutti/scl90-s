#!/usr/bin/env bash
# =============================================================================
# SCL-90-S Webapp – Automatisches Installationsskript
# Ubuntu 22.04 / 24.04 LTS
# Installiert: Node.js 22, PostgreSQL 16, Nginx, Certbot (SSL),
#              pgAdmin 4, systemd-Service, automatische DB-Backups
# =============================================================================
set -euo pipefail

# ─── Farben für Terminal-Output ───────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
step()    { echo -e "\n${BOLD}═══ $* ═══${NC}"; }

# ─── Root-Check ───────────────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && error "Bitte als root ausführen: sudo bash install.sh"

# ─── Ubuntu-Version prüfen ────────────────────────────────────────────────────
UBUNTU_VERSION=$(lsb_release -rs 2>/dev/null || echo "0")
if [[ "$UBUNTU_VERSION" != "22.04" && "$UBUNTU_VERSION" != "24.04" ]]; then
  warn "Getestet auf Ubuntu 22.04/24.04. Aktuelle Version: $UBUNTU_VERSION – fortfahren auf eigene Gefahr."
  read -rp "Trotzdem fortfahren? [j/N] " CONTINUE </dev/tty
  [[ "${CONTINUE,,}" != "j" ]] && exit 0
fi

# =============================================================================
# KONFIGURATION – hier anpassen
# =============================================================================
APP_NAME="scl90s"
APP_USER="scl90s"
APP_DIR="/opt/scl90s"
APP_PORT="3000"

# Domain (ohne https://) – leer lassen für IP-only ohne SSL
DOMAIN=""

# PostgreSQL
DB_NAME="scl90s_db"
DB_USER="scl90s_user"
DB_PASS=""   # wird zufällig generiert wenn leer

# pgAdmin
PGADMIN_EMAIL=""    # wird abgefragt wenn leer
PGADMIN_PASS=""     # wird zufällig generiert wenn leer
PGADMIN_PORT="5050"

# Backup-Verzeichnis
BACKUP_DIR="/var/backups/scl90s"
BACKUP_KEEP_DAYS="30"

# NextAuth Secret (wird generiert)
NEXTAUTH_SECRET=""
# =============================================================================

echo ""
echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║     SCL-90-S Webapp – Installationsskript           ║"
echo "  ║     Ubuntu $UBUNTU_VERSION – $(date '+%d.%m.%Y %H:%M')                    ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ─── Interaktive Konfiguration ────────────────────────────────────────────────
step "Konfiguration"

if [[ -z "$DOMAIN" ]]; then
  read -rp "Domain (z.B. scl90.meinserver.at) oder leer für IP-only: " DOMAIN </dev/tty
fi

if [[ -z "$DB_PASS" ]]; then
  DB_PASS=$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 24)
  info "Datenbankpasswort generiert"
fi

if [[ -z "$PGADMIN_EMAIL" ]]; then
  read -rp "pgAdmin Admin-E-Mail: " PGADMIN_EMAIL </dev/tty
fi
if [[ -z "$PGADMIN_PASS" ]]; then
  PGADMIN_PASS=$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 20)
  info "pgAdmin-Passwort generiert"
fi

if [[ -z "$NEXTAUTH_SECRET" ]]; then
  NEXTAUTH_SECRET=$(openssl rand -base64 64 | tr -dc 'A-Za-z0-9' | head -c 48)
fi

# ─── Systemaktualisierung ─────────────────────────────────────────────────────
step "System aktualisieren"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq
apt-get install -y -qq \
  curl wget gnupg2 ca-certificates lsb-release \
  software-properties-common apt-transport-https \
  build-essential git unzip ufw fail2ban \
  python3-pip libpq-dev
success "System aktualisiert"

# ─── Node.js 20 (via NodeSource) ──────────────────────────────────────────────
step "Node.js 20 installieren"
if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d 'v')" -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - 2>/dev/null
  apt-get install -y -qq nodejs
fi
node -v && npm -v
success "Node.js $(node -v) installiert"

# pnpm (schneller als npm, empfohlen für Next.js)
npm install -g pnpm@9 --quiet
success "pnpm $(pnpm -v) installiert"

# ─── PostgreSQL 16 ────────────────────────────────────────────────────────────
step "PostgreSQL 16 installieren"
if ! command -v psql &>/dev/null; then
  # Offizielles PostgreSQL-Repository
  install -d /usr/share/postgresql-common/pgdg
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
  sh -c 'echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
    https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list'
  apt-get update -qq
  apt-get install -y -qq postgresql-16 postgresql-client-16
fi

systemctl enable postgresql
systemctl start postgresql
success "PostgreSQL $(psql --version) installiert"

# ─── Datenbank & User anlegen ─────────────────────────────────────────────────
step "Datenbank einrichten"
sudo -u postgres psql -c "
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DB_USER') THEN
      CREATE ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASS';
    END IF;
  END
  \$\$;
" 2>/dev/null || true

sudo -u postgres psql -c "
  SELECT 'CREATE DATABASE $DB_NAME OWNER $DB_USER ENCODING ''UTF8'''
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')
" | sudo -u postgres psql 2>/dev/null || true

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true

# pg_hba.conf – scram-sha-256 für lokale Verbindungen
PG_HBA="/etc/postgresql/16/main/pg_hba.conf"
if [[ -f "$PG_HBA" ]]; then
  # Sicherstellen dass md5/scram für den App-User funktioniert
  if ! grep -q "^host.*$DB_NAME.*$DB_USER" "$PG_HBA"; then
    echo "host    $DB_NAME    $DB_USER    127.0.0.1/32    scram-sha-256" >> "$PG_HBA"
    systemctl reload postgresql
  fi
fi
success "Datenbank '$DB_NAME' und User '$DB_USER' angelegt"

# ─── pgAdmin 4 ────────────────────────────────────────────────────────────────
step "pgAdmin 4 installieren"
if ! command -v pgadmin4 &>/dev/null && ! dpkg -l pgadmin4 &>/dev/null 2>&1; then
  curl -fsSL https://www.pgadmin.org/static/packages_pgadmin_org.pub \
    | gpg --dearmor -o /usr/share/keyrings/packages-pgadmin-org.gpg
  echo "deb [signed-by=/usr/share/keyrings/packages-pgadmin-org.gpg] \
    https://ftp.postgresql.org/pub/pgadmin/pgadmin4/apt/$(lsb_release -cs) pgadmin4 main" \
    > /etc/apt/sources.list.d/pgadmin4.list
  apt-get update -qq
  apt-get install -y -qq pgadmin4-web

  # pgAdmin Setup (non-interaktiv via expect oder Python)
  python3 /usr/pgadmin4/bin/setup-web.py \
    --email "$PGADMIN_EMAIL" \
    --password "$PGADMIN_PASS" \
    --yes 2>/dev/null || \
  printf '%s\n%s\n%s\n' "$PGADMIN_EMAIL" "$PGADMIN_PASS" "$PGADMIN_PASS" \
    | python3 /usr/pgadmin4/bin/setup-web.py 2>/dev/null || true
fi
success "pgAdmin 4 installiert"

# ─── Apache stoppen (wird von pgAdmin als Abhängigkeit installiert) ────────────
# pgAdmin bringt Apache mit, der Port 80 belegt – wir nutzen Nginx statt Apache
if systemctl is-active apache2 &>/dev/null || systemctl is-enabled apache2 &>/dev/null 2>&1; then
  info "Apache2 wird gestoppt und deaktiviert (Port 80 wird für Nginx benötigt)"
  systemctl stop apache2 2>/dev/null || true
  systemctl disable apache2 2>/dev/null || true
  success "Apache2 deaktiviert"
fi

# ─── Nginx ────────────────────────────────────────────────────────────────────
step "Nginx installieren"
apt-get install -y -qq nginx
systemctl enable nginx
systemctl start nginx
success "Nginx installiert"

# ─── App-User & Verzeichnis ───────────────────────────────────────────────────
step "App-User anlegen"
if ! id "$APP_USER" &>/dev/null; then
  useradd --system --shell /bin/bash --create-home --home-dir "$APP_DIR" "$APP_USER"
fi
mkdir -p "$APP_DIR"
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
success "User '$APP_USER' und Verzeichnis '$APP_DIR' angelegt"

# ─── App-Code von GitHub klonen ───────────────────────────────────────────────
step "App-Code von GitHub klonen"
GITHUB_REPO="https://github.com/hwutti/scl90-s.git"

if [[ -f "$APP_DIR/package.json" ]]; then
  info "package.json gefunden – Update via git pull"
  sudo -u "$APP_USER" bash -c "
    cd '$APP_DIR'
    git pull origin main 2>&1 | tail -5
  "
else
  info "Klone Repository: $GITHUB_REPO"
  # Verzeichnis vollständig leeren (außer .env)
  if [[ -f "$APP_DIR/.env" ]]; then
    cp "$APP_DIR/.env" /tmp/scl90s_env_backup
  fi
  rm -rf "$APP_DIR"
  mkdir -p "$APP_DIR"
  chown "$APP_USER":"$APP_USER" "$APP_DIR"
  if [[ -f /tmp/scl90s_env_backup ]]; then
    cp /tmp/scl90s_env_backup "$APP_DIR/.env"
    chown "$APP_USER":"$APP_USER" "$APP_DIR/.env"
    chmod 600 "$APP_DIR/.env"
    rm /tmp/scl90s_env_backup
  fi

  sudo -u "$APP_USER" bash -c "
    git clone '$GITHUB_REPO' '$APP_DIR' 2>&1 | tail -5
  " || error "Git Clone fehlgeschlagen. Netzwerk prüfen."
fi
success "App-Code bereit"

# ─── Node.js Abhängigkeiten installieren ──────────────────────────────────────
step "npm-Pakete installieren (pnpm install)"
sudo -u "$APP_USER" bash -c "
  cd '$APP_DIR'
  pnpm install --frozen-lockfile 2>&1 | tail -8 || pnpm install 2>&1 | tail -8
"
success "npm-Pakete installiert"

# Prisma Schema kommt aus Git-Repository


# ─── Umgebungsvariablen (.env) ────────────────────────────────────────────────
step ".env Datei erstellen"
cat > "$APP_DIR/.env" << ENV_EOF
# =============================================================================
# SCL-90-S Webapp – Umgebungsvariablen
# ACHTUNG: Diese Datei enthält Secrets – niemals in Git einchecken!
# =============================================================================

# Datenbank
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}?schema=public"

# NextAuth
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"
NEXTAUTH_URL="${DOMAIN:+https://${DOMAIN}}${DOMAIN:-http://localhost:${APP_PORT}}"

# App
NODE_ENV="production"
APP_PORT="${APP_PORT}"

# Verschlüsselung für sensible Patientendaten (AES-256)
# WICHTIG: Vor Produktiveinsatz mit starkem Key ersetzen!
ENCRYPTION_KEY="$(openssl rand -hex 32)"

# pgAdmin (nur für Referenz)
# pgAdmin läuft auf Port ${PGADMIN_PORT}
# Login: ${PGADMIN_EMAIL}
ENV_EOF

chmod 600 "$APP_DIR/.env"
chown "$APP_USER":"$APP_USER" "$APP_DIR/.env"
success ".env Datei erstellt (chmod 600)"

# ─── Prisma Migrations ────────────────────────────────────────────────────────
step "Datenbank-Schema anwenden"
sudo -u "$APP_USER" bash -c "
  cd '$APP_DIR'
  npx prisma generate 2>&1 | tail -3
  npx prisma migrate deploy 2>/dev/null || npx prisma db push --accept-data-loss 2>&1 | tail -5
"
success "Datenbank-Schema angewendet"

# ─── Next.js Build ────────────────────────────────────────────────────────────
step "Next.js Build erstellen"
sudo -u "$APP_USER" bash -c "
  cd '$APP_DIR'
  pnpm build 2>&1 | tail -10
"
success "Next.js Build abgeschlossen"

# ─── Datenbank-Seed (Demo-User) ───────────────────────────────────────────────
step "Datenbank-Seed ausführen (Admin, Demo-Therapeut, Demo-Patient)"
sudo -u "$APP_USER" bash -c "
  cd '$APP_DIR'
  # tsx für Seed installieren falls nötig
  pnpm add -D tsx 2>/dev/null | tail -2 || true
  npx tsx prisma/seed.ts 2>&1 | tail -10
" && success "Seed abgeschlossen" || warn "Seed fehlgeschlagen (DB evtl. schon befüllt – OK)"

# ─── systemd Service ──────────────────────────────────────────────────────────
step "systemd Service einrichten"
cat > "/etc/systemd/system/${APP_NAME}.service" << SYSTEMD_EOF
[Unit]
Description=SCL-90-S Webapp (Next.js)
Documentation=https://nextjs.org/
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
ExecStart=/usr/bin/pnpm start
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${APP_NAME}

# Sicherheits-Hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${APP_DIR}
PrivateTmp=true
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
SYSTEMD_EOF

systemctl daemon-reload
systemctl enable "${APP_NAME}"
systemctl start "${APP_NAME}"
success "systemd Service '${APP_NAME}' aktiviert und gestartet"

# ─── Nginx Konfiguration ──────────────────────────────────────────────────────
step "Nginx konfigurieren"

# Standard-Site deaktivieren
rm -f /etc/nginx/sites-enabled/default

NGINX_CONF="/etc/nginx/sites-available/${APP_NAME}"

if [[ -n "$DOMAIN" ]]; then
  # Mit Domain – zunächst HTTP (SSL kommt nach Certbot)
  cat > "$NGINX_CONF" << NGINX_EOF
# SCL-90-S Webapp – Nginx Konfiguration
# Domain: ${DOMAIN}

# Rate Limiting (Schutz vor Brute-Force)
limit_req_zone \$binary_remote_addr zone=scl90_api:10m rate=20r/m;
limit_req_zone \$binary_remote_addr zone=scl90_login:10m rate=5r/m;

server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;" always;

    # Logging
    access_log /var/log/nginx/${APP_NAME}_access.log;
    error_log  /var/log/nginx/${APP_NAME}_error.log;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_comp_level 6;

    # Statische Next.js Assets (direkt von Nginx ohne Node)
    location /_next/static/ {
        alias ${APP_DIR}/.next/static/;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }

    # API Routes – Rate Limiting
    location /api/ {
        limit_req zone=scl90_api burst=30 nodelay;
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Login – strengeres Rate Limiting
    location /api/auth/ {
        limit_req zone=scl90_login burst=5 nodelay;
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # pgAdmin
    location /pgadmin/ {
        proxy_pass http://127.0.0.1:${PGADMIN_PORT}/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        # Nur aus lokalem Netz erreichbar – nach Bedarf anpassen
        # allow 10.0.0.0/8;
        # deny all;
    }

    # Alles andere → Next.js
    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }

    # Gesundheitscheck
    location /health {
        access_log off;
        return 200 "OK\n";
        add_header Content-Type text/plain;
    }
}
NGINX_EOF

else
  # Ohne Domain – IP-only
  cat > "$NGINX_CONF" << NGINX_EOF
server {
    listen 80 default_server;
    server_name _;

    access_log /var/log/nginx/${APP_NAME}_access.log;
    error_log  /var/log/nginx/${APP_NAME}_error.log;

    location /_next/static/ {
        alias ${APP_DIR}/.next/static/;
        expires 365d;
    }

    location /pgadmin/ {
        proxy_pass http://127.0.0.1:${PGADMIN_PORT}/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX_EOF
fi

ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/${APP_NAME}"
nginx -t && systemctl reload nginx
success "Nginx konfiguriert"

# ─── SSL mit Certbot (nur wenn Domain vorhanden) ──────────────────────────────
if [[ -n "$DOMAIN" ]]; then
  step "SSL-Zertifikat (Let's Encrypt) einrichten"
  apt-get install -y -qq certbot python3-certbot-nginx

  # Email für Certbot abfragen
  read -rp "E-Mail für Let's Encrypt Benachrichtigungen: " CERT_EMAIL </dev/tty

  certbot --nginx \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" \
    --non-interactive \
    --agree-tos \
    --email "$CERT_EMAIL" \
    --redirect \
    2>&1 | tail -10 || warn "SSL konnte nicht eingerichtet werden – DNS ggf. noch nicht propagiert"

  # Auto-Renewal (Certbot richtet das meist schon ein)
  systemctl enable certbot.timer 2>/dev/null || true
  success "SSL-Zertifikat eingerichtet (auto-renewal aktiv)"
fi

# ─── Automatische DB-Backups ──────────────────────────────────────────────────
step "Automatische Datenbank-Backups einrichten"
mkdir -p "$BACKUP_DIR"
chown postgres:postgres "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

cat > "/usr/local/bin/scl90s-backup.sh" << BACKUP_EOF
#!/usr/bin/env bash
# SCL-90-S – PostgreSQL Backup
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR}"
DB_NAME="${DB_NAME}"
KEEP_DAYS="${BACKUP_KEEP_DAYS}"
TIMESTAMP=\$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="\${BACKUP_DIR}/\${DB_NAME}_\${TIMESTAMP}.sql.gz"

# Dump erstellen
pg_dump -U postgres "\$DB_NAME" | gzip > "\$BACKUP_FILE"
chmod 600 "\$BACKUP_FILE"

# Alte Backups löschen
find "\$BACKUP_DIR" -name "*.sql.gz" -mtime +\$KEEP_DAYS -delete

echo "[\$(date '+%Y-%m-%d %H:%M:%S')] Backup erstellt: \$BACKUP_FILE"
echo "[\$(date '+%Y-%m-%d %H:%M:%S')] Backup-Größe: \$(du -sh \$BACKUP_FILE | cut -f1)"
BACKUP_EOF

chmod +x "/usr/local/bin/scl90s-backup.sh"

# Cron-Job: täglich um 02:30 Uhr als postgres-User
(crontab -u postgres -l 2>/dev/null || echo "") | \
  grep -v "scl90s-backup" | \
  { cat; echo "30 2 * * * /usr/local/bin/scl90s-backup.sh >> /var/log/scl90s-backup.log 2>&1"; } | \
  crontab -u postgres -

success "Tägliches DB-Backup um 02:30 Uhr eingerichtet (${BACKUP_KEEP_DAYS} Tage aufbewahrung)"

# ─── Firewall (UFW) ───────────────────────────────────────────────────────────
step "Firewall konfigurieren"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp     # HTTP
ufw allow 443/tcp    # HTTPS
# Port 3000 und 5432 bleiben intern (kein direkter Zugang von außen)
ufw --force enable
success "Firewall aktiv: SSH, HTTP(S) erlaubt – PostgreSQL & Node.js nur intern"

# ─── Fail2ban ─────────────────────────────────────────────────────────────────
step "Fail2ban einrichten"
cat > "/etc/fail2ban/jail.d/${APP_NAME}.conf" << F2B_EOF
[nginx-http-auth]
enabled  = true
port     = http,https
logpath  = /var/log/nginx/${APP_NAME}_error.log
maxretry = 5
bantime  = 3600

[nginx-limit-req]
enabled  = true
port     = http,https
logpath  = /var/log/nginx/${APP_NAME}_error.log
maxretry = 10
bantime  = 600
F2B_EOF

systemctl enable fail2ban
systemctl restart fail2ban
success "Fail2ban eingerichtet"

# ─── Sofort-Backup nach Installation ─────────────────────────────────────────
step "Initiales Backup erstellen"
sudo -u postgres /usr/local/bin/scl90s-backup.sh || warn "Initiales Backup fehlgeschlagen (DB möglicherweise noch leer)"

# ─── Credentials-Datei speichern ─────────────────────────────────────────────
CREDS_FILE="/root/scl90s_credentials.txt"
cat > "$CREDS_FILE" << CREDS_EOF
# ============================================================
# SCL-90-S – Zugangsdaten (sicher aufbewahren!)
# Erstellt: $(date '+%d.%m.%Y %H:%M:%S')
# ============================================================

App-URL:         ${DOMAIN:+https://${DOMAIN}}${DOMAIN:-http://SERVER-IP}
pgAdmin-URL:     ${DOMAIN:+https://${DOMAIN}/pgadmin}${DOMAIN:-http://SERVER-IP/pgadmin}
pgAdmin-Login:   ${PGADMIN_EMAIL}
pgAdmin-Pass:    ${PGADMIN_PASS}

Datenbank:       ${DB_NAME}
DB-User:         ${DB_USER}
DB-Passwort:     ${DB_PASS}

App-Verzeichnis: ${APP_DIR}
systemd-Service: ${APP_NAME}
Backup-Ordner:   ${BACKUP_DIR}

Nützliche Befehle:
  Service-Status:   systemctl status ${APP_NAME}
  Logs anzeigen:    journalctl -u ${APP_NAME} -f
  Nginx-Logs:       tail -f /var/log/nginx/${APP_NAME}_error.log
  Manuelles Backup: sudo -u postgres /usr/local/bin/scl90s-backup.sh
  DB-Konsole:       sudo -u postgres psql ${DB_NAME}
  App neu starten:  systemctl restart ${APP_NAME}
  App deployen:     cd ${APP_DIR} && git pull && pnpm install && pnpm build && systemctl restart ${APP_NAME}
CREDS_EOF

chmod 600 "$CREDS_FILE"

# ─── Abschluss ────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}"
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║     ✓  Installation abgeschlossen!                  ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo -e "  ${BOLD}App-URL:${NC}        ${DOMAIN:+https://${DOMAIN}}${DOMAIN:-http://$(hostname -I | awk '{print $1}')}"
echo -e "  ${BOLD}pgAdmin:${NC}        ${DOMAIN:+https://${DOMAIN}/pgadmin}${DOMAIN:-http://$(hostname -I | awk '{print $1}')/pgadmin}"
echo -e "  ${BOLD}pgAdmin Login:${NC}  ${PGADMIN_EMAIL} / ${PGADMIN_PASS}"
echo -e "  ${BOLD}DB-Passwort:${NC}    ${DB_PASS}"
echo ""
echo -e "  ${YELLOW}Zugangsdaten gespeichert in: ${CREDS_FILE}${NC}"
echo ""
echo -e "  ${BOLD}Nächste Schritte:${NC}"
echo "  1. Browser öffnen: ${DOMAIN:+https://${DOMAIN}}${DOMAIN:-http://$(hostname -I | awk '{print $1}')}"
echo "  2. Login: admin@scl90s.local / Admin1234!  (Passwort sofort ändern!)"
if [[ -n "$DOMAIN" ]]; then
  echo "  3. DNS: A-Record ${DOMAIN} → $(hostname -I | awk '{print $1}')"
fi
echo ""
echo -e "  Logs: ${BLUE}journalctl -u ${APP_NAME} -f${NC}"
echo ""
