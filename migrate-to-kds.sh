#!/bin/bash
# =============================================================================
# KDS Migration – umbenennt alle technischen Komponenten von scl90s → kds
# Führt einen ~5-10 Minuten Downtime durch
# =============================================================================
set -u

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
step()    { echo -e "\n${GREEN}▶ $1${NC}"; }
warn()    { echo -e "${YELLOW}⚠  $1${NC}"; }
success() { echo -e "${GREEN}✓ $1${NC}"; }
fail()    { echo -e "${RED}✗ $1${NC}"; exit 1; }

[[ $EUID -ne 0 ]] && fail "Bitte als root ausführen: sudo bash migrate-to-kds.sh"

echo -e "\n${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  KDS Migration   $(date '+%d.%m.%Y %H:%M')${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"

# ─── 1. Alten Service stoppen ────────────────────────────────────────────────
step "Alter Service wird gestoppt"
systemctl stop scl90s 2>/dev/null || true
systemctl disable scl90s 2>/dev/null || true
success "scl90s Service gestoppt"

# ─── 2. Datenbank migrieren ──────────────────────────────────────────────────
step "Datenbank umbenennen (scl90s_db → kds_db)"

# Prüfen ob kds_db bereits existiert
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='kds_db'" 2>/dev/null || echo "0")

if [[ "$DB_EXISTS" == "1" ]]; then
  warn "kds_db existiert bereits – DB-Migration übersprungen"
else
  # DB-User anlegen falls nicht vorhanden
  USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='kds_user'" 2>/dev/null || echo "0")
  if [[ "$USER_EXISTS" != "1" ]]; then
    # Passwort aus alter .env lesen
    OLD_PW=$(grep "^DATABASE_URL=" /opt/scl90s/.env 2>/dev/null | sed 's|.*://[^:]*:\([^@]*\)@.*|\1|')
    sudo -u postgres psql -c "CREATE USER kds_user WITH PASSWORD '$OLD_PW';" 2>/dev/null || true
    success "kds_user angelegt"
  fi

  # Dump + Restore
  warn "DB-Dump von scl90s_db wird erstellt…"
  sudo -u postgres pg_dump scl90s_db > /tmp/scl90s_backup.sql
  success "Dump erstellt: /tmp/scl90s_backup.sql"

  sudo -u postgres psql -c "CREATE DATABASE kds_db OWNER kds_user;" 2>/dev/null || true
  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE kds_db TO kds_user;" 2>/dev/null
  sudo -u postgres psql kds_db < /tmp/scl90s_backup.sql > /dev/null 2>&1
  sudo -u postgres psql kds_db -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO kds_user;" > /dev/null 2>&1
  sudo -u postgres psql kds_db -c "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO kds_user;" > /dev/null 2>&1
  success "kds_db angelegt und Daten kopiert"
fi

# ─── 3. System-User anlegen ──────────────────────────────────────────────────
step "System-User kds anlegen"
if id "kds" &>/dev/null; then
  warn "User 'kds' existiert bereits"
else
  useradd --system --shell /bin/bash --home /opt/kds kds
  success "System-User 'kds' angelegt"
fi

# ─── 4. Verzeichnis kopieren ─────────────────────────────────────────────────
step "App-Verzeichnis /opt/scl90s → /opt/kds"
if [[ -d /opt/kds ]]; then
  warn "/opt/kds existiert bereits – wird aktualisiert"
else
  cp -r /opt/scl90s /opt/kds
  success "Verzeichnis kopiert"
fi
chown -R kds:kds /opt/kds

# ─── 5. .env aktualisieren ───────────────────────────────────────────────────
step ".env aktualisieren"
OLD_PW=$(grep "^DATABASE_URL=" /opt/scl90s/.env | sed 's|.*://[^:]*:\([^@]*\)@.*|\1|')
sed -i "s|postgresql://scl90s_user:.*@|postgresql://kds_user:${OLD_PW}@|" /opt/kds/.env
sed -i "s|scl90s_db|kds_db|g" /opt/kds/.env
success ".env aktualisiert"

# ─── 6. Git: Neuen Code holen ────────────────────────────────────────────────
step "Neuen Code (KDS) holen"
sudo -u kds git -C /opt/kds config --global --add safe.directory /opt/kds 2>/dev/null || true
sudo -u kds git -C /opt/kds reset --hard origin/main
sudo -u kds git -C /opt/kds pull origin main
success "Code aktualisiert"

# ─── 7. Dependencies + Build ─────────────────────────────────────────────────
step "pnpm install + build"
sudo -u kds bash -c "
  set -a; source /opt/kds/.env; set +a
  cd /opt/kds
  pnpm install --frozen-lockfile 2>&1 | tail -3 || pnpm install 2>&1 | tail -3
  npx prisma generate 2>&1 | tail -2
  pnpm build 2>&1 | tail -5
" || fail "Build fehlgeschlagen"
success "Build abgeschlossen"

# ─── 8. Systemd Service ──────────────────────────────────────────────────────
step "Neuen systemd Service 'kds' anlegen"
cat > /etc/systemd/system/kds.service << 'SERVICE'
[Unit]
Description=KDS – Klinisches Dokumentationssystem (Next.js)
Documentation=https://nextjs.org/
After=network.target postgresql.service

[Service]
Type=simple
User=kds
WorkingDirectory=/opt/kds
EnvironmentFile=/opt/kds/.env
ExecStart=/usr/bin/pnpm start
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=kds

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable kds
systemctl start kds
sleep 3
systemctl is-active --quiet kds && success "KDS Service läuft" || fail "Service-Start fehlgeschlagen"

# ─── 9. Nginx aktualisieren ──────────────────────────────────────────────────
step "Nginx: proxy_pass bleibt auf Port 3000 – keine Änderung nötig"
success "Nginx unverändert (Port 3000 bleibt)"

# ─── 10. Healthcheck ─────────────────────────────────────────────────────────
step "Healthcheck"
sleep 3
curl -sf "http://localhost:3000/api/auth/session" -o /dev/null 2>/dev/null \
  && success "App antwortet auf Port 3000" \
  || warn "Healthcheck fehlgeschlagen – App läuft evtl. noch hoch"

# ─── 11. update.sh kopieren ──────────────────────────────────────────────────
step "update.sh für künftige Updates verfügbar machen"
ln -sf /opt/kds/update.sh /usr/local/bin/kds-update 2>/dev/null || true
success "Alias: sudo kds-update"

echo -e "\n${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  Migration abgeschlossen! ✓${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""
echo "  App:      http://localhost:3000"
echo "  Service:  systemctl status kds"
echo "  Updates:  sudo bash /opt/kds/update.sh"
echo "  Logs:     journalctl -u kds -f"
echo ""
warn "Alter Service scl90s und /opt/scl90s bleiben als Backup erhalten."
warn "Nach Überprüfung kann mit 'sudo rm -rf /opt/scl90s' aufgeräumt werden."
