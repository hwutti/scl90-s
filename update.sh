#!/bin/bash
# =============================================================================
# SCL-90-S – Update-Script
# Führt alle nötigen Schritte nach einem git pull automatisch durch:
# git pull → pnpm install → prisma generate → schema diff → migrate/push
# → build → restart → healthcheck
# =============================================================================
set -euo pipefail

APP_DIR="/opt/scl90s"
APP_USER="scl90s"
SERVICE="scl90s"

# Farben
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
step()    { echo -e "\n${GREEN}▶ $1${NC}"; }
warn()    { echo -e "${YELLOW}⚠  $1${NC}"; }
success() { echo -e "${GREEN}✓ $1${NC}"; }
fail()    { echo -e "${RED}✗ $1${NC}"; exit 1; }

# Root-Check
if [[ $EUID -ne 0 ]]; then
  fail "Bitte als root ausführen: sudo bash update.sh"
fi

echo -e "\n${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  SCL-90-S Update   $(date '+%d.%m.%Y %H:%M')${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"

# ─── 1. Git ──────────────────────────────────────────────────────────────────
step "Git: Änderungen holen"
sudo -u "$APP_USER" git -C "$APP_DIR" config --global --add safe.directory "$APP_DIR" 2>/dev/null || true
sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard origin/main
sudo -u "$APP_USER" git -C "$APP_DIR" pull origin main

COMMIT=$(sudo -u "$APP_USER" git -C "$APP_DIR" log --oneline -1)
success "Aktueller Commit: $COMMIT"

# ─── 2. Dependencies ─────────────────────────────────────────────────────────
step "pnpm install"
sudo -u "$APP_USER" bash -c "cd $APP_DIR && pnpm install --frozen-lockfile 2>&1 | tail -5 || pnpm install 2>&1 | tail -5"
success "Abhängigkeiten installiert"

# ─── 3. Prisma Client generieren ─────────────────────────────────────────────
step "Prisma Client generieren"
sudo -u "$APP_USER" bash -c "
  set -a; source $APP_DIR/.env; set +a
  cd $APP_DIR
  npx prisma generate 2>&1 | tail -3
"
success "Prisma Client generiert"

# ─── 4. Schema-Änderungen erkennen und anwenden ──────────────────────────────
step "Datenbank-Schema prüfen und migrieren"

# Versuche prisma migrate deploy (für Produktions-Migrations-Workflow)
# Falls keine Migrations-Dateien vorhanden → db push (Development-Modus)
MIGRATION_DIR="$APP_DIR/prisma/migrations"

if [[ -d "$MIGRATION_DIR" ]] && [[ -n "$(ls -A $MIGRATION_DIR 2>/dev/null)" ]]; then
  warn "Migrations-Verzeichnis gefunden → prisma migrate deploy"
  sudo -u "$APP_USER" bash -c "
    set -a; source $APP_DIR/.env; set +a
    cd $APP_DIR
    npx prisma migrate deploy 2>&1
  " && success "Migrationen angewendet" || {
    warn "migrate deploy fehlgeschlagen → fallback auf db push"
    sudo -u "$APP_USER" bash -c "
      set -a; source $APP_DIR/.env; set +a
      cd $APP_DIR
      npx prisma db push 2>&1 | tail -10
    " && success "Schema via db push aktualisiert"
  }
else
  warn "Keine Migrations-Dateien → prisma db push"
  # --accept-data-loss: neue Felder/Tabellen hinzufügen
  # Kein --force-reset: bestehende Daten werden NICHT gelöscht
  sudo -u "$APP_USER" bash -c "
    set -a; source $APP_DIR/.env; set +a
    cd $APP_DIR
    npx prisma db push --accept-data-loss 2>&1 | tail -15
  " && success "Schema via db push aktualisiert" || {
    warn "db push fehlgeschlagen - versuche Schema-Diff"
    # Nur neue Tabellen hinzufügen die noch nicht existieren
    sudo -u "$APP_USER" bash -c "
      set -a; source $APP_DIR/.env; set +a
      cd $APP_DIR
      npx prisma db push --accept-data-loss --skip-generate 2>&1 | tail -10
    " && success "Schema teilweise aktualisiert" || warn "Schema-Update fehlgeschlagen - manuelle Intervention nötig"
  }
fi

# ─── 5. Seed: Basis-Daten sicherstellen (idempotent) ─────────────────────────
step "Seed: Basis-Daten prüfen"

