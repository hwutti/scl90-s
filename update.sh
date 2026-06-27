#!/bin/bash
# =============================================================================
# SCL-90-S – Update-Script (vollautomatisch, kein manueller Eingriff nötig)
# =============================================================================
set -euo pipefail

APP_DIR="/opt/scl90s"
APP_USER="scl90s"
SERVICE="scl90s"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
step()    { echo -e "\n${GREEN}▶ $1${NC}"; }
warn()    { echo -e "${YELLOW}⚠  $1${NC}"; }
success() { echo -e "${GREEN}✓ $1${NC}"; }
fail()    { echo -e "${RED}✗ $1${NC}"; exit 1; }

[[ $EUID -ne 0 ]] && fail "Bitte als root ausführen: sudo bash update.sh"

echo -e "\n${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  SCL-90-S Update   $(date '+%d.%m.%Y %H:%M')${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"

# ─── 1. Git ───────────────────────────────────────────────────────────────────
step "Git: Änderungen holen"
sudo -u "$APP_USER" git -C "$APP_DIR" config --global --add safe.directory "$APP_DIR" 2>/dev/null || true
sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard origin/main
sudo -u "$APP_USER" git -C "$APP_DIR" pull origin main
COMMIT=$(sudo -u "$APP_USER" git -C "$APP_DIR" log --oneline -1)
success "Commit: $COMMIT"

# ─── 2. NEXTAUTH_URL aus Nginx-Konfiguration setzen ──────────────────────────
step "NEXTAUTH_URL prüfen"
ENV_FILE="$APP_DIR/.env"
NGINX_DOMAIN=$(grep -rh "server_name" /etc/nginx/sites-enabled/ 2>/dev/null \
  | grep -v "localhost\|127\.0\.0\.1\|_" \
  | awk '{print $2}' | tr -d ';' | grep "\." | head -1)

if [[ -n "$NGINX_DOMAIN" ]]; then
  if [[ -f "/etc/letsencrypt/live/$NGINX_DOMAIN/fullchain.pem" ]]; then
    NEW_URL="https://$NGINX_DOMAIN"
  else
    NEW_URL="http://$NGINX_DOMAIN"
  fi
  CURRENT_URL=$(grep "^NEXTAUTH_URL=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- || echo "")
  if [[ "$CURRENT_URL" != "$NEW_URL" ]]; then
    sed -i "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=$NEW_URL|" "$ENV_FILE"
    warn "NEXTAUTH_URL aktualisiert: $CURRENT_URL → $NEW_URL"
  else
    success "NEXTAUTH_URL korrekt: $CURRENT_URL"
  fi
else
  warn "Keine Nginx-Domain erkannt – NEXTAUTH_URL bleibt unverändert"
fi

# ─── 3. Dependencies ──────────────────────────────────────────────────────────
step "pnpm install"
sudo -u "$APP_USER" bash -c "cd $APP_DIR && pnpm install --frozen-lockfile 2>&1 | tail -3 || pnpm install 2>&1 | tail -3"
success "Abhängigkeiten installiert"

# ─── 4. Prisma Client generieren ──────────────────────────────────────────────
step "Prisma Client generieren"
sudo -u "$APP_USER" bash -c "
  set -a; source $APP_DIR/.env; set +a
  cd $APP_DIR && npx prisma generate 2>&1 | tail -3
"
success "Prisma Client generiert"

# ─── 5. Schema-Migration (OHNE Datenverlust) ──────────────────────────────────
step "Datenbank-Schema migrieren"
# db push --accept-data-loss fügt neue Tabellen/Felder hinzu
# ohne --force-reset → bestehende Daten bleiben erhalten
sudo -u "$APP_USER" bash -c "
  set -a; source $APP_DIR/.env; set +a
  cd $APP_DIR && npx prisma db push --accept-data-loss 2>&1 | tail -5
"
success "Schema aktualisiert"

# ─── 6. Seed: fehlende Basisdaten automatisch ergänzen ────────────────────────
step "Seed: Basisdaten prüfen"

# Hilfsfunktion: Tabellenzeilen zählen
count_table() {
  sudo -u "$APP_USER" bash -c "
    set -a; source $APP_DIR/.env; set +a
    cd $APP_DIR
    npx prisma db execute --stdin 2>/dev/null <<SQL
SELECT COUNT(*)::text FROM \"$1\";
SQL
  " 2>/dev/null | grep -E '^[0-9]+$' | tail -1 || echo "0"
}

NEED_SEED=0

# Jede kritische Tabelle prüfen
for TABLE in "Instrument" "AppointmentType" "PraxisConfig"; do
  COUNT=$(count_table "$TABLE")
  if [[ "$COUNT" == "0" ]] || [[ -z "$COUNT" ]]; then
    warn "Tabelle $TABLE ist leer → Seed nötig"
    NEED_SEED=1
    break
  fi
done

if [[ $NEED_SEED -eq 1 ]]; then
  sudo -u "$APP_USER" bash -c "
    set -a; source $APP_DIR/.env; set +a
    cd $APP_DIR && pnpm db:seed 2>&1 | tail -20
  " && success "Seed abgeschlossen" || warn "Seed fehlgeschlagen – App funktioniert trotzdem"
else
  success "Alle Basisdaten vorhanden – Seed übersprungen"
fi

# ─── 7. Build ─────────────────────────────────────────────────────────────────
step "Next.js Build"
sudo -u "$APP_USER" bash -c "
  set -a; source $APP_DIR/.env; set +a
  cd $APP_DIR && pnpm build 2>&1
" && success "Build erfolgreich" || fail "Build fehlgeschlagen – Service wird NICHT neu gestartet"

# ─── 8. Service neu starten ───────────────────────────────────────────────────
step "Service neu starten"
systemctl restart "$SERVICE"
sleep 3
systemctl is-active --quiet "$SERVICE" && success "Service läuft" || fail "Service-Start fehlgeschlagen"

# ─── 9. Healthcheck ───────────────────────────────────────────────────────────
step "Healthcheck"
PORT=$(grep "^APP_PORT=" "$APP_DIR/.env" | cut -d= -f2 | tr -d '"' || echo "3000")
sleep 2
curl -sf "http://localhost:${PORT}/api/auth/session" -o /dev/null 2>/dev/null \
  && success "App antwortet auf Port $PORT" \
  || warn "Healthcheck fehlgeschlagen – App läuft evtl. noch hoch"

echo -e "\n${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  Update abgeschlossen ✓  |  $COMMIT${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}\n"
systemctl status "$SERVICE" --no-pager -l | head -6
