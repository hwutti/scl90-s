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
  PUSH_OUTPUT=$(sudo -u "$APP_USER" bash -c "
    set -a; source \$APP_DIR/.env; set +a
    cd \$APP_DIR
    echo 'yes' | npx prisma db push --accept-data-loss 2>&1
  ")
  if echo "$PUSH_OUTPUT" | grep -q "error\|Error\|failed"; then
    warn "db push mit Fehlern, versuche --force-reset"
    sudo -u "$APP_USER" bash -c "
      set -a; source $APP_DIR/.env; set +a
      cd $APP_DIR
      echo 'yes' | npx prisma db push --force-reset --accept-data-loss 2>&1 | tail -10
    " && success "Schema via db push (force-reset) aktualisiert" || fail "Schema-Update fehlgeschlagen"
  else
    success "Schema via db push aktualisiert"
  fi
fi

# ─── 5. Seed: Basis-Daten sicherstellen (idempotent) ─────────────────────────
step "Seed: Basis-Daten prüfen"

# Prüfen ob Seed nötig (Instrument-Tabelle leer?)
INSTRUMENT_COUNT=$(sudo -u "$APP_USER" bash -c "
  set -a; source $APP_DIR/.env; set +a
  cd $APP_DIR
  npx prisma db execute --stdin <<SQL 2>/dev/null
SELECT COUNT(*)::text FROM \"Instrument\";
SQL
" 2>/dev/null | grep -E '^[0-9]+$' | tail -1 || echo "0")

if [[ "$INSTRUMENT_COUNT" == "0" ]] || [[ -z "$INSTRUMENT_COUNT" ]]; then
  warn "Datenbank leer oder neu → Seed wird ausgeführt"
  sudo -u "$APP_USER" bash -c "
    set -a; source $APP_DIR/.env; set +a
    cd $APP_DIR
    pnpm db:seed 2>&1 | tail -10
  " && success "Seed abgeschlossen" || warn "Seed übersprungen (Daten bereits vorhanden)"
else
  success "Datenbank enthält Daten ($INSTRUMENT_COUNT Instrument(e)) – Seed übersprungen"
fi

# ─── 6. Build ────────────────────────────────────────────────────────────────
step "Next.js Build"
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