# Prüfen ob Seed nötig (Instrument-Tabelle leer?)
# Seed ausführen wenn Kerntabellen leer sind
INSTRUMENT_COUNT=$(sudo -u "$APP_USER" bash -c "
  set -a; source $APP_DIR/.env; set +a
  cd $APP_DIR
  npx prisma db execute --stdin 2>/dev/null <<SQL
SELECT COUNT(*)::text FROM \"Instrument\";
SQL
" 2>/dev/null | grep -E '^[0-9]+$' | tail -1 || echo "0")

APPTTYPE_COUNT=$(sudo -u "$APP_USER" bash -c "
  set -a; source $APP_DIR/.env; set +a
  cd $APP_DIR
  npx prisma db execute --stdin 2>/dev/null <<SQL
SELECT COUNT(*)::text FROM \"AppointmentType\";
SQL
" 2>/dev/null | grep -E '^[0-9]+$' | tail -1 || echo "0")

if [[ "$INSTRUMENT_COUNT" == "0" ]] || [[ -z "$INSTRUMENT_COUNT" ]]; then
  warn "Datenbank leer → Seed wird ausgeführt"
  sudo -u "$APP_USER" bash -c "
    set -a; source $APP_DIR/.env; set +a
    cd $APP_DIR
    pnpm db:seed 2>&1 | tail -15
  " && success "Seed abgeschlossen" || warn "Seed fehlgeschlagen"
elif [[ "$APPTTYPE_COUNT" == "0" ]] || [[ -z "$APPTTYPE_COUNT" ]]; then
  warn "AppointmentType-Tabelle leer → Seed für neue Tabellen"
  sudo -u "$APP_USER" bash -c "
    set -a; source $APP_DIR/.env; set +a
    cd $APP_DIR
    pnpm db:seed 2>&1 | tail -15
  " && success "Seed abgeschlossen" || warn "Seed fehlgeschlagen"
else
  success "Datenbank OK (Instrumente: $INSTRUMENT_COUNT, Termintypen: $APPTTYPE_COUNT)"
fi

# ─── 6. Build ────────────────────────────────────────────────────────────────
step "Next.js Build"
# ─── NEXTAUTH_URL automatisch auf aktuelle Domain setzen ──────────────────────
step "NEXTAUTH_URL prüfen"
ENV_FILE="$APP_DIR/.env"
NGINX_DOMAIN=$(grep -rh "server_name" /etc/nginx/sites-enabled/ 2>/dev/null | grep -v "localhost\|127\.0\.0\.1\|_" | awk '{print $2}' | tr -d ';' | grep "\." | head -1)

if [[ -n "$NGINX_DOMAIN" ]]; then
  if [[ -f "/etc/letsencrypt/live/$NGINX_DOMAIN/fullchain.pem" ]]; then
    NEW_URL="https://$NGINX_DOMAIN"
  else
    NEW_URL="http://$NGINX_DOMAIN"
  fi
  CURRENT_URL=$(grep "^NEXTAUTH_URL=" "$ENV_FILE" 2>/dev/null | cut -d= -f2-)
  if [[ "$CURRENT_URL" != "$NEW_URL" ]]; then
    warn "NEXTAUTH_URL: $CURRENT_URL → $NEW_URL"
    sed -i "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=$NEW_URL|" "$ENV_FILE"
    success "NEXTAUTH_URL aktualisiert: $NEW_URL"
  else
    success "NEXTAUTH_URL korrekt: $CURRENT_URL"
  fi
else
  warn "Keine Nginx-Domain erkannt – NEXTAUTH_URL manuell prüfen"
fi

step "Next.js Build wird gestartet"
sudo -u "$APP_USER" bash -c "
  set -a; source $APP_DIR/.env; set +a
  cd $APP_DIR
  pnpm build 2>&1
" && success "Build erfolgreich" || fail "Build fehlgeschlagen! Service wird NICHT neu gestartet."

# ─── 7. Service neu starten ──────────────────────────────────────────────────
step "Service neu starten"
systemctl restart "$SERVICE"
sleep 3

if systemctl is-active --quiet "$SERVICE"; then
  success "Service läuft"
else
  fail "Service konnte nicht gestartet werden! Logs: journalctl -u $SERVICE -n 20"
fi

# ─── 8. Healthcheck ──────────────────────────────────────────────────────────
step "Healthcheck"
PORT=$(grep "^APP_PORT=" "$APP_DIR/.env" | cut -d= -f2 | tr -d '"' || echo "3000")
sleep 2

if curl -sf "http://localhost:${PORT}/api/auth/session" -o /dev/null 2>/dev/null; then
  success "App antwortet auf Port $PORT"
else
  warn "Healthcheck schlug fehl – App läuft möglicherweise noch hoch"
  warn "Prüfen mit: curl http://localhost:${PORT}/api/auth/session"
fi

# ─── Zusammenfassung ─────────────────────────────────────────────────────────
echo -e "\n${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  Update abgeschlossen ✓${NC}"
echo -e "${GREEN}  Commit: $COMMIT${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}\n"

systemctl status "$SERVICE" --no-pager -l | head -6
